import { RawSignal } from './connectors/base';

export interface NormalizedSignal extends RawSignal {
  cleanUrl: string;
  domain: string;
  normalizedScore: number;
  extractedKeywords: string[];
  entities: string[];
}

export class NormalizerService {
  /**
   * Cleans a URL by removing tracking query parameters
   */
  static cleanUrl(urlString: string): { cleanUrl: string; domain: string } {
    try {
      const url = new URL(urlString);
      
      // List of tracking query parameters to remove
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'ref', 'fbclid', 'gclid', 'msclkid', 'twclid', 'spm', 'feature'
      ];
      
      trackingParams.forEach(param => url.searchParams.delete(param));
      
      return {
        cleanUrl: url.toString(),
        domain: url.hostname.replace('www.', '')
      };
    } catch {
      // Fallback if URL is invalid
      return {
        cleanUrl: urlString,
        domain: urlString
      };
    }
  }

  /**
   * Extracts tags/keywords from title and summary using a basic English tokenizer
   */
  static extractKeywords(title: string, summary: string = ''): string[] {
    const text = `${title} ${summary}`.toLowerCase();
    
    // Simple English stop words to filter out
    const stopWords = new Set([
      'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent',
      'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
      'cant', 'cannot', 'could', 'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont',
      'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadnt', 'has', 'hasnt', 'have',
      'havent', 'having', 'he', 'hed', 'hell', 'hes', 'her', 'here', 'heres', 'hers', 'herself', 'him',
      'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im', 'ive', 'if', 'in', 'into', 'is', 'isnt',
      'it', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'not',
      'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
      'own', 'same', 'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such',
      'than', 'that', 'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'theres',
      'these', 'they', 'theyd', 'theyll', 'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too',
      'under', 'until', 'up', 'very', 'was', 'wasnt', 'we', 'wed', 'well', 'were', 'weve', 'werent',
      'what', 'whats', 'when', 'whens', 'where', 'wheres', 'which', 'while', 'who', 'whos', 'whom',
      'why', 'whys', 'with', 'wont', 'would', 'wouldnt', 'you', 'youd', 'youll', 'youre', 'youve', 'your',
      'yours', 'yourself', 'yourselves'
    ]);

    // Tokenize
    const words = text
      .replace(/[^\w\s]/g, ' ') // replace punctuation with space
      .split(/\s+/)             // split by whitespace
      .filter(word => word.length > 2 && !stopWords.has(word)); // filter short words & stop words

    // Return unique keywords (limit to top 8)
    return Array.from(new Set(words)).slice(0, 8);
  }

  /**
   * Normalizes a RawSignal into NormalizedSignal
   */
  static normalize(signal: RawSignal, currentDate?: Date): NormalizedSignal {
    const { cleanUrl, domain } = this.cleanUrl(signal.url);
    const extractedKeywords = this.extractKeywords(signal.title, signal.summary || '');
    
    // Calculate a basic engagement index (0-100) based on raw numbers
    const eng = signal.engagement || {};
    const views = eng.views || 0;
    const likes = eng.likes || 0;
    const comments = eng.comments || 0;
    const upvotes = eng.upvotes || 0;
    const shares = eng.shares || 0;

    // Formula: Likes + Upvotes + 2 * Comments + 3 * Shares + Views / 100
    const rawScore = likes + upvotes + (comments * 2) + (shares * 3) + (views / 100);
    // Log-normalize to a 0-100 scale: log10(rawScore + 1) * 20 (capped at 100)
    const normalizedScore = Math.min(Math.round(Math.log10(rawScore + 1) * 20), 100);

    // Initial placeholder entities based on capitalized words in the title
    const entities = signal.title
      .split(/\s+/)
      .filter(word => /^[A-Z][a-zA-Z]+$/.test(word.replace(/[^\w]/g, '')))
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 2);

    return {
      ...signal,
      cleanUrl,
      domain,
      normalizedScore,
      extractedKeywords,
      entities: Array.from(new Set(entities)),
      publishedAt: signal.publishedAt || currentDate || new Date()
    };
  }

  /**
   * Heuristic check for regional relevance
   */
  static isRegionallyRelevant(title: string, summary: string, regionId: string): boolean {
    const text = `${title} ${summary}`.toLowerCase();

    if (regionId === 'india') {
      const indiaTerms = [
        'india', 'indian', 'delhi', 'mumbai', 'bangalore', 'bhashini', 'krutrim', 
        'ipl', 'cricket', 'bollywood', 'kohli', 'dhoni', 'tata', 'reliance', 'modi', 
        'bcci', 'iit', 'kolkata', 'chennai', 'hyderabad', 'pune', 'bengaluru', 
        'carryminati', 'elvis yadav', 'rahman', 'dosanjh', 'tollywood', 'kollywood',
        'rupee', 'nifty', 'sensex', 'rbi', 'sebi', 't-series', 'salman khan'
      ];
      return indiaTerms.some(term => text.includes(term));
    }

    if (regionId === 'europe') {
      const europeTerms = [
        'europe', 'european', 'uk', 'london', 'paris', 'berlin', 'france', 'germany', 
        'spain', 'italy', 'eu', 'ecb', 'ftse', 'dax', 'cac', 'eurovision', 'bbc', 
        'brussels', 'madrid', 'rome', 'amsterdam', 'geneva', 'zurich', 'euros', 
        'uefa', 'bundesliga', 'la liga', 'canal+', 'glastonbury', 'tomorrowland',
        'pound', 'sterling', 'asml', 'mistral', 'spotify'
      ];
      return europeTerms.some(term => text.includes(term));
    }

    if (regionId === 'us') {
      // Exclude items that are highly specific to other regions to prevent leakage
      const nonUsSpecificTerms = [
        'ipl', 'bollywood', 'tollywood', 'kollywood', 'bcci', 'salman khan', 
        'udit narayan', 'himesh reshammiya', 'bhashini', 'krutrim', 'carryminati', 
        'elvis yadav', 'eurovision', 'ftse', 'dax', 'cac 40'
      ];
      if (nonUsSpecificTerms.some(term => text.includes(term))) {
        return false;
      }
      return true;
    }

    return true;
  }
}
