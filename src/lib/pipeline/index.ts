import supabase from '@/lib/db';
import { RawSignal, SourceConnector } from './connectors/base';
import { HackerNewsConnector } from './connectors/hackerNews';
import { RedditConnector } from './connectors/reddit';
import { YouTubeConnector } from './connectors/youtube';
import { GoogleTrendsConnector } from './connectors/googleTrends';
import { ProductHuntConnector } from './connectors/productHunt';
import { SportsConnector } from './connectors/sports';
import { FinanceConnector } from './connectors/finance';
import { InstagramStubConnector, TikTokStubConnector } from './connectors/stubs';
import { RssConnector } from './connectors/rss';
import { NormalizerService, NormalizedSignal } from './normalizer';
import { ClustererService, SignalClusterInput } from './clusterer';
import { ScorerService, ScoringWeights } from './scorer';
import { CanonicalService } from './canonical';
import { LLMFactory } from '@/lib/ai/factory';
import { VerificationService } from './verification';

// Map database source IDs to connector instances
const connectorMap: Record<string, SourceConnector> = {
  hacker_news: new HackerNewsConnector(),
  reddit: new RedditConnector(),
  youtube: new YouTubeConnector(),
  google_trends: new GoogleTrendsConnector(),
  product_hunt: new ProductHuntConnector(),
  sports_feed: new SportsConnector(),
  finance_feed: new FinanceConnector(),
  instagram_stub: new InstagramStubConnector(),
  tiktok_stub: new TikTokStubConnector(),
  rss: new RssConnector()
};

export class DiscoveryPipeline {
  /**
   * Main entry point to run the signal discovery pipeline
   */
  static async run(manualRun = false, currentDate?: Date, targetRegionId?: string): Promise<string> {
    const runDate = currentDate || new Date();
    const runDateStr = runDate.toISOString();

    const { data: runRecord, error: runCreateError } = await supabase
      .from('discovery_runs')
      .insert([{
        status: 'RUNNING',
        started_at: runDateStr
      }])
      .select()
      .single();

    if (runCreateError) {
      throw new Error(`Failed to create discovery run log: ${runCreateError.message}`);
    }

    const runId = runRecord.id;
    const log = async (level: 'INFO' | 'WARN' | 'ERROR', message: string, details?: any) => {
      console.log(`[DiscoveryRun ${runId}] [${level}] ${message}`);
      await supabase.from('discovery_run_logs').insert([{
        run_id: runId,
        level,
        message,
        details: details || null
      }]);
    };

    await log('INFO', `Starting discovery pipeline run (Manual Trigger: ${manualRun})`);

    try {
      // 1. Validate required Squirry API credentials
      const squirryApiUrl = process.env.SQUIRRY_API_URL || '';
      const squirryApiKey = process.env.SQUIRRY_API_KEY || '';
      if (!squirryApiUrl || !squirryApiKey) {
        throw new Error('SQUIRRY_API_URL and SQUIRRY_API_KEY environment variables are required but missing.');
      }

      const squirryPromises: Promise<void>[] = [];

      // 2. Load active regions and categories
      const { data: regions, error: regionsError } = await supabase
        .from('discovery_regions')
        .select('*')
        .eq('enabled', true);

      const { data: categories, error: categoriesError } = await supabase
        .from('discovery_categories')
        .select('*')
        .eq('enabled', true);

      if (regionsError || categoriesError || !regions || !categories || regions.length === 0 || categories.length === 0) {
        throw new Error('No enabled regions or categories found in the database. Run seeds first.');
      }

      await log('INFO', `Loaded ${regions.length} regions and ${categories.length} categories.`);

      let totalRawSignalsCount = 0;
      let totalClusteredCount = 0;
      let totalFinalSignalsCount = 0;

      // Initialize LLM for enrichment fallback (Squirry Style)
      let llmProvider: any = null;
      try {
        if (process.env.GEMINI_API_KEY) {
          llmProvider = await LLMFactory.getProvider();
          await log('INFO', `Initialized Gemini Provider (${llmProvider.modelName}) for local enrichment fallback.`);
        }
      } catch (err: any) {
        await log('WARN', `Failed to initialize Gemini Provider: ${err.message}.`);
      }

      // Filter regions if targetRegionId is provided
      let regionsToProcess = regions;
      if (targetRegionId) {
        regionsToProcess = regions.filter(r => r.id === targetRegionId);
        if (regionsToProcess.length === 0) {
          await log('WARN', `Target region "${targetRegionId}" is not enabled or does not exist. Skipping run.`);
          await supabase
            .from('discovery_runs')
            .update({
              status: 'COMPLETED',
              completed_at: new Date().toISOString(),
              signals_found_count: 0,
              signals_clustered_count: 0,
              final_signals_generated_count: 0
            })
            .eq('id', runId);
          return runId;
        }
      }

      // If this is an automatic scheduled run, only process regions where it is currently 6 AM locally
      if (!manualRun) {
        regionsToProcess = regionsToProcess.filter(region => {
          try {
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: region.timezone,
              hour: 'numeric',
              hour12: false
            });
            const hour = parseInt(formatter.format(runDate), 10);
            const isTargetHour = hour === 6;
            
            console.log(`[Scheduler] Checking region ${region.name} (${region.id}) timezone ${region.timezone}: local hour is ${hour}. Process? ${isTargetHour}`);
            return isTargetHour;
          } catch (tzError) {
            console.error(`[Scheduler] Error formatting timezone ${region.timezone} for region ${region.id}:`, tzError);
            return true; // Fallback: process to avoid missing run
          }
        });

        if (regionsToProcess.length === 0) {
          await log('INFO', `No regions are at their local 6 AM. Skipping automatic discovery cycle.`);
          await supabase
            .from('discovery_runs')
            .update({
              status: 'COMPLETED',
              completed_at: new Date().toISOString(),
              signals_found_count: 0,
              signals_clustered_count: 0,
              final_signals_generated_count: 0
            })
            .eq('id', runId);
          return runId;
        }
      }

