import supabase from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [regionsResult, categoriesResult] = await Promise.all([
      supabase.from('discovery_regions').select('*').order('name', { ascending: true }),
      supabase.from('discovery_categories').select('*').order('name', { ascending: true }),
    ]);

    if (regionsResult.error) throw regionsResult.error;
    if (categoriesResult.error) throw categoriesResult.error;

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

    return NextResponse.json({ regions, categories });
  } catch (error: any) {
    console.error('[Squirry Filters API] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
