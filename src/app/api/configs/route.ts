import supabase from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [
      regionsResult,
      categoriesResult,
      configsResult,
      weightsResult,
      rulesResult
    ] = await Promise.all([
      supabase.from('discovery_regions').select('*').order('name', { ascending: true }),
      supabase.from('discovery_categories').select('*').order('name', { ascending: true }),
      supabase.from('discovery_category_region_configs').select('*'),
      supabase.from('discovery_source_weight_configs').select('*'),
      supabase.from('discovery_scoring_rules').select('*')
    ]);

    if (regionsResult.error) throw regionsResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (configsResult.error) throw configsResult.error;
    if (weightsResult.error) throw weightsResult.error;
    if (rulesResult.error) throw rulesResult.error;

    // Map snake_case properties to camelCase for UI compatibility
    const formattedCategories = (categoriesResult.data || []).map(c => ({
      id: c.id,
      name: c.name,
      enabled: c.enabled,
      defaultTopN: c.default_top_n,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));

    const formattedConfigs = (configsResult.data || []).map(c => ({
      regionId: c.region_id,
      categoryId: c.category_id,
      keywords: c.keywords,
      excludeKeywords: c.exclude_keywords,
      topN: c.top_n,
      timeWindowHours: c.time_window_hours,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));

    const formattedWeights = (weightsResult.data || []).map(w => ({
      regionId: w.region_id,
      categoryId: w.category_id,
      weights: w.weights,
      createdAt: w.created_at,
      updatedAt: w.updated_at
    }));

    const formattedRules = (rulesResult.data || []).map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      categoryId: r.category_id,
      weights: r.weights,
      enabled: r.enabled,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return NextResponse.json({
      regions: regionsResult.data || [],
      categories: formattedCategories,
      configs: formattedConfigs,
      weights: formattedWeights,
      scoringRules: formattedRules
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
