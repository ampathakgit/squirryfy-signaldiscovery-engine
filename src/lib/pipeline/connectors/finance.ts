import Parser from 'rss-parser';
import { RawSignal, SourceConnector, RegionConfig, CategoryConfig, SourceConfig } from './base';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  }
});

export class FinanceConnector implements SourceConnector {
  async fetchSignals(input: {
    region: RegionConfig;
    category: CategoryConfig;
    sourceConfig: SourceConfig;
    timeWindowHours: number;
    keywords: string[];
    currentDate?: Date;
  }): Promise<RawSignal[]> {
    const { region, category, sourceConfig, keywords, currentDate } = input;

    // Only relevant for Markets & Innovation
    if (category.id !== 'markets_innovation') {
      return [];
    }

    try {
      console.log(`[FinanceConnector] Fetching Yahoo Finance index for ${region.id}...`);
      const feed = await parser.parseURL('https://finance.yahoo.com/news/rssindex');
      const items = feed.items || [];
      const signals: RawSignal[] = [];

      const referenceTime = currentDate ? currentDate.getTime() : Date.now();

      for (const item of items) {
        const title = item.title || '';
        const description = item.contentSnippet || '';
        const url = item.link || '';
        const author = item.creator || 'Yahoo Finance';
        const publishedAt = item.pubDate ? new Date(item.pubDate) : (currentDate || new Date());

        // Check if within time window
        const ageHours = (referenceTime - publishedAt.getTime()) / (1000 * 60 * 60);
        if (ageHours > input.timeWindowHours) continue;

        // Keyword Matching
        const matchesKeyword = keywords.some(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(title) || regex.test(description);
        });

        if (matchesKeyword) {
          const mockViews = Math.floor(Math.random() * 100000) + 8000;
          const mockLikes = Math.floor(mockViews * 0.01);

          signals.push({
            regionId: region.id,
            categoryId: category.id,
            sourceId: sourceConfig.id,
            sourceType: 'rss',
            title,
            url,
            author,
            publishedAt,
            summary: description,
            engagement: {
              views: mockViews,
              likes: mockLikes
            },
            metadata: {
              source: 'Yahoo Finance RSS'
            }
          });
        }
      }

      console.log(`[FinanceConnector] Discovered ${signals.length} relevant finance signals.`);
      return signals;
    } catch (error) {
      console.error(`[FinanceConnector] Error fetching Finance signals:`, error);
      return [];
    }
  }
}
