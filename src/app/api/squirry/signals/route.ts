import supabase from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const regionId = searchParams.get('region');
  const categoryId = searchParams.get('category');
  const search = searchParams.get('search');

  try {
    let query = supabase
      .from('discovery_final_signals')
      .select('*, region:discovery_regions(*), category:discovery_categories(*)')
      .not('squirry_response', 'is', null);

    if (regionId && regionId !== 'all') {
      query = query.eq('region_id', regionId);
    }
    if (categoryId && categoryId !== 'all') {
      query = query.eq('category_id', categoryId);
    }

    const { data: signals, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Filter by search query in memory if present to cover nested squirry_response text
    let formattedSignals = (signals || []).map(sig => ({
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
      squirryResponse: sig.squirry_response,
      runId: sig.run_id,
      clusterId: sig.cluster_id,
      createdAt: sig.created_at,
      updatedAt: sig.updated_at,
      regionName: sig.region?.name || sig.region_id,
      categoryName: sig.category?.name || sig.category_id,
    }));

    if (search) {
      const term = search.toLowerCase();
      formattedSignals = formattedSignals.filter(sig => {
        const titleMatch = sig.title?.toLowerCase().includes(term);
        const whyMatch = sig.whySelected?.toLowerCase().includes(term);
        
        // Search inside squirryResponse fields
        const sqData = sig.squirryResponse?.data || {};
        const sqTitleMatch = sqData.title?.toLowerCase().includes(term);
        const sqSummaryMatch = sqData.summary?.toLowerCase().includes(term);
        const sqTagsMatch = sqData.tags?.some((t: string) => t.toLowerCase().includes(term));
        const sqCatMatch = sqData.categories?.some((c: string) => c.toLowerCase().includes(term));

        return titleMatch || whyMatch || sqTitleMatch || sqSummaryMatch || sqTagsMatch || sqCatMatch;
      });
    }

    return NextResponse.json(formattedSignals);
  } catch (error: any) {
    console.error('[Squirry Signals API] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
