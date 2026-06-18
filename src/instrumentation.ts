import supabase from '@/lib/db';
import { DiscoveryPipeline } from '@/lib/pipeline';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Avoid double-registration during Next.js hot-reloads in development
    if ((globalThis as any)._squirryfySchedulerStarted) {
      return;
    }
    (globalThis as any)._squirryfySchedulerStarted = true;

    console.log('[Scheduler] Initializing in-app hourly discovery scheduler...');

    // Calculate milliseconds remaining until the next top of the hour (HH:00:00)
    const now = new Date();
    const msToNextHour = 3600000 - (now.getMinutes() * 60 * 1000 + now.getSeconds() * 1000 + now.getMilliseconds());

    console.log(`[Scheduler] Next hour alignment in ${(msToNextHour / 60000).toFixed(2)} minutes.`);

    // One-shot timer to align execution with the top of the hour
    setTimeout(() => {
      triggerHourlyRun();

      // Setup recurring interval every 1 hour thereafter
      setInterval(triggerHourlyRun, 3600000);
    }, msToNextHour);
  }
}

async function triggerHourlyRun() {
  // Tier 1: Introduce a randomized jitter (0 to 5 seconds) to break instance synchrony
  const jitterMs = Math.floor(Math.random() * 5000);
  await new Promise((resolve) => setTimeout(resolve, jitterMs));

  console.log(`[Scheduler] Evaluating scheduled run at ${new Date().toISOString()}...`);

  try {
    // Tier 2: Check the database for any runs started in the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentRuns, error } = await supabase
      .from('discovery_runs')
      .select('id, started_at, status')
      .gte('started_at', fifteenMinutesAgo)
      .limit(1);

    if (error) {
      console.error(`[Scheduler] Database check failed: ${error.message}`);
      return;
    }

    // If another instance already created a run, skip this cycle
    if (recentRuns && recentRuns.length > 0) {
      console.log('[Scheduler] Another instance already started the hourly discovery run. Skipping.');
      return;
    }

    console.log('[Scheduler] Lock acquired. Starting automated hourly discovery run...');
    const runId = await DiscoveryPipeline.run(false);
    console.log(`[Scheduler] Automated run completed. Run ID: ${runId}`);
  } catch (err: any) {
    console.error(`[Scheduler] Error during automated hourly run: ${err.message}`);
  }
}
