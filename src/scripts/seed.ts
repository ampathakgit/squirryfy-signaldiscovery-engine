import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import supabase from '../lib/db';

async function main() {
  console.log('🌱 Start seeding Supabase database (public schema with discovery_* prefix)...');

  // 1. Regions
  const regions = [
    { id: 'us', name: 'United States', timezone: 'America/New_York', languages: ['en'], enabled: true },
    { id: 'india', name: 'India', timezone: 'Asia/Kolkata', languages: ['en', 'hi'], enabled: true },
    { id: 'europe', name: 'Europe', timezone: 'Europe/London', languages: ['en', 'fr', 'de', 'es'], enabled: true },
  ];

  for (const region of regions) {
    const { error } = await supabase.from('discovery_regions').upsert([region]);
    if (error) console.error(`Error seeding region ${region.id}:`, error.message);
  }
  console.log(`✅ Seeded ${regions.length} regions.`);

  // 2. Categories
  const categories = [
    { id: 'ai_tech', name: 'AI & Technology', enabled: true, default_top_n: 3 },
    { id: 'markets_innovation', name: 'Markets & Innovation', enabled: true, default_top_n: 3 },
    { id: 'gaming', name: 'Gaming', enabled: true, default_top_n: 3 },
    { id: 'sports', name: 'Sports', enabled: true, default_top_n: 3 },
    { id: 'viral_social', name: 'Viral Social', enabled: true, default_top_n: 3 },
    { id: 'entertainment_culture', name: 'Entertainment & Culture', enabled: true, default_top_n: 3 },
  ];

  for (const cat of categories) {
    const { error } = await supabase.from('discovery_categories').upsert([cat]);
    if (error) console.error(`Error seeding category ${cat.id}:`, error.message);
  }
  console.log(`✅ Seeded ${categories.length} categories.`);

  // 3. Sources
  const sources = [
    { id: 'hacker_news', name: 'Hacker News', type: 'FORUM', enabled: true },
    { id: 'youtube', name: 'YouTube', type: 'VIDEO', enabled: true },
    { id: 'reddit', name: 'Reddit', type: 'FORUM', enabled: true },
    { id: 'rss', name: 'Generic RSS', type: 'RSS', enabled: true },
    { id: 'google_trends', name: 'Google Trends', type: 'TREND', enabled: true },
    { id: 'product_hunt', name: 'Product Hunt', type: 'RSS', enabled: true },
    { id: 'sports_feed', name: 'Sports RSS', type: 'RSS', enabled: true },
    { id: 'finance_feed', name: 'Finance RSS', type: 'RSS', enabled: true },
    { id: 'instagram_stub', name: 'Instagram Stub', type: 'SOCIAL', enabled: true },
    { id: 'tiktok_stub', name: 'TikTok Stub', type: 'SOCIAL', enabled: true },
  ];

  for (const src of sources) {
    const { error } = await supabase.from('discovery_sources').upsert([src]);
    if (error) console.error(`Error seeding source ${src.id}:`, error.message);
  }
  console.log(`✅ Seeded ${sources.length} sources.`);

  // 4. Default Scoring Rules & Overrides
  const scoringRules = [
    {
      name: 'Default Scoring Rule',
      description: 'Default scoring: 30% attention, 25% velocity, 20% cross-source confirmation, 15% freshness, 10% source trust',
      category_id: null,
      weights: {
        attention: 0.30,
        velocity: 0.25,
        cross_source_confirmation: 0.20,
        freshness: 0.15,
        source_trust: 0.10
      },
      enabled: true
    },
    {
      name: 'Viral Social Scoring Rule',
      description: 'Override for viral social: 50% engagement, 25% velocity, 15% shareability, 10% freshness',
      category_id: 'viral_social',
      weights: {
        attention: 0.50,
        velocity: 0.25,
        cross_source_confirmation: 0.15,
        freshness: 0.10,
        source_trust: 0.00
      },
      enabled: true
    },
    {
      name: 'Markets & Innovation Scoring Rule',
      description: 'Override for markets: 35% source trust, 25% market impact, 20% attention, 10% freshness, 10% cross-source confirmation',
      category_id: 'markets_innovation',
      weights: {
        source_trust: 0.35,
        velocity: 0.25,
        attention: 0.20,
        freshness: 0.10,
        cross_source_confirmation: 0.10
      },
      enabled: true
    },
    {
      name: 'Sports Scoring Rule',
      description: 'Override for sports: 35% event relevance, 25% region relevance, 20% search/social interest, 20% freshness',
      category_id: 'sports',
      weights: {
        source_trust: 0.35,
        cross_source_confirmation: 0.25,
        attention: 0.20,
        freshness: 0.20,
        velocity: 0.00
      },
      enabled: true
    }
  ];

  for (const rule of scoringRules) {
    // Check if category override exists
    const { data: existing } = await supabase
      .from('discovery_scoring_rules')
      .select('*')
      .eq('category_id', rule.category_id)
      .maybeSingle();

    if (existing) {
      await supabase.from('discovery_scoring_rules').update(rule).eq('id', existing.id);
    } else {
      await supabase.from('discovery_scoring_rules').insert([rule]);
    }
  }
  console.log(`✅ Seeded ${scoringRules.length} scoring rules.`);

  // 5. CategoryRegionConfig & SourceWeightConfig
  const defaultKeywords: Record<string, string[]> = {
    ai_tech: ['ai', 'artificial intelligence', 'machine learning', 'openai', 'gemini', 'claude', 'nvidia', 'chatgpt', 'tech', 'gpu', 'llm'],
    markets_innovation: ['stocks', 'markets', 'startup', 'innovation', 'funding', 'ipo', 'nasdaq', 'inflation', 'fed', 'interest rates'],
    gaming: ['gaming', 'game', 'playstation', 'xbox', 'nintendo', 'steam', 'rpg', 'gta', 'fortnite', 'epic games', 'esports'],
    sports: ['sports', 'football', 'soccer', 'cricket', 'nba', 'basketball', 'premier league', 'f1', 'tennis', 'ipl', 'champions league'],
    viral_social: ['viral', 'trending', 'tiktok', 'instagram', 'meme', 'youtube shorts', 'influencer', 'challenge', 'dance', 'cringe', 'video', 'celeb', 'celebrity', 'stars', 'star', 'show', 'shows', 'gossip', 'twitter', 'react', 'reacts', 'reaction', 'love island'],
    entertainment_culture: ['movie', 'cinema', 'oscar', 'music', 'album', 'concert', 'netflix', 'series', 'celebrity', 'drama', 'theatre'],
  };

  const regionalKeywords: Record<string, Record<string, string[]>> = {
    india: {
      ai_tech: ['india AI', 'bhashini', 'ola krutrim', 'tech india', 'iit', 'infosys AI', 'tcs AI'],
      markets_innovation: ['nifty', 'sensex', 'rbi', 'sebi', 'startup india', 'unicorn', 'reliance', 'tata', 'funding india'],
      gaming: ['BGMI', 'Free Fire', 'Valorant India', 'Roblox India', 'ludo king', 'mobile gaming india'],
      sports: ['cricket', 'IPL', 'bcci', 'dhoni', 'kohli', 'kabaddi', 'football india', 'olympics india'],
      viral_social: ['yashraj mukhate', 'elvis yadav', 'carryminati', 'desi meme', 'instagram reels india'],
      entertainment_culture: ['bollywood', 'tollywood', 'kollywood', 'srk', 'rajamouli', 'oscars india', 'ar rahman', 'diljit dosanjh'],
    },
    europe: {
      ai_tech: ['mistral AI', 'europe tech', 'ai act', 'gdpr', 'asml', 'spotify tech'],
      markets_innovation: ['ecb', 'ftse', 'dax', 'cac 40', 'euro', 'startup europe', 'unicorn europe'],
      gaming: ['gamescom', 'ubisoft', 'cd projekt red', 'esports europe', 'minecraft europe'],
      sports: ['uefa', 'champions league', 'premier league', 'la liga', 'bundesliga', 'f1 monaco', 'euros'],
      viral_social: ['eurovision', 'tiktok europe', 'meme europe', 'viral uk'],
      entertainment_culture: ['cannes', 'eurovision', 'bbc', 'canal+', 'berlinale', 'glastonbury', 'tomorrowland'],
    }
  };

  for (const region of regions) {
    for (const category of categories) {
      // Resolve Keywords
      const baseKw = defaultKeywords[category.id] || [];
      const regionalKw = regionalKeywords[region.id]?.[category.id] || [];
      const keywords = Array.from(new Set([...baseKw, ...regionalKw]));

      // 5a. Create Config
      const configRecord = {
        region_id: region.id,
        category_id: category.id,
        keywords,
        exclude_keywords: [],
        top_n: 3,
        time_window_hours: 24
      };
      
      const { error: configErr } = await supabase.from('discovery_category_region_configs').upsert([configRecord]);
      if (configErr) console.error(`Error seeding config ${region.id}-${category.id}:`, configErr.message);

      // 5b. Create Source Weights
      let weights: Record<string, number> = {};
      if (category.id === 'ai_tech') {
        weights = { hacker_news: 0.25, reddit: 0.20, youtube: 0.15, rss: 0.15, google_trends: 0.15, product_hunt: 0.10 };
      } else if (category.id === 'markets_innovation') {
        weights = { finance_feed: 0.40, rss: 0.20, reddit: 0.15, hacker_news: 0.10, google_trends: 0.15 };
      } else if (category.id === 'gaming') {
        weights = { reddit: 0.30, youtube: 0.30, rss: 0.20, google_trends: 0.20 };
      } else if (category.id === 'sports') {
        weights = { sports_feed: 0.40, google_trends: 0.30, youtube: 0.20, rss: 0.10 };
      } else if (category.id === 'viral_social') {
        weights = { google_trends: 0.50, rss: 0.30, reddit: 0.20 };
      } else {
        weights = { youtube: 0.30, rss: 0.30, reddit: 0.20, google_trends: 0.20 };
      }

      const weightRecord = {
        region_id: region.id,
        category_id: category.id,
        weights
      };

      const { error: weightErr } = await supabase.from('discovery_source_weight_configs').upsert([weightRecord]);
      if (weightErr) console.error(`Error seeding weight ${region.id}-${category.id}:`, weightErr.message);
    }
  }

  console.log('✅ Seeded CategoryRegionConfigs and SourceWeightConfigs.');
  console.log('🌱 Supabase database seeding complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
