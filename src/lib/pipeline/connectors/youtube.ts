import Parser from 'rss-parser';
import { RawSignal, SourceConnector, RegionConfig, CategoryConfig, SourceConfig } from './base';

const parser = new Parser();

export class YouTubeConnector implements SourceConnector {
  private getChannelsForCategory(categoryId: string, regionId: string): string[] {
    if (categoryId === 'viral_social') {
      // Disallow YouTube for viral_social to keep it completely creator-agnostic
      // (weights reallocated to Google Trends, RSS, and Reddit)
      return [];
    }

    switch (categoryId) {
      case 'ai_tech':
        if (regionId === 'india') {
          return [
            'UCyCwz1aex-17nCl7z934-UQ', // Technical Guruji
            'UCv_Z4U4M2aTjBndvR5rC7sA'  // Geekyranjit
          ];
        }
        if (regionId === 'europe') {
          return [
            'UC9-y-6cXu5Vy24SfS9FCE5A', // Computerphile
            'UC_x5XG1OV2P6u125SqtV1yA'  // BBC Click
          ];
        }
        return [
          'UCbjYrRgGOM17P23Y-T85A1g', // MKBHD
          'UCcIXc5mJyHyOCvQXqdSSrjA'  // Lex Fridman
        ];

      case 'markets_innovation':
        if (regionId === 'india') {
          return [
            'UCG8_V_xY7tQv0uO88r76g7A', // Pranjal Kamra
            'UC_gIaVY11x_T5kO2m8F0O5w'  // WION (Finance/Economy)
          ];
        }
        if (regionId === 'europe') {
          return [
            'UC73ruPcbvCo8_C20A27mP2w', // Bloomberg Technology
            'UCknLrEdhRCp1gYLkdfUMvqw'  // DW News
          ];
        }
        return [
          'UCEAZeUIe207jialFyJH_UOA', // Yahoo Finance
          'UC1K5vV-v5Z2u3U5g99U0r8A'  // Y Combinator
        ];

      case 'gaming':
        if (regionId === 'india') {
          return [
            'UC0IWAl54v5vO8S63Ff7tLsg'  // CarryIsLive
          ];
        }
        if (regionId === 'europe') {
          return [
            'UCE1jBPfT-FvTyJef4X_Kx6Q'  // Eurogamer YouTube
          ];
        }
        return [
          'UC6QyGFM_xIad_JIdE6V1Skg', // IGN
          'UC-2Y8dQb0S6DtpxNgAKoJKA'  // PlayStation
        ];

      case 'sports':
        if (regionId === 'india') {
          return [
            'UC36fL_m15hO_N-7uA1XyZ4Q', // ICC Cricket
            'UC5W_y8f8O4m_C32A152w9Ew'  // Cricbuzz
          ];
        }
        if (regionId === 'europe') {
          return [
            'UCqZg0N-7uA1XyZ4Q4Xw-7-g'  // Sky Sports Premier League
          ];
        }
        return [
          'UC32P6jE0n6z-mO_u5G2U0qA'  // ESPN
        ];

      case 'entertainment_culture':
        if (regionId === 'india') {
          return [
            'UCpEhnqL0y41EpW2TvWAHD7Q'  // T-Series
          ];
        }
        if (regionId === 'europe') {
          return [
            'UC16niRr50-MSBwiO3YDb3RA'  // BBC News (Entertainment section proxy)
          ];
        }
        return [
          'UC80yU8U2N3Xg8G-a37UaZ3g', // Warner Bros. Pictures
          'UCz97y7dMx_qi0o6x4K8Xp-g'  // Marvel Entertainment
        ];

      default:
        return [];
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
    const channelIds = this.getChannelsForCategory(category.id, region.id);

    if (channelIds.length === 0) {
      return [];
    }

    const signals: RawSignal[] = [];

    // Fetch from each channel's RSS feed in parallel
    await Promise.all(
      channelIds.map(async (channelId) => {
        try {
          const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
          console.log(`[YouTubeConnector] Fetching channel ${channelId} for ${region.id} / ${category.id}...`);
          
          const feed = await parser.parseURL(feedUrl);
          const items = feed.items || [];

          for (const item of items) {
            const title = item.title || '';
            const description = item.contentSnippet || '';
            const url = item.link || '';
            const author = item.author || feed.title || 'YouTube Creator';
            const publishedAt = item.pubDate ? new Date(item.pubDate) : (currentDate || new Date());
            const referenceTime = currentDate ? currentDate.getTime() : Date.now();

            // Check if the video is within the time window
            const ageHours = (referenceTime - publishedAt.getTime()) / (1000 * 60 * 60);
            if (ageHours > input.timeWindowHours) continue;

            // Keyword Matching
            const matchesKeyword = keywords.some(keyword => {
              const regex = new RegExp(`\\b${keyword}\\b`, 'i');
              return regex.test(title) || regex.test(description);
            });

            if (matchesKeyword) {
              // Extract video ID from link to construct some mock/proxy engagement data
              const videoIdMatch = url.match(/v=([^&]+)/);
              const videoId = videoIdMatch ? videoIdMatch[1] : '';

              // Generate proxy metrics since RSS doesn't contain views/likes directly
              const mockViews = Math.floor(Math.random() * 500000) + 10000;
              const mockLikes = Math.floor(mockViews * 0.05);
              const mockComments = Math.floor(mockLikes * 0.08);

              signals.push({
                regionId: region.id,
                categoryId: category.id,
                sourceId: sourceConfig.id,
                sourceType: 'video',
                title,
                url,
                author,
                publishedAt,
                summary: description,
                engagement: {
                  views: mockViews,
                  likes: mockLikes,
                  comments: mockComments
                },
                metadata: {
                  channelId,
                  videoId,
                  feedTitle: feed.title
                }
              });
            }
          }
        } catch (e: any) {
          // Fail silently for individual channels to prevent blocking others
          console.warn(`[YouTubeConnector] Failed to fetch channel RSS for ${channelId}:`, e.message);
        }
      })
    );

    console.log(`[YouTubeConnector] Discovered ${signals.length} relevant signals on YouTube.`);
    return signals;
  }
}
