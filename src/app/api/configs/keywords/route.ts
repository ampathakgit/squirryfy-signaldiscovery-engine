import supabase from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { regionId, categoryId, keywords } = await request.json();
    
    if (typeof regionId !== 'string' || typeof categoryId !== 'string' || !Array.isArray(keywords)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const cleanKeywords = keywords.map((k: string) => k.trim()).filter((k: string) => k.length > 0);

    const { data: updated, error } = await supabase
      .from('discovery_category_region_configs')
      .update({
        keywords: cleanKeywords
      })
      .eq('region_id', regionId)
      .eq('category_id', categoryId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
