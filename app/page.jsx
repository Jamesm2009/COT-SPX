import { Redis } from '@upstash/redis';
import CTAChart from '@/app/components/CTAChart';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Revalidate page at most once per hour
export const revalidate = 3600;

export default async function Home() {
  let data = null;
  let updatedAt = null;
  let error = null;

  try {
    const cached = await redis.get('cta_tracker_data');
    if (cached) {
      const payload = typeof cached === 'string' ? JSON.parse(cached) : cached;
      data = payload.data;
      updatedAt = payload.updatedAt;
    } else {
      error = 'Database is empty. Run the cron job to seed data.';
    }
  } catch (err) {
    error = err.message;
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4">
      <CTAChart data={data} updatedAt={updatedAt} error={error} />
    </main>
  );
}
