import Parser from 'rss-parser';
import { RawSignal, SourceConnector, RegionConfig, CategoryConfig, SourceConfig } from './base';
import { extractSocialMediaLink } from './utils';

// Google Trends RSS namespace fields
type CustomItem = {
  'ht:approx_traffic'?: string;
  'ht:picture'?: string;
  'ht:news_item'?: any[];
};

const parser = new Parser<any, CustomItem>({
  customFields: {
    item: [
      ['ht:approx_traffic', 'approxTraffic'],
      ['ht:picture', 'picture'],
      ['ht:news_item', 'newsItems', { keepArray: true }]
    ]
  }
});

export class GoogleTrendsConnector implements SourceConnector {
  private getGeoForRegion(regionId: string): string {
    switch (regionId) {
      case 'us':
        return 'US';
      case 'india':
        return 'IN';
      case 'europe':
        // Europe is a continent, fall back to DE (Germany) or GB (United Kingdom) as proxy
        return 'GB';
      default:
        return 'US';
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
    const geo = this.getGeoForRegion(region.id);
    const url = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`;

    try {
      console.log(`[GoogleTrendsConnector] Fetching trends for geo=${geo} (${region.id}) / ${category.id}...`);
      const feed = await parser.parseURL(url);
      const items = feed.items || [];
      const signals: RawSignal[] = [];

      for (const item of items) {
        const title = item.title || '';
        const description = item.contentSnippet || '';
        const approxTrafficStr = item.approxTraffic || '10,000+';
        
        // Parse traffic: e.g. "500,000+" -> 500000
        const trafficValue = parseInt(approxTrafficStr.replace(/,/g, '').replace(/\+/g, '')) || 10000;

        // Check keyword matches in trend title, description, or news items headlines
        const matchesKeyword = keywords.some(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          const matchesTitleOrDesc = regex.test(title) || regex.test(description);
          if (matchesTitleOrDesc) return true;

          const newsItems = (item as any).newsItems || [];
          return newsItems.some((n: any) => {
            const newsTitle = n['ht:news_item_title'] || n.news_item_title || n[0] || '';
            const newsSnippet = n['ht:news_item_snippet'] || n.news_item_snippet || '';
            return regex.test(newsTitle) || regex.test(newsSnippet);
          });
        });

        if (matchesKeyword) {
          // Extract associated news items
          const newsItems = (item as any).newsItems || [];
          let newsUrl = `https://trends.google.com/trends/trendingsearches/daily?geo=${geo}`;
          let newsTitle = title;
          let newsSource = 'Google Trends';

          // Google Trends RSS has news articles inside <ht:news_item>
          // We can use the first news item as the main URL for the trend!
          if (newsItems.length > 0) {
            // Wait, newsItems parser could yield an array of parsed nodes
            // Let's extract link and title
            const firstNews = newsItems[0];
            
            // Check nesting (rss-parser sometimes leaves them as objects or arrays)
            const newsLink = firstNews['ht:news_item_url'] || firstNews.news_item_url || firstNews[1] || '';
            const newsItemTitle = firstNews['ht:news_item_title'] || firstNews.news_item_title || firstNews[0] || '';
            const newsItemSource = firstNews['ht:news_item_source'] || firstNews.news_item_source || '';

            if (newsLink) {
              newsUrl = newsLink;
            }
            if (newsItemTitle) {
              newsTitle = `${title}: ${newsItemTitle}`;
            }
            if (newsItemSource) {
              newsSource = newsItemSource;
            }
          }

          let finalUrl = newsUrl;
          let finalSourceType: RawSignal['sourceType'] = 'trend';

          if (category.id === 'viral_social') {
            const socialUrl = await extractSocialMediaLink(newsUrl);
            if (!socialUrl) {
              continue; // Skip trends that don't have an embedded social media post link
            }
            finalUrl = socialUrl;
            finalSourceType = 'social';
          }

          signals.push({
            regionId: region.id,
            categoryId: category.id,
            sourceId: sourceConfig.id,
            sourceType: finalSourceType,
            title: newsTitle,
            url: finalUrl,
            author: newsSource,
            publishedAt: item.pubDate ? new Date(item.pubDate) : (currentDate || new Date()),
            summary: `${title} is trending with ${approxTrafficStr} searches. ${description}`,
            engagement: {
              views: trafficValue,
              upvotes: Math.round(trafficValue * 0.01)
            },
            metadata: {
              traffic: approxTrafficStr,
              trendName: title,
              newsItems: newsItems.map((n: any) => ({
                title: n['ht:news_item_title'] || n.news_item_title || '',
                url: n['ht:news_item_url'] || n.news_item_url || '',
                source: n['ht:news_item_source'] || n.news_item_source || ''
              }))
            }
          });
        }
      }

      console.log(`[GoogleTrendsConnector] Discovered ${signals.length} relevant trend signals.`);
      return signals;
    } catch (error) {
      console.error(`[GoogleTrendsConnector] Error fetching Google Trends signals:`, error);
      return [];
    }
  }
}
