import { PrismaClient, SourceType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Start seeding database...');

  // 1. Regions
  const regions = [
    { id: 'us', name: 'United States', timezone: 'America/New_York', languages: ['en'] },
    { id: 'india', name: 'India', timezone: 'Asia/Kolkata', languages: ['en', 'hi'] },
    { id: 'europe', name: 'Europe', timezone: 'Europe/Paris', languages: ['en', 'fr', 'de', 'es'] },
  ];

  for (const region of regions) {
    await prisma.region.upsert({
      where: { id: region.id },
      update: region,
      create: region,
    });
  }
  console.log(`✅ Seeded ${regions.length} regions.`);

  // 2. Categories
  const categories = [
    { id: 'ai_tech', name: 'AI & Technology', defaultTopN: 3 },
    { id: 'markets_innovation', name: 'Markets & Innovation', defaultTopN: 3 },
    { id: 'gaming', name: 'Gaming', defaultTopN: 3 },
    { id: 'sports', name: 'Sports', defaultTopN: 3 },
    { id: 'viral_social', name: 'Viral Social', defaultTopN: 3 },
    { id: 'entertainment_culture', name: 'Entertainment & Culture', defaultTopN: 3 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: cat,
      create: cat,
    });
  }
  console.log(`✅ Seeded ${categories.length} categories.`);

  // 3. Sources
  const sources = [
    { id: 'hacker_news', name: 'Hacker News', type: SourceType.FORUM },
    { id: 'youtube', name: 'YouTube', type: SourceType.VIDEO },
    { id: 'reddit', name: 'Reddit', type: SourceType.FORUM },
    { id: 'rss', name: 'Generic RSS', type: SourceType.RSS },
    { id: 'google_trends', name: 'Google Trends', type: SourceType.TREND },
    { id: 'product_hunt', name: 'Product Hunt', type: SourceType.RSS },
    { id: 'sports_feed', name: 'Sports RSS', type: SourceType.RSS },
    { id: 'finance_feed', name: 'Finance RSS', type: SourceType.RSS },
    { id: 'instagram_stub', name: 'Instagram Stub', type: SourceType.SOCIAL },
    { id: 'tiktok_stub', name: 'TikTok Stub', type: SourceType.SOCIAL },
  ];

  for (const src of sources) {
    await prisma.source.upsert({
      where: { id: src.id },
      update: src,
      create: src,
    });
  }
  console.log(`✅ Seeded ${sources.length} sources.`);

  // 4. Default Scoring Rules & Overrides
  const scoringRules = [
    {
      name: 'Default Scoring Rule',
      description: 'Default scoring: 30% attention, 25% velocity, 20% cross-source confirmation, 15% freshness, 10% source trust',
      categoryId: null, // Default
      weights: {
        attention: 0.30,
        velocity: 0.25,
        cross_source_confirmation: 0.20,
        freshness: 0.15,
        source_trust: 0.10
      }
    },
    {
      name: 'Viral Social Scoring Rule',
      description: 'Override for viral social: 50% engagement, 25% velocity, 15% shareability, 10% freshness',
      categoryId: 'viral_social',
      weights: {
        attention: 0.50, // engagement maps to attention
        velocity: 0.25,
        cross_source_confirmation: 0.15, // shareability maps here
        freshness: 0.10,
        source_trust: 0.00
      }
    },
    {
      name: 'Markets & Innovation Scoring Rule',
      description: 'Override for markets: 35% source trust, 25% market impact, 20% attention, 10% freshness, 10% cross-source confirmation',
      categoryId: 'markets_innovation',
      weights: {
        source_trust: 0.35,
        velocity: 0.25, // market impact maps here
        attention: 0.20,
        freshness: 0.10,
        cross_source_confirmation: 0.10
      }
    },
    {
      name: 'Sports Scoring Rule',
      description: 'Override for sports: 35% event relevance, 25% region relevance, 20% search/social interest, 20% freshness',
      categoryId: 'sports',
      weights: {
        source_trust: 0.35, // event relevance maps to trust
        cross_source_confirmation: 0.25, // region relevance maps to confirmation
        attention: 0.20, // search/social interest maps to attention
        freshness: 0.20,
        velocity: 0.00
      }
    }
  ];

  for (const rule of scoringRules) {
    const existing = await prisma.scoringRule.findFirst({
      where: { categoryId: rule.categoryId }
    });
    if (existing) {
      await prisma.scoringRule.update({
        where: { id: existing.id },
        data: rule
      });
    } else {
      await prisma.scoringRule.create({
        data: rule
      });
    }
  }
  console.log(`✅ Seeded ${scoringRules.length} scoring rules.`);

  // 5. CategoryRegionConfig & SourceWeightConfig
  const defaultKeywords: Record<string, string[]> = {
    ai_tech: ['ai', 'artificial intelligence', 'machine learning', 'openai', 'gemini', 'claude', 'nvidia', 'chatgpt', 'tech', 'gpu', 'llm'],
    markets_innovation: ['stocks', 'markets', 'startup', 'innovation', 'funding', 'ipo', 'nasdaq', 'inflation', 'fed', 'interest rates'],
    gaming: ['gaming', 'game', 'playstation', 'xbox', 'nintendo', 'steam', 'rpg', 'gta', 'fortnite', 'epic games', 'esports'],
    sports: ['sports', 'football', 'soccer', 'cricket', 'nba', 'basketball', 'premier league', 'f1', 'tennis', 'ipl', 'champions league'],
    viral_social: ['viral', 'trending', 'tiktok', 'instagram', 'meme', 'youtube shorts', 'influencer', 'challenge', 'dance', 'cringe'],
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
      await prisma.categoryRegionConfig.upsert({
        where: {
          regionId_categoryId: {
            regionId: region.id,
            categoryId: category.id,
          }
        },
        update: {
          keywords,
          topN: 3,
          timeWindowHours: 24,
        },
        create: {
          regionId: region.id,
          categoryId: category.id,
          keywords,
          topN: 3,
          timeWindowHours: 24,
        }
      });

      // 5b. Create Source Weights
      // Provide custom weights based on category for maximum realism
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
        weights = { tiktok_stub: 0.30, instagram_stub: 0.30, reddit: 0.25, youtube: 0.15 };
      } else {
        // entertainment_culture
        weights = { youtube: 0.30, rss: 0.30, reddit: 0.20, google_trends: 0.20 };
      }

      await prisma.sourceWeightConfig.upsert({
        where: {
          regionId_categoryId: {
            regionId: region.id,
            categoryId: category.id,
          }
        },
        update: { weights },
        create: {
          regionId: region.id,
          categoryId: category.id,
          weights,
        }
      });
    }
  }

  console.log('✅ Seeded CategoryRegionConfigs and SourceWeightConfigs.');
  console.log('🌱 Database seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
