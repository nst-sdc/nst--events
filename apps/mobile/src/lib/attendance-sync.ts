import { apiClient } from '../infrastructure/api';

export interface OfflineAttendanceRecord {
  sessionId: string;
  totpToken: string;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
    mocked: boolean;
  };
  device: {
    id: string;
    os: string;
  };
  timestamp: string;
}

export interface SyncResult {
  processed: number;
  skipped: number;
  errors: Array<{ recordId?: string; error: string }>;
}

// TODO (Phase 6): Wire into offline sync lifecycle once approved.
export async function batchSyncOfflineAttendance(records: OfflineAttendanceRecord[]): Promise<SyncResult> {
  const result: SyncResult = { processed: 0, skipped: 0, errors: [] };
  const CHUNK_SIZE = 1000;

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    
    // Map to expected snake_case format for the backend
    const payload = {
      records: chunk.map(r => ({
        session_id: r.sessionId,
        totp_token: r.totpToken,
        location: {
          lat: r.location.lat,
          lng: r.location.lng,
          accuracy: r.location.accuracy,
          mocked: r.location.mocked,
        },
        device: {
          id: r.device.id,
          os: r.device.os,
        },
        timestamp: r.timestamp,
      })),
    };

    try {
      const response: any = await apiClient('/v1/attendance/sync-offline', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      result.processed += response.processed || 0;
      result.skipped += response.skipped || 0;
      if (response.errors && Array.isArray(response.errors)) {
        result.errors.push(...response.errors);
      }
    } catch (err: any) {
      result.errors.push({ 
        error: err.message || 'Chunk failed to sync',
      });
    }
  }

  return result;
}
