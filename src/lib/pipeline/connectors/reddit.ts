import Parser from 'rss-parser';
import { RawSignal, SourceConnector, RegionConfig, CategoryConfig, SourceConfig } from './base';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  }
});

export class RedditConnector implements SourceConnector {
  private getSubredditForCategory(categoryId: string, regionId: string): string {
    switch (categoryId) {
      case 'ai_tech':
        if (regionId === 'india') return 'developersIndia';
        return 'technology';
      case 'markets_innovation':
        if (regionId === 'india') return 'IndiaInvestments';
        if (regionId === 'europe') return 'UKInvesting';
        return 'investing';
      case 'gaming':
        if (regionId === 'india') return 'IndianGaming';
        return 'gaming';
      case 'sports':
        if (regionId === 'india') return 'cricket';
        if (regionId === 'europe') return 'soccer';
        return 'sports';
      case 'viral_social':
        if (regionId === 'india') return 'IndianDankMemes';
        if (regionId === 'europe') return 'casualuk';
        return 'TikTokCringe';
      case 'entertainment_culture':
        if (regionId === 'india') return 'bollywood';
        return 'movies';
      default:
        return 'all';
    }
  }

  async fetchSignals(input: {
    region: RegionConfig;
    category: CategoryConfig;
    sourceConfig: SourceConfig;
    timeWindowHours: number;
    keywords: string[];
    currentDate?: Date;
  }): Promise<RawSignal[]> {
    const { region, category, sourceConfig, keywords, currentDate } = input;
    const subreddit = this.getSubredditForCategory(category.id, region.id);
    const url = `https://www.reddit.com/r/${subreddit}/.rss`;

    try {
      console.log(`[RedditConnector] Fetching Reddit RSS feed r/${subreddit} for ${region.id} / ${category.id}...`);
      const feed = await parser.parseURL(url);
      const items = feed.items || [];
      const signals: RawSignal[] = [];

      for (const item of items) {
        const title = item.title || '';
        const content = item.contentSnippet || item.content || '';
        const postUrl = item.link || '';
        const author = item.author || 'Reddit Creator';
        const publishedAt = item.pubDate ? new Date(item.pubDate) : (currentDate || new Date());
        const referenceTime = currentDate ? currentDate.getTime() : Date.now();

        // Check if within time window
        const ageHours = (referenceTime - publishedAt.getTime()) / (1000 * 60 * 60);
        if (ageHours > input.timeWindowHours) continue;

        // Keyword Matching
        const matchesKeyword = keywords.some(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(title) || regex.test(content);
        });

        if (matchesKeyword) {
          const mockViews = Math.floor(Math.random() * 60000) + 1000;
          const mockUpvotes = Math.floor(mockViews * 0.01) + 10;
          const mockComments = Math.floor(mockUpvotes * 0.2) + 2;

          signals.push({
            regionId: region.id,
            categoryId: category.id,
            sourceId: sourceConfig.id,
            sourceType: 'forum',
            title,
            url: postUrl,
            author,
            publishedAt,
            rawText: content,
            engagement: {
              upvotes: mockUpvotes,
              comments: mockComments,
              likes: mockUpvotes,
              views: mockViews
            },
            metadata: {
              subreddit,
              author
            }
          });
        }
      }

      console.log(`[RedditConnector] Discovered ${signals.length} relevant signals on Reddit RSS.`);
      return signals;
    } catch (error) {
      console.error(`[RedditConnector] Error fetching Reddit signals:`, error);
      return [];
    }
  }
}
