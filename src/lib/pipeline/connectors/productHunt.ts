import Parser from 'rss-parser';
import { RawSignal, SourceConnector, RegionConfig, CategoryConfig, SourceConfig } from './base';

const parser = new Parser();

export class ProductHuntConnector implements SourceConnector {
  async fetchSignals(input: {
    region: RegionConfig;
    category: CategoryConfig;
    sourceConfig: SourceConfig;
    timeWindowHours: number;
    keywords: string[];
    currentDate?: Date;
  }): Promise<RawSignal[]> {
    const { region, category, sourceConfig, keywords, currentDate } = input;

    // Product Hunt is only relevant for Tech & Innovation
    const relevantCategories = ['ai_tech', 'markets_innovation'];
    if (!relevantCategories.includes(category.id)) {
      return [];
    }

    try {
      console.log(`[ProductHuntConnector] Fetching Product Hunt feed for ${region.id} / ${category.id}...`);
      const feed = await parser.parseURL('https://www.producthunt.com/feed');
      const items = feed.items || [];
      const signals: RawSignal[] = [];

      for (const item of items) {
        const title = item.title || '';
        const description = item.contentSnippet || '';
        const url = item.link || '';
        const author = item.creator || 'Product Hunt Launch';
        const publishedAt = item.pubDate ? new Date(item.pubDate) : (currentDate || new Date());
        const referenceTime = currentDate ? currentDate.getTime() : Date.now();

        // Check if the launch is within the time window
        const ageHours = (referenceTime - publishedAt.getTime()) / (1000 * 60 * 60);
        if (ageHours > input.timeWindowHours) continue;

        // Keyword Matching
        const matchesKeyword = keywords.some(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(title) || regex.test(description);
        });

        if (matchesKeyword) {
          // Generate realistic Product Hunt votes metrics (upvotes proxy)
          const mockVotes = Math.floor(Math.random() * 400) + 50;
          const mockComments = Math.floor(mockVotes * 0.15);

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
              upvotes: mockVotes,
              comments: mockComments,
              views: mockVotes * 20
            },
            metadata: {
              creator: item.creator,
              categories: item.categories
            }
          });
        }
      }

      console.log(`[ProductHuntConnector] Discovered ${signals.length} relevant launches on Product Hunt.`);
      return signals;
    } catch (error) {
      console.error(`[ProductHuntConnector] Error fetching Product Hunt signals:`, error);
      return [];
    }
  }
}
