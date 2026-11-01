import { prisma, withUserContext } from '@nst/database';
import { generateQrPayload, verifyQrPayload, TOTP_WINDOW_SECONDS } from './totp.utils';
import { UnprocessableEntityError, ConflictError, ForbiddenError, NotFoundError, BadRequestError } from '../../lib/errors';
import { sanitizeOfflineError } from './attendance-error-mapper';
import { mapDatabaseError, getDatabaseErrorReason } from '../../lib/errors/database-error-mapper';
import { logger } from '../../lib/logger';
import { SCORE_RULES } from '../../config/score-rules';
import { enqueueNotification } from '@nst/shared';

export class AttendanceService {
  /**
   * Generates a new TOTP QR payload.
   */
  async generateQr(userId: string, sessionId: string) {
    return withUserContext(userId, async (tx) => {
      const session = await tx.attendanceSession.findUnique({
        where: { id: sessionId },
        select: { 
          qrSecret: true,
          event: { select: { state: true, isLocked: true, endTime: true } }
        },
      });

      if (!session || !session.event) {
        throw new NotFoundError('Session not found');
      }

      const dbTimeResult = await tx.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
      const dbNow = dbTimeResult[0].now;
      const finalDeadline = new Date(session.event.endTime.getTime() + 24 * 60 * 60 * 1000);
      
      if (session.event.state !== 'PUBLISHED' || session.event.isLocked || dbNow >= finalDeadline) {
        throw new UnprocessableEntityError('EVENT_LOCKED');
      }

      const qr_payload = generateQrPayload(sessionId, session.qrSecret);
      // Expires at the end of the current TOTP window.
      const windowMs = TOTP_WINDOW_SECONDS * 1000;
      const expires_at = new Date(Math.ceil(Date.now() / windowMs) * windowMs).toISOString();
      return { qr_payload, expires_at };
    });
  }

  /**
   * Cryptographically validates the QR, then calls the database RPC.
   */
  async markAttendance(
    userId: string,
    payload: {
      session_id: string;
      totp_token: string;
      latitude: number;
      longitude: number;
      device_id: string;
      device_os: string;
      gps_accuracy: number;
      mock_location_detected: boolean;
      app_version: string;
    }
  ) {
    let attemptLogged = false;
    const logAttempt = async (isSuccess: boolean, failureReason?: string) => {
      attemptLogged = true;
      try {
        await prisma.$executeRaw`
          INSERT INTO "attendance_attempts" (
            "session_id", "user_id", "is_success", "failure_reason", 
            "latitude", "longitude", "gps_accuracy", "device_id", 
            "device_os", "app_version", "is_offline_sync"
          ) VALUES (
            ${payload.session_id}::uuid, ${userId}::uuid, ${isSuccess}, ${failureReason},
            ${payload.latitude}, ${payload.longitude}, ${payload.gps_accuracy}, ${payload.device_id},
            ${payload.device_os}, ${payload.app_version}, false
          )
        `;
      } catch (logErr) {
        logger.error({ err: logErr }, 'Failed to persist attendance attempt telemetry');
      }
    };

    try {
      return await withUserContext(userId, async (tx) => {
        // 1. Cryptographic Validation (Express level)
        const sessionContext = await tx.$queryRaw<any[]>`
          SELECT * FROM get_session_qr_context(${payload.session_id}::uuid)
        `;

        if (!sessionContext || sessionContext.length === 0) {
          await logAttempt(false, 'SESSION_CLOSED');
          throw new UnprocessableEntityError('SESSION_CLOSED');
        }

        const session = sessionContext[0];

        const now = new Date();
        if (now < session.open_at || (session.close_at && now > session.close_at)) {
          await logAttempt(false, 'SESSION_CLOSED');
          throw new UnprocessableEntityError('SESSION_CLOSED');
        }

        const isValid = verifyQrPayload(payload.session_id, payload.totp_token, session.qr_secret);
        if (!isValid) {
          await logAttempt(false, 'QR_EXPIRED');
          throw new UnprocessableEntityError('QR_EXPIRED');
        }

        // 2. Database RPC Invocation


        const result = await tx.$queryRaw<any[]>`
          WITH rpc AS (
            SELECT * FROM mark_attendance_v5(
              ${payload.session_id}::uuid,
              ${payload.totp_token},
              ${payload.latitude}::float,
              ${payload.longitude}::float,
              ${payload.device_id},
              ${payload.device_os},
              ${payload.gps_accuracy}::float,
              ${payload.mock_location_detected}::boolean,
              ${payload.app_version}
            )
          )
          SELECT rpc.*, current_setting('app.attendance_is_new', true) as is_new
          FROM rpc
        `;

        if (!result || result.length === 0) {
          throw new Error('Failed to mark attendance');
        }

        const attendanceRecord = result[0];

        // 3. Derive Service-Level Presentation Fields
        const flagged = attendanceRecord.audit_metadata?.device_collision_detected === true;
        const points_awarded = SCORE_RULES.ATTENDANCE;

        const is_new = attendanceRecord.is_new === 'true';

        if (!is_new) {
          await logAttempt(false, 'ALREADY_RECORDED');
          throw new ConflictError('ALREADY_RECORDED');
        }

        await logAttempt(true);

        return {
          attendance_id: attendanceRecord.id,
          status: attendanceRecord.status,
          points_awarded,
          flagged,
          is_new,
        };
      });
    } catch (error: unknown) {
      if (!attemptLogged) {
        const mapped = getDatabaseErrorReason(error);
        await logAttempt(false, mapped);
      }
      if ((error as any).statusCode) throw error;
      mapDatabaseError(error);
    }
  }

