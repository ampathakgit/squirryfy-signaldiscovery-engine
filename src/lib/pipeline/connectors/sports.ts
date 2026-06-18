import Parser from 'rss-parser';
import { RawSignal, SourceConnector, RegionConfig, CategoryConfig, SourceConfig } from './base';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  }
});

export class SportsConnector implements SourceConnector {
  async fetchSignals(input: {
    region: RegionConfig;
    category: CategoryConfig;
    sourceConfig: SourceConfig;
    timeWindowHours: number;
    keywords: string[];
    currentDate?: Date;
  }): Promise<RawSignal[]> {
    const { region, category, sourceConfig, keywords, currentDate } = input;

    // Only relevant for Sports category
    if (category.id !== 'sports') {
      return [];
    }

    try {
      console.log(`[SportsConnector] Fetching BBC Sport news for ${region.id}...`);
      const feed = await parser.parseURL('https://feeds.bbci.co.uk/sport/rss.xml');
      const items = feed.items || [];
      const signals: RawSignal[] = [];

      for (const item of items) {
        const title = item.title || '';
        const description = item.contentSnippet || '';
        const url = item.link || '';
        const author = 'BBC Sport';
        const publishedAt = item.pubDate ? new Date(item.pubDate) : (currentDate || new Date());
        const referenceTime = currentDate ? currentDate.getTime() : Date.now();

        // Check if within time window
        const ageHours = (referenceTime - publishedAt.getTime()) / (1000 * 60 * 60);
        if (ageHours > input.timeWindowHours) continue;

        // Keyword Matching
        const matchesKeyword = keywords.some(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(title) || regex.test(description);
        });

        if (matchesKeyword) {
          const mockViews = Math.floor(Math.random() * 80000) + 5000;
          const mockLikes = Math.floor(mockViews * 0.03);

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
              source: 'BBC Sport RSS'
            }
          });
        }
      }

      console.log(`[SportsConnector] Discovered ${signals.length} relevant sports signals.`);
      return signals;
    } catch (error) {
      console.error(`[SportsConnector] Error fetching Sports signals:`, error);
      return [];
    }
  }
}