      // 3. Process each region x category combination
      for (const region of regionsToProcess) {
        for (const category of categories) {
          await log('INFO', `Processing combination: Region=${region.name} (${region.id}), Category=${category.name} (${category.id})`);

          // Load configs
          const { data: config, error: configError } = await supabase
            .from('discovery_category_region_configs')
            .select('*')
            .eq('region_id', region.id)
            .eq('category_id', category.id)
            .maybeSingle();

          if (configError || !config) {
            await log('WARN', `No CategoryRegionConfig found for region=${region.id}, category=${category.id}. Skipping.`);
            continue;
          }

          const { data: sourceWeightRecord, error: weightError } = await supabase
            .from('discovery_source_weight_configs')
            .select('*')
            .eq('region_id', region.id)
            .eq('category_id', category.id)
            .maybeSingle();

          if (weightError || !sourceWeightRecord) {
            await log('WARN', `No SourceWeightConfig found for region=${region.id}, category=${category.id}. Skipping.`);
            continue;
          }

          const weights = sourceWeightRecord.weights as Record<string, number>;

          // Load scoring rule override (or default rule)
          const { data: scoringRules, error: rulesError } = await supabase
            .from('discovery_scoring_rules')
            .select('*')
            .eq('enabled', true);

          if (rulesError || !scoringRules) {
            await log('WARN', `No active scoring rules found. Using defaults.`);
          }

          // Pick category override or fallback to default (where category_id is null)
          const activeRule = scoringRules?.find(r => r.category_id === category.id) || 
                             scoringRules?.find(r => r.category_id === null);

          const scoringWeights = (activeRule?.weights || {
            attention: 0.30,
            velocity: 0.25,
            cross_source_confirmation: 0.20,
            freshness: 0.15,
            source_trust: 0.10
          }) as ScoringWeights;

          // Run connectors in parallel
          const activeSources = Object.keys(weights);
          const rawSignalsBatch: RawSignal[] = [];

          await Promise.all(
            activeSources.map(async (sourceId) => {
              const connector = connectorMap[sourceId];
              if (!connector) {
                await log('WARN', `No connector registered for source=${sourceId}. Skipping.`);
                return;
              }

              // Load source config from DB
              const { data: dbSource } = await supabase
                .from('discovery_sources')
                .select('*')
                .eq('id', sourceId)
                .eq('enabled', true)
                .maybeSingle();

              if (!dbSource) return;

              try {
                const signals = await connector.fetchSignals({
                  region: { id: region.id, name: region.name, timezone: region.timezone, languages: region.languages, enabled: region.enabled },
                  category: { id: category.id, name: category.name, enabled: category.enabled, defaultTopN: category.default_top_n },
                  sourceConfig: { id: dbSource.id, name: dbSource.name, type: dbSource.type, enabled: dbSource.enabled },
                  timeWindowHours: config.time_window_hours,
                  keywords: config.keywords,
                  currentDate: runDate
                });

                rawSignalsBatch.push(...signals);
              } catch (e: any) {
                await log('WARN', `Error fetching signals from source=${sourceId}: ${e.message}`);
              }
            })
          );
          await log('INFO', `Ingested ${rawSignalsBatch.length} raw signals for region=${region.id}, category=${category.id}.`);

          // Save raw signals to DB and normalize
          const savedRawSignals: NormalizedSignal[] = [];
          for (const rawSig of rawSignalsBatch) {
            const normalized = NormalizerService.normalize(rawSig, runDate);
            
            // Heuristic check for regional relevance (only check global sources)
            const isGlobalSource = rawSig.sourceId === 'hacker_news' || rawSig.sourceId === 'product_hunt';
            if (isGlobalSource && !NormalizerService.isRegionallyRelevant(normalized.title, normalized.summary || '', region.id)) {
              await log('INFO', `Skipping raw signal "${normalized.title.substring(0, 45)}" for region=${region.id} due to lack of regional relevance.`);
              continue;
            }
            
            // Save to database
            const { data: dbRaw, error: rawInsertErr } = await supabase
              .from('discovery_raw_signals')
              .insert([{
                region_id: region.id,
                category_id: category.id,
                source_id: rawSig.sourceId,
                source_type: normalized.sourceType.toUpperCase(),
                title: normalized.title,
                url: normalized.url,
                author: normalized.author || null,
                published_at: normalized.publishedAt ? normalized.publishedAt.toISOString() : null,
                summary: normalized.summary || null,
                raw_text: normalized.rawText || null,
                engagement: normalized.engagement || null,
                metadata: normalized.metadata || null,
                normalized: true,
                created_at: runDateStr,
                updated_at: runDateStr
              }])
              .select()
              .single();

            if (rawInsertErr) {
              await log('WARN', `Failed to insert raw signal: ${rawInsertErr.message}`);
              continue;
            }

            savedRawSignals.push({
              ...normalized,
              id: dbRaw.id
            });
          }

          totalRawSignalsCount += savedRawSignals.length;

          // Deduplicate and Cluster
          const clusters = await ClustererService.clusterSignals(savedRawSignals);
          totalClusteredCount += clusters.length;

          await log('INFO', `Clustered ${savedRawSignals.length} raw signals into ${clusters.length} clusters.`);

          // Score clusters
          for (const cluster of clusters) {
            cluster.score = ScorerService.scoreCluster(cluster, scoringWeights, weights, runDate);
          }

          // Sort clusters by score descending
          const sortedClusters = clusters.sort((a, b) => b.score - a.score);

          const topN = config.top_n || category.default_top_n || 3;
          await log('INFO', `Processing sorted clusters to find top ${topN} valid signals...`);

          // Generate final signals
          let signalCounter = 1;
          let generatedCount = 0;
          for (const cluster of sortedClusters) {
            if (generatedCount >= topN) {
              break;
            }

            const canonical = CanonicalService.selectCanonicalUrl(cluster, category.id);
            
            if (!canonical.url) {
              await log('WARN', `Skipping cluster "${cluster.title.substring(0, 45)}" because no canonical URL was found.`);
              continue;
            }

            const supportingUrls = Array.from(new Set(cluster.signals.map(s => s.url).filter(u => u !== canonical.url)));

            // Run Verification Engine on canonical URL
            if (VerificationService.isSpecificResource(canonical.url)) {
              // If it is already a specific resource URL, we KEEP it to point to the same trending item.
              // We check its accessibility and log a warning if it's not live, but we do not replace it.
              const verifyResult = await VerificationService.verifyUrl(canonical.url);
              if (!verifyResult.isValid) {
                await log('WARN', `Canonical URL "${canonical.url}" accessibility warning: ${verifyResult.reason}. Keeping original specific resource link.`);
              }
            } else {
              // If it is a generic URL (e.g. search, explore page), we must replace it.
              await log('WARN', `Canonical URL "${canonical.url}" failed verification: URL represents a generic search, explore, or homepage rather than a specific item. Scanning supporting URLs...`);
              let resolved = false;
              for (const supUrl of supportingUrls) {
                if (VerificationService.isSpecificResource(supUrl)) {
                  canonical.url = supUrl;
                  const matchingSig = cluster.signals.find(s => s.url === supUrl);
                  if (matchingSig) {
                    canonical.sourceName = matchingSig.author || matchingSig.sourceId;
                    canonical.sourceType = matchingSig.sourceType;
                  }
                  resolved = true;
                  await log('INFO', `Successfully recovered. Selected specific supporting URL: "${canonical.url}"`);
                  break;
                }
              }

              if (!resolved) {
                await log('WARN', `Canonical URL "${canonical.url}" failed verification and could not be recovered. Skipping cluster entirely.`);
                continue;
              }
            }

            // Save the cluster first to DB so we can reference it
            const { data: dbCluster, error: clusterErr } = await supabase
              .from('discovery_signal_clusters')
              .insert([{
                region_id: region.id,
                category_id: category.id,
                title: cluster.title,
                summary: cluster.summary || null,
                score: cluster.score,
                created_at: runDateStr,
                updated_at: runDateStr
              }])
              .select()
              .single();

            if (clusterErr) {
              await log('WARN', `Failed to insert cluster: ${clusterErr.message}`);
              continue;
            }

            // Associate raw signals with the database cluster
            const rawSignalIds = cluster.signals.map(s => s.id).filter((id): id is string => !!id);
            await supabase
              .from('discovery_raw_signals')
              .update({ cluster_id: dbCluster.id })
              .in('id', rawSignalIds);

            // Squirry AI Integration - Asynchronous pipeline
            let whySelected = [
              `Top trending item across ${cluster.signals.length} sources.`,
              `Ingested from ${canonical.sourceName} with high regional attention score.`
            ];
            let entities = cluster.signals[0]?.entities || [];

            // 1. Run local Gemini provider to get baseline enrichment immediately
            if (llmProvider) {
              try {
                await log('INFO', `Running local Gemini enrichment fallback for cluster: "${cluster.title.substring(0, 30)}..."`);
                const prompt = `
                Analyze the following trend cluster and enrich it for Squirry Analysis.
                
                Trend Title: "${cluster.title}"
                Trend Summary: "${cluster.summary}"
                Number of Sources: ${cluster.signals.length}
                Primary Source: "${canonical.sourceName}" (${canonical.url})
                Category: "${category.name}"
                Region: "${region.name}"
                
                Respond in STRICT JSON format:
                {
                  "why_selected": ["reason 1", "reason 2"],
                  "entities": ["entity 1", "entity 2"]
                }
                `;

                const aiResponse = await llmProvider.generateContent([{ text: prompt }]);
                let cleanResponse = aiResponse.trim();
                const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  cleanResponse = jsonMatch[0];
                }
                const parsed = JSON.parse(cleanResponse);
                if (parsed.why_selected && Array.isArray(parsed.why_selected)) {
                  whySelected = parsed.why_selected;
                }
                if (parsed.entities && Array.isArray(parsed.entities)) {
                  entities = parsed.entities;
                }
              } catch (aiErr: any) {
                await log('WARN', `Gemini enrichment baseline failed: ${aiErr.message}. Running with static heuristics.`);
              }
            }

            // Save final signal
            const signalId = `sig_${region.id}_${category.id}_${Date.now().toString().slice(-4)}_${signalCounter++}`;

            // Clean title if it contains HTML entities or garbage
            cluster.title = cluster.title.replace(/\u0026amp;/g, '\u0026').replace(/\u0026quot;/g, '"').trim();

            // Insert final signal immediately with baseline data
            const { error: insertError } = await supabase
              .from('discovery_final_signals')
              .insert([{
                signal_id: signalId,
                region_id: region.id,
                category_id: category.id,
                title: cluster.title,
                canonical_url: canonical.url,
                article_url: canonical.articleUrl,
                canonical_source: canonical.sourceName,
                source_type: canonical.sourceType.toUpperCase(),
                score: cluster.score,
                why_selected: whySelected,
                supporting_urls: supportingUrls,
                entities,
                ready_for_squirry_analysis: true,
                run_id: runId,
                cluster_id: dbCluster.id,
                created_at: runDateStr,
                updated_at: runDateStr
              }]);

            if (insertError) {
              await log('ERROR', `Failed to insert final signal "${cluster.title}": ${insertError.message}`);
              continue;
            }

            // 2. Trigger Squirry AI analysis concurrently and collect promises
            const targetUrl = canonical.articleUrl || canonical.url;
            const squirryPromise = (async () => {
              const maxRetries = 3;
              let delay = 2000;
              for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                  console.log(`[Squirry AI ${signalId}] Triggering analysis for: ${targetUrl} (Attempt ${attempt + 1}/${maxRetries})`);
                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                  if (squirryApiKey) {
                    headers['x-api-key'] = squirryApiKey;
                  }

                  // Squirry execution gets a generous 40-second timeout
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 40000);

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
                    throw new Error(`Squirry API returned status code ${squirryResponse.status}`);
                  }

                  const resData = await squirryResponse.json();
                  const squirryData = resData.data;

                  const updateData: Record<string, any> = {
                    squirry_response: resData
                  };
                  if (squirryData.summary) {
                    updateData.why_selected = [squirryData.summary];
                  }
                  if (squirryData.referred_entities && Array.isArray(squirryData.referred_entities)) {
                    updateData.entities = squirryData.referred_entities.map((e: any) => e.entity_name);
                  }
                  if (squirryData.clean_title) {
                    updateData.title = squirryData.clean_title.replace(/\u0026amp;/g, '\u0026').replace(/\u0026quot;/g, '"').trim();
                  }

                  if (Object.keys(updateData).length > 0) {
                    updateData.updated_at = new Date().toISOString();
                    
                    const { error: updateError } = await supabase
                      .from('discovery_final_signals')
                      .update(updateData)
                      .eq('signal_id', signalId);

                    if (updateError) {
                      throw new Error(`Failed to update database record: ${updateError.message}`);
                    }
                    console.log(`[Squirry AI ${signalId}] Successfully enriched signal with Squirry AI!`);
                  }
                  return; // Exit loop and promise on success
                } catch (err: any) {
                  console.error(`[Squirry AI ${signalId}] Attempt ${attempt + 1} failed:`, err.message);
                  if (attempt < maxRetries - 1) {
                    console.log(`[Squirry AI ${signalId}] Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2;
                  } else {
                    throw new Error(`Squirry AI analysis failed for signal "${cluster.title}" (${targetUrl}): ${err.message}`);
                  }
                }
              }
            })();

            squirryPromises.push(squirryPromise);

            // Save Canonical URL details if new
            const { error: upsertError } = await supabase
              .from('discovery_canonical_urls')
              .upsert([{
                url: canonical.url,
                source_type: canonical.sourceType.toUpperCase()
              }], { onConflict: 'url' });

            if (upsertError) {
              await log('WARN', `Failed to upsert canonical URL "${canonical.url}": ${upsertError.message}`);
            }

            totalFinalSignalsCount++;
            generatedCount++;
          }
        }
      }

      // 3. Await all concurrent Squirry AI analyses to complete successfully
      if (squirryPromises.length > 0) {
        await log('INFO', `Awaiting completion of ${squirryPromises.length} Squirry AI analyses...`);
        await Promise.all(squirryPromises);
        await log('INFO', `All ${squirryPromises.length} Squirry AI analyses completed successfully.`);
      }

      // Mark run as completed
      await supabase
        .from('discovery_runs')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          signals_found_count: totalRawSignalsCount,
          signals_clustered_count: totalClusteredCount,
          final_signals_generated_count: totalFinalSignalsCount
        })
        .eq('id', runId);

      await log('INFO', `Discovery pipeline completed successfully. Found ${totalRawSignalsCount} raw signals, generated ${totalFinalSignalsCount} final signals.`);
      return runId;

    } catch (error: any) {
      await log('ERROR', `Pipeline execution failed: ${error.message}`, { stack: error.stack });
      await supabase
        .from('discovery_runs')
        .update({
          status: 'FAILED',
          completed_at: new Date().toISOString()
        })
        .eq('id', runId);
      throw error;
    }
  }
}

// generateSyntheticSignals removed: synthetic fallback signals disabled.
