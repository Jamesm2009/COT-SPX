import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const VALID_ASSETS = ['spx', 'ndx', 'rut', 'ust10', 'usd', 'gold', 'copper', 'oil'];

export async function GET(request) {
  try {
    const asset = new URL(request.url).searchParams.get('asset') || 'spx';
    if (!VALID_ASSETS.includes(asset)) {
      return Response.json({ error: 'Invalid asset' }, { status: 400 });
    }
    const cached = await redis.get(`cta_data_${asset}`);
    if (!cached) {
      return Response.json(
        { error: `No data for ${asset}.`, hint: 'Seed the database first.' },
        { status: 404 }
      );
    }
    const payload = typeof cached === 'string' ? JSON.parse(cached) : cached;
    return Response.json(payload);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