  /**
   * Syncs offline attendance records via batch RPC.
   */
  async syncOffline(
    userId: string,
    payload: {
      records: Array<{
        user_id: string;
        session_id: string;
        scanned_token: string;
        scan_timestamp: string;
        device_id: string;
        gps_lat: number;
        gps_lng: number;
        gps_accuracy: number;
        mock_location_detected: boolean;
        offline_seq: number;
      }>;
    }
  ) {
    if (!payload.records || payload.records.length === 0) {
      return { processed: 0, skipped: 0, errors: [] };
    }

    const sessionIds = [...new Set(payload.records.map((r) => r.session_id))];

    const sessions = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      return tx.attendanceSession.findMany({
        where: { id: { in: sessionIds } },
        select: { id: true, qrSecret: true, openAt: true, closeAt: true },
      });
    });
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    const recordsWithIndex = payload.records.map((r, idx) => ({
      ...r,
      batch_index: idx,
      user_id: r.user_id || userId,
    }));

    const validRecords: Array<{
      user_id: string;
      session_id: string;
      scanned_token: string;
      scan_timestamp: string;
      device_id: string;
      gps_lat: number;
      gps_lng: number;
      gps_accuracy: number;
      mock_location_detected: boolean;
      offline_seq?: number;
      batch_index: number;
    }> = [];
    const errors: Array<{
      user_id: string;
      error_code: string;
      session_id?: string;
      offline_seq?: number;
      batch_index?: number;
    }> = [];
    const offlineAttempts: Array<{
      sessionId: string;
      userId: string;
      isSuccess: boolean;
      failureReason: string;
      latitude?: number;
      longitude?: number;
      gpsAccuracy?: number;
      deviceId?: string;
      isOfflineSync: boolean;
    }> = [];
    let skipped = 0;

    const DRIFT_TOLERANCE_MS = 30_000;
    const nowMs = Date.now();

    for (const record of recordsWithIndex) {
      const recordUserId = record.user_id;
      const session = sessionMap.get(record.session_id);
      if (!session || !session.qrSecret) {
        skipped++;
        errors.push({
          user_id: recordUserId,
          error_code: 'SESSION_CLOSED',
          session_id: record.session_id,
          offline_seq: record.offline_seq,
          batch_index: record.batch_index,
        });
        offlineAttempts.push({
          sessionId: record.session_id,
          userId: recordUserId,
          isSuccess: false,
          failureReason: 'SESSION_CLOSED',
          latitude: record.gps_lat,
          longitude: record.gps_lng,
          gpsAccuracy: record.gps_accuracy,
          deviceId: record.device_id,
          isOfflineSync: true,
        });
        continue;
      }

      const scanTimeMs = new Date(record.scan_timestamp).getTime();

      // Check future timestamp (> 5 minutes clock skew)
      if (isNaN(scanTimeMs) || scanTimeMs > nowMs + 5 * 60 * 1000) {
        skipped++;
        errors.push({
          user_id: recordUserId,
          error_code: 'FUTURE_TIMESTAMP',
          session_id: record.session_id,
          offline_seq: record.offline_seq,
          batch_index: record.batch_index,
        });
        offlineAttempts.push({
          sessionId: record.session_id,
          userId: recordUserId,
          isSuccess: false,
          failureReason: 'FUTURE_TIMESTAMP',
          latitude: record.gps_lat,
          longitude: record.gps_lng,
          gpsAccuracy: record.gps_accuracy,
          deviceId: record.device_id,
          isOfflineSync: true,
        });
        continue;
      }

      // Check session open_at / close_at window bounds
      if (
        (session.openAt && scanTimeMs < session.openAt.getTime() - DRIFT_TOLERANCE_MS) ||
        (session.closeAt && scanTimeMs > session.closeAt.getTime() + DRIFT_TOLERANCE_MS)
      ) {
        skipped++;
        errors.push({
          user_id: recordUserId,
          error_code: 'SESSION_CLOSED',
          session_id: record.session_id,
          offline_seq: record.offline_seq,
          batch_index: record.batch_index,
        });
        offlineAttempts.push({
          sessionId: record.session_id,
          userId: recordUserId,
          isSuccess: false,
          failureReason: 'SESSION_CLOSED',
          latitude: record.gps_lat,
          longitude: record.gps_lng,
          gpsAccuracy: record.gps_accuracy,
          deviceId: record.device_id,
          isOfflineSync: true,
        });
        continue;
      }

      const isValid = verifyQrPayload(record.session_id, record.scanned_token, session.qrSecret, scanTimeMs);
      
      if (!isValid) {
        skipped++;
        errors.push({
          user_id: recordUserId,
          error_code: 'INVALID_SIGNATURE',
          session_id: record.session_id,
          offline_seq: record.offline_seq,
          batch_index: record.batch_index,
        });
        offlineAttempts.push({
          sessionId: record.session_id,
          userId: recordUserId,
          isSuccess: false,
          failureReason: 'INVALID_SIGNATURE',
          latitude: record.gps_lat,
          longitude: record.gps_lng,
          gpsAccuracy: record.gps_accuracy,
          deviceId: record.device_id,
          isOfflineSync: true,
        });
      } else {
        validRecords.push(record);
      }
    }

    if (validRecords.length === 0) {
      if (offlineAttempts.length > 0) {
        await prisma.attendanceAttempt.createMany({
          data: offlineAttempts,
        }).catch((logErr) => {
          logger.error({ err: logErr }, 'Failed to bulk-insert offline attempt telemetry');
        });
      }
      return { processed: 0, skipped, errors };
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      const recordsJson = JSON.stringify(validRecords);

      const [{ result }] = await tx.$queryRaw<{ result: any }[]>`
        SELECT sync_offline_attendance_v9(${recordsJson}::jsonb) as result
      `;
      return result;
    });

    const dbResult = result;

    const sanitizedDbErrors = (dbResult.errors || []).map(
      (e: { user_id: string; error_code: string; session_id?: string; offline_seq?: number; batch_index?: number }) => sanitizeOfflineError(e)
    );

    // Correlate database errors with validRecords, avoiding fallback misattribution
    for (const errItem of sanitizedDbErrors) {
      const matchingRecord =
        (typeof errItem.batch_index === 'number' ? recordsWithIndex[errItem.batch_index] : undefined) ||
        validRecords.find(
          (r) =>
            r.session_id === errItem.session_id &&
            r.offline_seq !== undefined &&
            r.offline_seq === errItem.offline_seq
        ) ||
        validRecords.find(
          (r) =>
            r.user_id === errItem.user_id &&
            r.session_id === errItem.session_id
        ) ||
        validRecords.find((r) => r.user_id === errItem.user_id);

      if (matchingRecord) {
        offlineAttempts.push({
          sessionId: matchingRecord.session_id,
          userId: errItem.user_id,
          isSuccess: false,
          failureReason: errItem.error_code,
          latitude: matchingRecord.gps_lat,
          longitude: matchingRecord.gps_lng,
          gpsAccuracy: matchingRecord.gps_accuracy,
          deviceId: matchingRecord.device_id,
          isOfflineSync: true,
        });
      }
    }

    if (offlineAttempts.length > 0) {
      await prisma.attendanceAttempt.createMany({
        data: offlineAttempts,
      }).catch((logErr) => {
        logger.error({ err: logErr }, 'Failed to bulk-insert offline attempt telemetry');
      });
    }

    const responseDbErrors = sanitizedDbErrors.map((e: { user_id: string; error_code: string; session_id?: string; offline_seq?: number; batch_index?: number }) => ({
      user_id: e.user_id,
      error_code: e.error_code,
      session_id: e.session_id,
      offline_seq: e.offline_seq,
      batch_index: e.batch_index,
    }));

    return {
      processed: dbResult.processed,
      skipped: dbResult.skipped + skipped,
      errors: [...errors, ...responseDbErrors],
    };
  }

  async getEventAttendance(userId: string, eventId: string, query: any): Promise<{ data: any[]; nextCursor?: string }> {
    return withUserContext(userId, async (tx) => {
      const { cursor, limit, filter_session_id, filter_status, filter_flagged } = query;
      const where: any = { session: { eventId } };
      if (filter_session_id) where.sessionId = filter_session_id;
      if (filter_status) where.status = filter_status;
      if (filter_flagged !== undefined) {
        if (filter_flagged) {
          where.auditMetadata = { path: ['device_collision_detected'], equals: true };
        } else {
          where.auditMetadata = { not: { path: ['device_collision_detected'], equals: true } };
        }
      }
      const records = await tx.attendanceRecord.findMany({
        where,
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { markedAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      });
      let nextCursor = undefined;
      if (records.length > limit) {
        const nextItem = records.pop();
        nextCursor = nextItem!.id;
      }
      return { data: records, nextCursor };
    });
  }

  async getMyAttendance(userId: string, query: any): Promise<{ data: any[]; nextCursor?: string }> {
    return withUserContext(userId, async (tx) => {
      const { cursor, limit, filter_event_id } = query;
      const records = await tx.attendanceRecord.findMany({
        where: { 
          userId,
          ...(filter_event_id && { session: { eventId: filter_event_id } })
        },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { markedAt: 'desc' },
        include: {
          session: {
            select: {
              id: true,
              eventId: true,
              title: true,
              startTime: true,
              endTime: true,
              openAt: true,
              closeAt: true,
              geofenceRadius: true,
              venueLatitude: true,
              venueLongitude: true,
              locationAccuracy: true,
              createdBy: true,
              createdAt: true,
              updatedAt: true,
              event: { select: { title: true } },
            },
          },
        },
      });
      let nextCursor = undefined;
      if (records.length > limit) {
        const nextItem = records.pop();
        nextCursor = nextItem!.id;
      }
      return { data: records, nextCursor };
    });
  }

  async manualMarkAttendance(
    userId: string,
    eventIdOrPayload: string | { session_id: string; user_id: string },
    maybePayload?: { session_id: string; user_id: string }
  ) {
    let eventId: string | undefined;
    let payload: { session_id: string; user_id: string };

    if (typeof eventIdOrPayload === 'string') {
      eventId = eventIdOrPayload;
      payload = maybePayload!;
    } else {
      payload = eventIdOrPayload;
    }

    try {
      const result = await withUserContext(userId, async (tx) => {
        const session = await tx.attendanceSession.findUnique({
          where: { id: payload.session_id },
          select: { eventId: true },
        });

        if (!session) throw new NotFoundError('Session not found');
        if (eventId && session.eventId !== eventId) {
          throw new NotFoundError('Session not found in this event');
        }
        
        const event = await tx.event.findUnique({
          where: { id: session.eventId },
          select: { state: true, isLocked: true, endTime: true }
        });
        
        if (event) {
          const dbTimeResult = await tx.$queryRaw<{ now: Date }[]>`SELECT now() as now`;
          const dbNow = dbTimeResult[0].now;
          const finalDeadline = new Date(event.endTime.getTime() + 24 * 60 * 60 * 1000);
          
          if (event.state !== 'PUBLISHED' || event.isLocked || dbNow >= finalDeadline) {
            throw new UnprocessableEntityError('EVENT_LOCKED');
          }
        }

        return await tx.$queryRaw<any[]>`
          WITH rpc AS (
            SELECT * FROM manual_mark_attendance(${payload.session_id}::uuid, ${payload.user_id}::uuid)
          )
          SELECT rpc.*, current_setting('app.attendance_is_new', true) as is_new
          FROM rpc
        `;
      });
      if (!result || result.length === 0) throw new Error('Failed to manually mark attendance');
      const attendanceRecord = result[0];
      const is_new = attendanceRecord.is_new === 'true';
      return { attendance_record: attendanceRecord, is_new };
    } catch (error: unknown) {
      if ((error as any).statusCode) throw error;
      mapDatabaseError(error);
    }
  }

  async submitAttendanceDispute(userId: string, payload: { session_id: string; reason: string; evidence_urls?: string[] }) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
        return await tx.$queryRaw<any[]>`
          SELECT * FROM submit_attendance_dispute(
            ${payload.session_id}::uuid,
            ${payload.reason},
            ${payload.evidence_urls ? payload.evidence_urls : null}::text[]
          )
        `;
      });
      if (!result || result.length === 0) throw new Error('Failed to submit dispute');
      return result[0];
    } catch (error: unknown) {
      mapDatabaseError(error);
    }
  }

  async getAttendanceDisputes(userId: string, eventId: string | undefined, query: any): Promise<{ data: any[]; nextCursor?: string }> {
    return withUserContext(userId, async (tx) => {
      const { cursor, limit, filter_status, filter_club_id } = query;
      const where: any = {};
      if (eventId) where.eventId = eventId;
      if (filter_status) where.status = filter_status;
      
      if (filter_club_id) {
        where.event = {
          eventClubs: { some: { clubId: filter_club_id } }
        };

        // Explicitly verify the caller's authority over that club.
        const user = await tx.user.findUnique({ where: { id: userId }, select: { globalRole: true } });
        if (user && !['PLATFORM_ADMIN', 'FACULTY_ADMIN'].includes(user.globalRole)) {
          const membership = await tx.clubMembership.findFirst({
            where: {
              clubId: filter_club_id,
              userId: userId,
              deletedAt: null,
              role: { in: ['CLUB_ADMIN', 'CORE_MEMBER', 'FACULTY_MENTOR'] },
            }
          });
          if (!membership) {
            throw new ForbiddenError('Unauthorized to view disputes for this club');
          }
        }
      }

      const disputes = await tx.attendanceDispute.findMany({
        where,
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true } } },
      });
      let nextCursor = undefined;
      if (disputes.length > limit) {
        const nextItem = disputes.pop();
        nextCursor = nextItem!.id;
      }
      return { data: disputes, nextCursor };
    });
  }

  async resolveAttendanceDispute(userId: string, disputeId: string, payload: { resolution: string; review_notes?: string }) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
        const rpcResult = await tx.$queryRaw<any[]>`
          SELECT * FROM resolve_attendance_dispute(
            ${disputeId}::uuid,
            ${payload.resolution},
            ${payload.review_notes || null}
          )
        `;

        if (!rpcResult || rpcResult.length === 0) throw new Error('Failed to resolve dispute');

        const dispute = await tx.attendanceDispute.findUnique({
          where: { id: disputeId },
          include: { event: { select: { title: true } } },
        });

        if (dispute) {
          await enqueueNotification({
            tx,
            userId: dispute.userId,
            type: 'ATTENDANCE_DISPUTE_RESOLVED',
            title: `Attendance Dispute ${payload.resolution}`,
            body: `Your dispute for ${dispute.event.title} has been ${payload.resolution}.`,
            metadata: {
              schema_version: 1,
              routing: { target: `/attendance/disputes/${disputeId}`, fallback: '/attendance/disputes', params: { dispute_id: disputeId } },
              entity_ids: { event_id: dispute.eventId, dispute_id: disputeId },
              action_payload: { status: payload.resolution },
            },
            preferenceGate: 'attendance_alerts',
            idempotencyString: `ATTENDANCE_DISPUTE_RESOLVED${dispute.userId}${disputeId}${payload.resolution}`,
          });
        }

        return rpcResult[0];
      });
      return result;
    } catch (error: unknown) {
      mapDatabaseError(error);
    }
  }

  async reviewFlaggedAttendance(userId: string, attendanceId: string) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
        const rpcResult = await tx.$queryRaw<any[]>`
          SELECT * FROM review_flagged_attendance(
            ${attendanceId}::uuid
          );
        `;
        return rpcResult[0];
      });
      return result;
    } catch (error: any) {
      if (error.message.includes('UNAUTHORIZED_REVIEWER') || error.message.includes('UNAUTHORIZED') || error.message.includes('permission denied')) {
        throw new ForbiddenError('Forbidden');
      }
      if (error.message.includes('ATTENDANCE_NOT_FOUND')) {
        throw new NotFoundError('Attendance record not found');
      }
      if (error.message.includes('ATTENDANCE_NOT_FLAGGED')) {
        throw new BadRequestError('Attendance is not flagged for collision');
      }
      throw error;
    }
  }

  /**
   * Streams event attendance records in cursor-based batches as CSV.
   * - Uses cursor pagination (500 rows per batch) ordered by (markedAt, id) for stable, bounded-memory streaming
   * - Sanitizes all cell values to protect against CSV / Spreadsheet formula injection (=, +, -, @)
   * - Streams directly to outputStream (e.g. Express Response) if provided, or returns accumulated CSV string
   */
  async exportEventAttendance(
    userId: string,
    eventId: string,
    outputStream?: NodeJS.WritableStream
  ): Promise<string> {
    const BATCH_SIZE = 500;
    const header = 'user_name,user_email,session_title,status,method,marked_at\n';

    // Formula injection (CSV injection) sanitizer
    const sanitizeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return /^[=+\-@]/.test(str) ? "'" + str : str;
    };

    const writeChunk = async (chunk: string) => {
      if (!outputStream) return;
      const canWrite = outputStream.write(chunk);
      if (!canWrite && 'once' in outputStream && typeof (outputStream as any).once === 'function') {
        await new Promise<void>((resolve) => {
          (outputStream as any).once('drain', resolve);
        });
      }
    };

    if (outputStream) {
      await writeChunk(header);
    }

    // 1. Pre-fetch sessions belonging to this event with user context for authorization
    const sessions = await withUserContext(userId, (tx) =>
      tx.attendanceSession.findMany({
        where: { eventId },
        select: { id: true, title: true },
      })
    );

    const sessionIds = sessions.map((s) => s.id);
    if (sessionIds.length === 0) {
      if (outputStream) {
        outputStream.end();
        return '';
      }
      return header;
    }

    const sessionMap = new Map<string, string>();
    for (const s of sessions) {
      sessionMap.set(s.id, s.title);
    }

    let accumulatedCsv = outputStream ? '' : header;
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      // Fetch each 500-row batch independently to ensure bounded memory and avoid transaction timeouts
      const batch: any[] = await withUserContext(userId, (tx) =>
        tx.attendanceRecord.findMany({
          where: {
            sessionId: { in: sessionIds },
          },
          take: BATCH_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          select: {
            id: true,
            sessionId: true,
            status: true,
            method: true,
            markedAt: true,
            user: { select: { fullName: true, email: true } },
          },
          orderBy: [
            { markedAt: 'asc' },
            { id: 'asc' },
          ],
        })
      );

      if (batch.length === 0) {
        break;
      }

      let batchCsv = '';
      for (const record of batch) {
        const name = `"${sanitizeCsv(record.user?.fullName)}"`;
        const email = `"${sanitizeCsv(record.user?.email)}"`;
        const sessionTitle = `"${sanitizeCsv(sessionMap.get(record.sessionId) || '')}"`;
        const status = record.status;
        const method = record.method;
        const markedAt =
          record.markedAt instanceof Date
            ? record.markedAt.toISOString()
            : String(record.markedAt);

        batchCsv += `${name},${email},${sessionTitle},${status},${method},${markedAt}\n`;
      }

      if (outputStream) {
        await writeChunk(batchCsv);
      } else {
        accumulatedCsv += batchCsv;
      }

      if (batch.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        cursor = batch[batch.length - 1].id;
      }
    }

    if (outputStream) {
      outputStream.end();
      return '';
    }

    return accumulatedCsv;
  }
}

export const attendanceService = new AttendanceService();
