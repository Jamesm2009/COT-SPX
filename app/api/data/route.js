import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function GET() {
  try {
    const cached = await redis.get('cta_tracker_data');

    if (!cached) {
      return Response.json(
        {
          error: 'No data in database yet.',
          hint: 'Seed the database by visiting /api/cron?secret=YOUR_CRON_SECRET',
        },
        { status: 404 }
      );
    }

    const payload = typeof cached === 'string' ? JSON.parse(cached) : cached;
    return Response.json(payload);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
