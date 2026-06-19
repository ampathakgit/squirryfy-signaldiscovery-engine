import supabase from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const regionId = searchParams.get('region');
  const categoryId = searchParams.get('category');
  const runId = searchParams.get('runId');
  const dateParam = searchParams.get('date'); // YYYY-MM-DD
  const startDateParam = searchParams.get('startDate'); // YYYY-MM-DD
  const endDateParam = searchParams.get('endDate'); // YYYY-MM-DD

  try {
    let query = supabase
      .from('discovery_final_signals')
      .select('*, region:discovery_regions(*), category:discovery_categories(*)');

    if (regionId && regionId !== 'all') {
      query = query.eq('region_id', regionId);
    }
    if (categoryId && categoryId !== 'all') {
      query = query.eq('category_id', categoryId);
    }
    if (runId && runId !== 'all') {
      query = query.eq('run_id', runId);
    }
    if (dateParam) {
      const dateStart = `${dateParam}T00:00:00.000Z`;
      const dateEnd = `${dateParam}T23:59:59.999Z`;
      query = query.gte('created_at', dateStart).lte('created_at', dateEnd);
    } else if (startDateParam && endDateParam) {
      const dateStart = `${startDateParam}T00:00:00.000Z`;
      const dateEnd = `${endDateParam}T23:59:59.999Z`;
      query = query.gte('created_at', dateStart).lte('created_at', dateEnd);
    }

    const { data: signals, error } = await query.order('score', { ascending: false });

    if (error) throw error;

    // Map snake_case database properties back to camelCase for Admin UI compatibility
    const formattedSignals = (signals || []).map(sig => ({
      id: sig.id,
      signalId: sig.signal_id,
      regionId: sig.region_id,
      categoryId: sig.category_id,
      title: sig.title,
      canonicalUrl: sig.canonical_url,
      articleUrl: sig.article_url,
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
    }));

    return NextResponse.json(formattedSignals);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
