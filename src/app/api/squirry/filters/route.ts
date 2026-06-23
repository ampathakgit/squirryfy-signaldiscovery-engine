import supabase from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [regionsResult, categoriesResult, signalsResult] = await Promise.all([
      supabase.from('discovery_regions').select('*').order('name', { ascending: true }),
      supabase.from('discovery_categories').select('*').order('name', { ascending: true }),
      supabase.from('discovery_final_signals').select('created_at').not('squirry_response', 'is', null).order('created_at', { ascending: false }),
    ]);

    if (regionsResult.error) throw regionsResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (signalsResult.error) throw signalsResult.error;

    const regions = (regionsResult.data || []).map(r => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled
    }));

    const categories = (categoriesResult.data || []).map(c => ({
      id: c.id,
      name: c.name,
      enabled: c.enabled
    }));

    const datesSet = new Set<string>();
    (signalsResult.data || []).forEach(sig => {
      if (sig.created_at) {
        const d = new Date(sig.created_at);
        if (!isNaN(d.getTime())) {
          datesSet.add(d.toISOString().split('T')[0]);
        }
      }
    });
    const dates = Array.from(datesSet);

    return NextResponse.json({ regions, categories, dates });
  } catch (error: any) {
    console.error('[Squirry Filters API] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
