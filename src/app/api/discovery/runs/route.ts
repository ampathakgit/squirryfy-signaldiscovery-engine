import supabase from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date'); // YYYY-MM-DD
  const startDateParam = searchParams.get('startDate'); // YYYY-MM-DD
  const endDateParam = searchParams.get('endDate'); // YYYY-MM-DD

  try {
    let query = supabase
      .from('discovery_runs')
      .select('*');

    if (dateParam) {
      const dateStart = `${dateParam}T00:00:00.000Z`;
      const dateEnd = `${dateParam}T23:59:59.999Z`;
      query = query.gte('started_at', dateStart).lte('started_at', dateEnd);
    } else if (startDateParam && endDateParam) {
      const dateStart = `${startDateParam}T00:00:00.000Z`;
      const dateEnd = `${endDateParam}T23:59:59.999Z`;
      query = query.gte('started_at', dateStart).lte('started_at', dateEnd);
    }

    const { data: runs, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Map snake_case properties to camelCase for UI compatibility
    const formattedRuns = (runs || []).map(r => ({
      id: r.id,
      status: r.status,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      signalsFoundCount: r.signals_found_count,
      signalsClusteredCount: r.signals_clustered_count,
      finalSignalsGeneratedCount: r.final_signals_generated_count,
      createdAt: r.created_at
    }));

    return NextResponse.json(formattedRuns);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
