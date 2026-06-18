import supabase from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Perform nested selects in Supabase to fetch related logs and final signals
    const { data: run, error } = await supabase
      .from('discovery_runs')
      .select('*, logs:discovery_run_logs(*), final_signals:discovery_final_signals(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!run) {
      return NextResponse.json({ error: 'Discovery run not found' }, { status: 404 });
    }

    // Map logs to have camelCase fields
    const formattedLogs = (run.logs || []).map((log: any) => ({
      id: log.id,
      runId: log.run_id,
      level: log.level,
      message: log.message,
      details: log.details,
      createdAt: log.created_at
    })).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Map final signals to have camelCase fields
    const formattedSignals = (run.final_signals || []).map((sig: any) => ({
      id: sig.id,
      signalId: sig.signal_id,
      regionId: sig.region_id,
      categoryId: sig.category_id,
      title: sig.title,
      canonicalUrl: sig.canonical_url,
      canonicalSource: sig.canonical_source,
      sourceType: sig.source_type,
      score: sig.score,
      whySelected: sig.why_selected,
      supportingUrls: sig.supporting_urls,
      entities: sig.entities,
      readyForSquirryAnalysis: sig.ready_for_squirry_analysis,
      runId: sig.run_id,
      clusterId: sig.cluster_id,
      createdAt: sig.created_at,
      updatedAt: sig.updated_at
    })).sort((a: any, b: any) => b.score - a.score);

    const formattedRun = {
      id: run.id,
      status: run.status,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      signalsFoundCount: run.signals_found_count,
      signalsClusteredCount: run.signals_clustered_count,
      finalSignalsGeneratedCount: run.final_signals_generated_count,
      createdAt: run.created_at,
      logs: formattedLogs,
      finalSignals: formattedSignals
    };

    return NextResponse.json(formattedRun);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
