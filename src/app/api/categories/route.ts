import supabase from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { data: categories, error } = await supabase
      .from('discovery_categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
