import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { signalId } = await request.json();
    if (!signalId) {
      return NextResponse.json({ error: 'Missing signalId parameter' }, { status: 400 });
    }

    const squirryApiUrl = process.env.SQUIRRY_API_URL || '';
    const squirryApiKey = process.env.SQUIRRY_API_KEY || '';
    if (!squirryApiUrl || !squirryApiKey) {
      return NextResponse.json(
        { error: 'SQUIRRY_API_URL and SQUIRRY_API_KEY are not configured on the server.' },
        { status: 500 }
      );
    }

    // 1. Fetch the signal details from Supabase
    const { data: sig, error: fetchError } = await supabase
      .from('discovery_final_signals')
      .select('*')
      .eq('signal_id', signalId)
      .single();

    if (fetchError || !sig) {
      return NextResponse.json({ error: `Signal ${signalId} not found: ${fetchError?.message || ''}` }, { status: 404 });
    }

    const targetUrl = sig.article_url || sig.canonical_url;
    if (!targetUrl) {
      return NextResponse.json({ error: 'Signal is missing canonical_url and article_url.' }, { status: 400 });
    }

    console.log(`[Manual Enrichment] Calling Squirry AI /analyze for signal ${signalId} and URL: ${targetUrl}`);

    // 2. Call the Squirry AI API with a generous 40-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (squirryApiKey) {
      headers['x-api-key'] = squirryApiKey;
    }

    const squirryResponse = await fetch(`${squirryApiUrl}/analyze`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        url: targetUrl,
        forceRefresh: false
      })
    });
    clearTimeout(timeoutId);

    if (!squirryResponse.ok) {
      return NextResponse.json(
        { error: `Squirry API returned status code ${squirryResponse.status}` },
        { status: 502 }
      );
    }

    const resData = await squirryResponse.json();
    const squirryData = resData.data;

    if (!squirryData) {
      return NextResponse.json(
        { error: 'Squirry API returned a success status but empty data payload.' },
        { status: 502 }
      );
    }

    // 3. Construct update database payload
    const updateData: Record<string, any> = {
      squirry_response: resData,
      updated_at: new Date().toISOString()
    };
    if (squirryData.summary) {
      updateData.why_selected = [squirryData.summary];
    }
    if (squirryData.referred_entities && Array.isArray(squirryData.referred_entities)) {
      updateData.entities = squirryData.referred_entities.map((e: any) => e.entity_name);
    }
    const titleToUse = squirryData.clean_title || squirryData.title;
    if (titleToUse) {
      updateData.title = titleToUse.replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
    }

    // 4. Update Supabase
    const { error: updateError } = await supabase
      .from('discovery_final_signals')
      .update(updateData)
      .eq('signal_id', signalId);

    if (updateError) {
      return NextResponse.json(
        { error: `Successfully retrieved Squirry analysis, but failed to update Supabase: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log(`[Manual Enrichment] Successfully updated signal ${signalId} in Supabase.`);
    return NextResponse.json({ success: true, message: 'Signal successfully enriched with Squirry AI.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
