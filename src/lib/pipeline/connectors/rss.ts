import Parser from 'rss-parser';
import { RawSignal, SourceConnector, RegionConfig, CategoryConfig, SourceConfig } from './base';
import { extractSocialMediaLink } from './utils';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  }
});

export class RssConnector implements SourceConnector {
  private getFeedUrlsForCategory(categoryId: string, regionId: string): string[] {
    switch (categoryId) {
      case 'ai_tech':
        if (regionId === 'us') return ['https://techcrunch.com/feed/'];
        if (regionId === 'india') return ['https://indianexpress.com/section/technology/feed/'];
        return ['http://feeds.bbci.co.uk/news/technology/rss.xml'];
      case 'markets_innovation':
        if (regionId === 'us') return ['https://finance.yahoo.com/news/rssindex'];
        if (regionId === 'india') return ['https://www.moneycontrol.com/rss/MCtopnews.xml'];
        return ['http://feeds.bbci.co.uk/news/business/rss.xml'];
      case 'gaming':
        if (regionId === 'us') return ['https://www.gamespot.com/feeds/news/'];
        if (regionId === 'india') return ['https://in.ign.com/feed.xml'];
        return ['https://www.eurogamer.net/feed/news'];
      case 'sports':
        if (regionId === 'us') return ['https://sports.espn.com/espn/rss/news'];
        if (regionId === 'india') return ['https://www.cricbuzz.com/cricket-news/latest-news/rss'];
        return ['http://feeds.bbci.co.uk/sport/rss.xml'];
      case 'viral_social':
        if (regionId === 'us') {
          return [
            'https://knowyourmeme.com/newsfeed.rss',
            'https://www.dailydot.com/feed/',
            'https://www.tubefilter.com/feed/'
          ];
        }
        if (regionId === 'india') {
          return [
            'https://indianexpress.com/section/trending/feed/'
          ];
        }
        return ['https://metro.co.uk/entertainment/feed/'];
      case 'entertainment_culture':
        if (regionId === 'us') return ['https://www.hollywoodreporter.com/feed/'];
        if (regionId === 'india') return ['https://tooxs.timesofindia.indiatimes.com/rssfeeds/-2128936835.cms'];
        return ['http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml'];
      default:
        return ['http://feeds.bbci.co.uk/news/world/rss.xml'];
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
    const urls = this.getFeedUrlsForCategory(category.id, region.id);
    const signals: RawSignal[] = [];

    await Promise.all(
      urls.map(async (url) => {
        try {
          console.log(`[RssConnector] Fetching RSS feed ${url} for ${region.id} / ${category.id}...`);
          const feed = await parser.parseURL(url);
          const items = feed.items || [];

          for (const item of items) {
            const title = item.title || '';
            const description = item.contentSnippet || item.content || '';
            const itemUrl = item.link || '';
            const author = item.creator || feed.title || 'RSS Publisher';
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
              let finalUrl = itemUrl;
              let finalSourceType: RawSignal['sourceType'] = 'rss';

              if (category.id === 'viral_social') {
                const socialUrl = await extractSocialMediaLink(itemUrl);
                if (!socialUrl) {
                  continue; // Skip news articles that don't link to a social post
                }
                finalUrl = socialUrl;
                finalSourceType = 'social';
              }

              const mockViews = Math.floor(Math.random() * 50000) + 2000;
              const mockLikes = Math.floor(mockViews * 0.02);

              signals.push({
                regionId: region.id,
                categoryId: category.id,
                sourceId: sourceConfig.id,
                sourceType: finalSourceType,
                title,
                url: finalUrl,
                author,
                publishedAt,
                summary: description,
                engagement: {
                  views: mockViews,
                  likes: mockLikes
                },
                metadata: {
                  rssTitle: feed.title,
                  feedUrl: url,
                  originalArticleUrl: itemUrl
                }
              });
            }
          }
        } catch (error: any) {
          // Fail silently for individual feeds to prevent blocking others
          console.warn(`[RssConnector] Error fetching RSS feed ${url}:`, error.message);
        }
      })
    );

    console.log(`[RssConnector] Discovered ${signals.length} relevant signals on RSS.`);
    return signals;
  }
}

