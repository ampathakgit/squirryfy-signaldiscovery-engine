import { NormalizedSignal } from './normalizer';
import { SignalClusterInput } from './clusterer';

export class CanonicalService {
  /**
   * Evaluates a URL and returns a priority score (higher is better) based on category rules
   */
  private static getUrlPriority(sig: NormalizedSignal, categoryId: string): number {
    const url = sig.url.toLowerCase();
    const domain = sig.domain.toLowerCase();

    switch (categoryId) {
      case 'ai_tech':
        // Priority: official company blog, github, trusted news, youtube
        if (url.includes('blog.') || url.includes('/blog') || domain.includes('openai') || domain.includes('anthropic') || domain.includes('nvidia') || domain.includes('google')) {
          return 100; // Company blog / Announcement
        }
        if (domain.includes('github.com')) {
          return 90; // GitHub repo
        }
        if (domain.includes('techcrunch.com') || domain.includes('venturebeat.com') || domain.includes('wired.com') || domain.includes('news.ycombinator.com')) {
          return 80; // Trusted tech article
        }
        if (sig.sourceType === 'video') {
          return 70; // YouTube video
        }
        return 50;

      case 'markets_innovation':
        // Priority: company announcement, SEC filing, trusted finance news, Yahoo/CNBC
        if (url.includes('investor.') || url.includes('ir.') || url.includes('/press-release') || url.includes('/news/')) {
          return 100; // Company announcement / Press release
        }
        if (domain.includes('sec.gov')) {
          return 95; // SEC Filing
        }
        if (domain.includes('reuters.com') || domain.includes('bloomberg.com') || domain.includes('ft.com') || domain.includes('wsj.com')) {
          return 90; // Trusted finance article
        }
        if (domain.includes('finance.yahoo.com') || domain.includes('cnbc.com')) {
          return 80; // Major finance portal
        }
        return 50;

      case 'gaming':
        // Priority: official game announcement, Steam page, YouTube video, trusted gaming news
        if (domain.includes('steampowered.com') || domain.includes('steamcommunity.com')) {
          return 100; // Steam page
        }
        if (url.includes('news') && (domain.includes('playstation') || domain.includes('xbox') || domain.includes('nintendo') || domain.includes('ea.com') || domain.includes('ubisoft'))) {
          return 95; // Official console/publisher announcement
        }
        if (sig.sourceType === 'video') {
          return 90; // YouTube video / Trailer
        }
        if (domain.includes('ign.com') || domain.includes('gamespot.com') || domain.includes('polygon.com') || domain.includes('kotaku.com')) {
          return 80; // Trusted gaming article
        }
        return 50;

      case 'sports':
        // Priority: official sports page, ESPN, YouTube highlight
        if (domain.includes('fifa.com') || domain.includes('olympic.org') || domain.includes('nba.com') || domain.includes('premierleague.com')) {
          return 100; // Official sports site
        }
        if (domain.includes('espn.com') || domain.includes('skysports.com') || domain.includes('bleacherreport.com')) {
          return 90; // ESPN / major sports article
        }
        if (sig.sourceType === 'video') {
          return 80; // YouTube highlights
        }
        return 50;

      case 'viral_social':
        // Priority: original Instagram/TikTok/YouTube/X post
        if (domain.includes('tiktok.com') || domain.includes('instagram.com') || domain.includes('twitter.com') || domain.includes('x.com')) {
          return 100; // Original social media post
        }
        if (domain.includes('reddit.com')) {
          return 90; // Reddit thread
        }
        if (sig.sourceType === 'video') {
          return 80; // YouTube video
        }
        return 50;

      case 'entertainment_culture':
        // Priority: trailer, official announcement, YouTube, trusted entertainment article
        if (url.includes('trailer') || url.includes('teaser')) {
          return 100; // Trailer
        }
        if (url.includes('press') || url.includes('announcement') || domain.includes('netflix.com') || domain.includes('warnerbros')) {
          return 95; // Official studio release
        }
        if (sig.sourceType === 'video') {
          return 90; // YouTube video
        }
        if (domain.includes('variety.com') || domain.includes('hollywoodreporter.com') || domain.includes('deadline.com') || domain.includes('rollingstone.com')) {
          return 80; // Trusted entertainment article
        }
        return 50;

      default:
        return 50;
    }
  }

  /**
   * Picks the best canonical URL from a cluster of signals
   */
  static selectCanonicalUrl(cluster: SignalClusterInput, categoryId: string): { url: string; sourceType: "article" | "video" | "social" | "trend" | "forum" | "official" | "rss"; sourceName: string; articleUrl?: string; } {

    const signals = cluster.signals;
    if (signals.length === 0) {
      throw new Error(`Cannot select canonical URL for empty cluster.`);
    }

    // Sort signals by priority score descending, then by engagement score descending
    const sortedSignals = [...signals].sort((a, b) => {
      const prioA = this.getUrlPriority(a, categoryId);
      const prioB = this.getUrlPriority(b, categoryId);

      if (prioA !== prioB) {
        return prioB - prioA; // Higher priority first
      }

      return b.normalizedScore - a.normalizedScore; // Higher engagement first
    });

    const bestSignal = sortedSignals[0]!;
    // Find a signal in the cluster that represents a specific article/blog (rss/forum/article)
    // and is not a code repository or filings hub
    const articleSignal = cluster.signals.find(s => {
      const urlLower = s.cleanUrl.toLowerCase();
      const isHub = urlLower.includes('github.com') || urlLower.includes('sec.gov') || urlLower.includes('steampowered.com');
      return !isHub && (s.sourceType === 'rss' || s.sourceType === 'forum' || s.sourceType === 'article');
    });
    const articleUrl = articleSignal ? articleSignal.cleanUrl : bestSignal.cleanUrl;

    return {
      url: bestSignal.cleanUrl,
      sourceType: bestSignal.sourceType,
      sourceName: bestSignal.author || 'Internet Source',
      articleUrl
    };
  }
}
