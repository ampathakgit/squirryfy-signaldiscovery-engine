import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const region = searchParams.get("region");
    const category = searchParams.get("category");

    // Perform select with inner join on discovery_final_signals
    let query = supabase
      .from("instagram_posts")
      .select(`
        *,
        discovery_final_signals!inner (
          title,
          score,
          category_id,
          region_id
        )
      `)
      .order("created_at", { ascending: false });

    // 1. Date filtering
    if (dateParam) {
      const dateStart = new Date(`${dateParam}T00:00:00.000Z`);
      const dateEnd = new Date(`${dateParam}T23:59:59.999Z`);
      query = query.gte("created_at", dateStart.toISOString()).lte("created_at", dateEnd.toISOString());
    } else if (startDateParam && endDateParam) {
      const dateStart = new Date(`${startDateParam}T00:00:00.000Z`);
      const dateEnd = new Date(`${endDateParam}T23:59:59.999Z`);
      query = query.gte("created_at", dateStart.toISOString()).lte("created_at", dateEnd.toISOString());
    }

    // 2. Region filtering (on joined table)
    if (region && region !== "all") {
      query = query.eq("discovery_final_signals.region_id", region);
    }

    // 3. Category filtering (on joined table)
    if (category && category !== "all") {
      query = query.eq("discovery_final_signals.category_id", category);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal Server Error" }, { status: 500 });
  }
}
