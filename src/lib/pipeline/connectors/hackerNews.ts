import { RawSignal, SourceConnector, RegionConfig, CategoryConfig, SourceConfig } from './base';

export class HackerNewsConnector implements SourceConnector {
  async fetchSignals(input: {
    region: RegionConfig;
    category: CategoryConfig;
    sourceConfig: SourceConfig;
    timeWindowHours: number;
    keywords: string[];
    currentDate?: Date;
  }): Promise<RawSignal[]> {
    const { region, category, sourceConfig, keywords, currentDate } = input;
    
    // Hacker News is primarily relevant to AI/Tech and Markets/Innovation.
    // Skip if gaming, sports, viral_social, entertainment.
    const relevantCategories = ['ai_tech', 'markets_innovation'];
    if (!relevantCategories.includes(category.id)) {
      return [];
    }

    try {
      console.log(`[HNConnector] Fetching top stories for ${region.id} / ${category.id}...`);
      // Fetch top 30 story IDs
      const idsResponse = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
      if (!idsResponse.ok) throw new Error(`HN API returned status ${idsResponse.status}`);
      
      const ids: number[] = await idsResponse.json();
      const topIds = ids.slice(0, 30);

      const signals: RawSignal[] = [];

      // Fetch details for each story in parallel
      await Promise.all(
        topIds.map(async (id) => {
          try {
            const itemResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
            if (!itemResponse.ok) return;
            const item = await itemResponse.json();
            
            if (!item || item.type !== 'story') return;

            const title = item.title || '';
            const url = item.url || `https://news.ycombinator.com/item?id=${id}`;
            const text = item.text || '';
            const score = item.score || 0; // upvotes
            const commentsCount = item.descendants || 0;
            const author = item.by || 'anonymous';
            const publishedAt = item.time ? new Date(item.time * 1000) : (currentDate || new Date());

            // Keyword Matching
            const matchesKeyword = keywords.some(keyword => {
              const regex = new RegExp(`\\b${keyword}\\b`, 'i');
              return regex.test(title) || regex.test(text);
            });

            if (matchesKeyword) {
              signals.push({
                regionId: region.id,
                categoryId: category.id,
                sourceId: sourceConfig.id,
                sourceType: 'forum',
                title,
                url,
                author,
                publishedAt,
                rawText: text,
                engagement: {
                  upvotes: score,
                  comments: commentsCount,
                  views: score * 10 // Heuristic view estimation
                },
                metadata: {
                  hnId: id,
                  score,
                  descendants: commentsCount
                }
              });
            }
          } catch (e) {
            console.error(`[HNConnector] Error fetching item ${id}:`, e);
          }
        })
      );

      console.log(`[HNConnector] Discovered ${signals.length} relevant signals on Hacker News.`);
      return signals;
    } catch (error) {
      console.error('[HNConnector] Error fetching Hacker News signals:', error);
      return [];
    }
  }
}
