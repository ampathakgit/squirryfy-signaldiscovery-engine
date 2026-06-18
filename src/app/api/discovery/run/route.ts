import { DiscoveryPipeline } from '@/lib/pipeline';
import supabase from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const currentDate = body.currentDate ? new Date(body.currentDate) : undefined;
    const regionId = body.regionId || undefined;
    const manualRun = body.manualRun !== undefined ? body.manualRun : true;

    // Run the pipeline asynchronously to prevent API timeout
    const runPromise = DiscoveryPipeline.run(manualRun, currentDate, regionId);
    
    // Wait briefly (200ms) to let the DB record get created
    const runId = await Promise.race([
      runPromise,
      new Promise<string>((resolve) => setTimeout(() => resolve('async_run_started'), 200))
    ]);

    if (runId === 'async_run_started') {
      const { data: latestRun } = await supabase
        .from('discovery_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return NextResponse.json({ 
        message: 'Discovery run started in background', 
        runId: latestRun?.id || 'pending'
      });
    }

    return NextResponse.json({ 
      message: 'Discovery run completed synchronously', 
      runId 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
