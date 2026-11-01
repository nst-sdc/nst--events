import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Guard 1: Refuse to run in production
  if (process.env.NODE_ENV === 'production') {
    console.error('REFUSING TO RUN: seed-auth-events-500k.ts cannot be executed when NODE_ENV=production.');
    process.exit(1);
  }

  // Guard 2: DATABASE_URL must contain "dev" or "test"
  const dbUrl = process.env.DATABASE_URL || '';
  if (!/dev|test/i.test(dbUrl)) {
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':***@');
    console.error(`REFUSING TO RUN: seed-auth-events-500k.ts requires DATABASE_URL to contain "dev" or "test". Current URL: "${maskedUrl}"`);
    process.exit(1);
  }

  const isCleanup = process.argv.includes('--cleanup');
  if (isCleanup) {
    console.log('--- Cleaning up seeded auth_events rows ---');
    const startTime = Date.now();
    const deletedCount = await prisma.$executeRawUnsafe(`
      DELETE FROM auth_events
      WHERE ip_hash LIKE 'seed500k_%'
         OR app_version IN ('1.0.0', '1.1.0');
    `);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Cleanup complete: deleted ${deletedCount} seeded rows in ${elapsed}s.`);
    const remainingCount = await prisma.authEvent.count();
    console.log(`Remaining rows in auth_events: ${remainingCount}`);
    return;
  }

  console.log('--- Starting 500,000 auth_events seed script ---');

  // Fetch up to 100 sample user IDs
  const sampleUsers = await prisma.user.findMany({
    take: 100,
    select: { id: true },
  });

  const userIdsSql = sampleUsers.length > 0
    ? `ARRAY[${sampleUsers.map((u) => `'${u.id}'::uuid`).join(',')}]`
    : `ARRAY[gen_random_uuid()]`;

  console.log(`Seeding 500k rows into auth_events table using bulk SQL generator...`);
  const startTime = Date.now();

  await prisma.$executeRawUnsafe(`
    INSERT INTO auth_events (
      id,
      user_id,
      event_type,
      platform,
      app_version,
      user_agent_family,
      device_class,
      ip_hash,
      raw_ip,
      network_class,
      failure_reason,
      created_at
    )
    SELECT
      gen_random_uuid() as id,
      CASE
        WHEN r < 0.15 THEN NULL -- 15% unauthenticated / failed attempts without user
        ELSE (users_arr)[floor(random() * array_length(users_arr, 1) + 1)]
      END as user_id,
      CASE
        WHEN r < 0.70 THEN 'LOGIN_SUCCESS'
        WHEN r < 0.85 THEN 'LOGIN_FAILED'
        WHEN r < 0.90 THEN 'REFRESH_FAILED'
        WHEN r < 0.92 THEN 'REUSE_DETECTED'
        WHEN r < 0.98 THEN 'LOGOUT'
        ELSE 'SESSION_REVOKED'
      END as event_type,
      CASE WHEN random() < 0.60 THEN 'web' ELSE 'mobile' END as platform,
      CASE WHEN random() < 0.50 THEN '1.0.0' ELSE '1.1.0' END as app_version,
      CASE
        WHEN random() < 0.40 THEN 'Chrome'
        WHEN random() < 0.70 THEN 'Safari'
        WHEN random() < 0.85 THEN 'Firefox'
        ELSE 'Edge'
      END as user_agent_family,
      CASE
        WHEN random() < 0.55 THEN 'desktop'
        WHEN random() < 0.90 THEN 'mobile'
        WHEN random() < 0.97 THEN 'tablet'
        ELSE 'unknown'
      END as device_class,
      'seed500k_' || md5(random()::text || clock_timestamp()::text) || md5(random()::text) as ip_hash,
      NULL as raw_ip,
      CASE
        WHEN random() < 0.50 THEN 'campus'
        WHEN random() < 0.95 THEN 'off_campus'
        ELSE 'unknown'
      END as network_class,
      CASE
        WHEN r >= 0.70 AND r < 0.85 THEN 'Invalid email or domain not allowed'
        WHEN r >= 0.85 AND r < 0.90 THEN 'Refresh token expired'
        WHEN r >= 0.90 AND r < 0.92 THEN 'Refresh token reuse detected; all sessions revoked'
        WHEN r >= 0.98 THEN 'Admin revoked sessions'
        ELSE NULL
      END as failure_reason,
      -- Distributed over the past 60 days
      NOW() - (random() * interval '60 days') as created_at
    FROM (
      SELECT
        ${userIdsSql} as users_arr,
        random() as r
      FROM generate_series(1, 500000)
    ) s;
  `);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalCount = await prisma.authEvent.count();
  console.log(`Seeding complete: inserted 500k rows in ${elapsed}s. Total rows in auth_events: ${totalCount}`);

  // Vacuum analyze to refresh planner statistics
  console.log('Running ANALYZE on auth_events...');
  await prisma.$executeRawUnsafe('ANALYZE auth_events;');

  console.log('\n======================================================');
  console.log('RUNNING EXPLAIN ANALYZE BENCHMARKS');
  console.log('======================================================\n');

  // Benchmark 1: Stats summary query
  console.log('--- 1. Stats Summary Query (getAuthStats) ---');
  const statsSummaryPlan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(`
    EXPLAIN ANALYZE
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'LOGIN_SUCCESS')::int as total_success,
      COUNT(*) FILTER (WHERE event_type = 'LOGIN_FAILED')::int as total_failed,
      COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'LOGIN_SUCCESS' AND user_id IS NOT NULL AND created_at >= (now() - interval '24 hours'))::int as dau,
      COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'LOGIN_SUCCESS' AND user_id IS NOT NULL AND created_at >= (now() - interval '7 days'))::int as wau
    FROM auth_events
    WHERE created_at >= (now() - interval '7 days') AND created_at <= now();
  `);
  statsSummaryPlan.forEach((row) => console.log(row['QUERY PLAN']));

  // Benchmark 2: Hourly time series query
  console.log('\n--- 2. Hourly Time-Series Aggregation Query ---');
  const timeSeriesPlan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(`
    EXPLAIN ANALYZE
    SELECT
      date_trunc('hour', created_at) as bucket,
      COUNT(*) FILTER (WHERE event_type = 'LOGIN_SUCCESS')::int as success_count,
      COUNT(*) FILTER (WHERE event_type = 'LOGIN_FAILED')::int as failure_count
    FROM auth_events
    WHERE created_at >= (now() - interval '7 days') AND created_at <= now()
    GROUP BY bucket
    ORDER BY bucket ASC;
  `);
  timeSeriesPlan.forEach((row) => console.log(row['QUERY PLAN']));

  // Benchmark 3: Platform breakdown query
  console.log('\n--- 3. Platform Breakdown Query ---');
  const platformPlan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(`
    EXPLAIN ANALYZE
    SELECT platform, COUNT(*)::int as count
    FROM auth_events
    WHERE created_at >= (now() - interval '7 days') AND created_at <= now()
    GROUP BY platform;
  `);
  platformPlan.forEach((row) => console.log(row['QUERY PLAN']));

  // Benchmark 4: List query (no filter, default pagination)
  console.log('\n--- 4. List Query (Default pagination: ORDER BY created_at DESC, id DESC LIMIT 51) ---');
  const listDefaultPlan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(`
    EXPLAIN ANALYZE
    SELECT id, user_id, event_type, platform, app_version, user_agent_family, device_class, ip_hash, raw_ip, network_class, failure_reason, created_at
    FROM auth_events
    ORDER BY created_at DESC, id DESC
    LIMIT 51;
  `);
  listDefaultPlan.forEach((row) => console.log(row['QUERY PLAN']));

  // Benchmark 5: List query with filters (event_type, platform, date range)
  console.log('\n--- 5. List Query (Filtered: event_type = "LOGIN_FAILED", platform = "web") ---');
  const listFilteredPlan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(`
    EXPLAIN ANALYZE
    SELECT id, user_id, event_type, platform, app_version, user_agent_family, device_class, ip_hash, raw_ip, network_class, failure_reason, created_at
    FROM auth_events
    WHERE event_type = 'LOGIN_FAILED' AND platform = 'web'
      AND created_at >= (now() - interval '14 days')
    ORDER BY created_at DESC, id DESC
    LIMIT 51;
  `);
  listFilteredPlan.forEach((row) => console.log(row['QUERY PLAN']));
}

main()
  .catch((err) => {
    console.error('Seed/benchmark failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
