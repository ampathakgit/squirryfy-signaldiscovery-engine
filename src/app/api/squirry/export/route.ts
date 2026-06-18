import supabase from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date'); // Format: YYYY-MM-DD

  if (!dateParam) {
    return NextResponse.json({ error: 'Missing date parameter. Format must be YYYY-MM-DD' }, { status: 400 });
  }

  try {
    const dateStart = new Date(`${dateParam}T00:00:00.000Z`);
    const dateEnd = new Date(`${dateParam}T23:59:59.999Z`);

    const { data: finalSignals, error } = await supabase
      .from('discovery_final_signals')
      .select('*')
      .gte('created_at', dateStart.toISOString())
      .lte('created_at', dateEnd.toISOString())
      .eq('ready_for_squirry_analysis', true)
      .order('score', { ascending: false });

    if (error) throw error;

    const formattedSignals = (finalSignals || []).map(sig => sig.squirry_response || {
      signal_id: sig.signal_id,
      region: sig.region_id,
      category: sig.category_id,
      title: sig.title,
      canonical_url: sig.canonical_url,
      article_url: sig.article_url,
      supporting_urls: sig.supporting_urls,
      score: sig.score,
      entities: sig.entities,
      ready_for_squirry_analysis: sig.ready_for_squirry_analysis
    });

    return NextResponse.json({
      date: dateParam,
      signals: formattedSignals
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
