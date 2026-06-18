import { NormalizerService } from '../normalizer';
import { ClustererService } from '../clusterer';
import { ScorerService } from '../scorer';
import { CanonicalService } from '../canonical';
import { RawSignal } from '../connectors/base';
import { VerificationService } from '../verification';

// Simple assert helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

async function testNormalization() {
  console.log('🧪 Running Normalization Tests...');
  
  const raw: RawSignal = {
    regionId: 'us',
    categoryId: 'ai_tech',
    sourceId: 'hacker_news',
    sourceType: 'forum',
    title: 'OpenAI Launches SearchGPT Engine in Beta',
    url: 'https://openai.com/blog/searchgpt?utm_source=feed&ref=newsletter',
    author: 'OpenAI Team',
    publishedAt: new Date(),
    summary: 'SearchGPT is a new prototype of AI search features designed to combine the strength of our models with info from the web.',
    engagement: {
      upvotes: 450,
      comments: 120,
      views: 5000
    }
  };

  const normalized = NormalizerService.normalize(raw);

  // Assert URL cleaning
  assert(normalized.cleanUrl === 'https://openai.com/blog/searchgpt', 'URL should be stripped of tracking params');
  assert(normalized.domain === 'openai.com', 'Domain should be extracted correctly');
  
  // Assert keyword extraction
  assert(normalized.extractedKeywords.includes('searchgpt'), 'Keywords should include searchgpt');
  assert(normalized.extractedKeywords.includes('openai'), 'Keywords should include openai');
  
  // Assert entity extraction
  assert(normalized.entities.includes('OpenAI'), 'Entities should include capitalized words like OpenAI');
  assert(normalized.entities.includes('SearchGPT'), 'Entities should include capitalized words like SearchGPT');
  
  // Assert normalized score
  assert(normalized.normalizedScore > 0 && normalized.normalizedScore <= 100, 'Score should be scaled to 0-100');

  console.log('✅ Normalization Tests Passed.');
}

async function testClustering() {
  console.log('🧪 Running Clustering / Deduplication Tests...');

  const sig1 = NormalizerService.normalize({
    regionId: 'us',
    categoryId: 'ai_tech',
    sourceId: 'hacker_news',
    sourceType: 'forum',
    title: 'OpenAI launches new search engine SearchGPT',
    url: 'https://openai.com/blog/searchgpt',
    engagement: { upvotes: 100 }
  });

  const sig2 = NormalizerService.normalize({
    regionId: 'us',
    categoryId: 'ai_tech',
    sourceId: 'reddit',
    sourceType: 'forum',
    title: 'OpenAI just announced SearchGPT, a new search engine',
    url: 'https://www.reddit.com/r/technology/comments/123/openai_searchgpt/',
    engagement: { upvotes: 200 }
  });

  const sig3 = NormalizerService.normalize({
    regionId: 'us',
    categoryId: 'ai_tech',
    sourceId: 'rss',
    sourceType: 'rss',
    title: 'Apple releases new iOS 18 beta with Apple Intelligence',
    url: 'https://techcrunch.com/apple-ios-18-beta',
    engagement: { upvotes: 50 }
  });

  const clusters = await ClustererService.clusterSignals([sig1, sig2, sig3]);

  // Assert grouping
  assert(clusters.length === 2, 'Should group into exactly 2 clusters (SearchGPT and Apple)');
  
  const searchGptCluster = clusters.find(c => c.title.includes('SearchGPT'));
  assert(searchGptCluster !== undefined, 'SearchGPT cluster should exist');
  assert(searchGptCluster!.signals.length === 2, 'SearchGPT cluster should contain 2 signals');

  const appleCluster = clusters.find(c => c.title.includes('Apple'));
  assert(appleCluster !== undefined, 'Apple cluster should exist');
  assert(appleCluster!.signals.length === 1, 'Apple cluster should contain 1 signal');

  console.log('✅ Clustering Tests Passed.');
}

async function testScoringEngine() {
  console.log('🧪 Running Scoring Engine Tests...');

  const sig1 = NormalizerService.normalize({
    regionId: 'us',
    categoryId: 'ai_tech',
    sourceId: 'hacker_news',
    sourceType: 'forum',
    title: 'OpenAI launches SearchGPT',
    url: 'https://openai.com/blog/searchgpt',
    engagement: { upvotes: 300 } // high score
  });

  const sig2 = NormalizerService.normalize({
    regionId: 'us',
    categoryId: 'ai_tech',
    sourceId: 'reddit',
    sourceType: 'forum',
    title: 'SearchGPT is launched by OpenAI',
    url: 'https://reddit.com/r/tech/searchgpt',
    engagement: { upvotes: 200 }
  });

  const clusterInput = {
    id: 'cluster_1',
    regionId: 'us',
    categoryId: 'ai_tech',
    title: 'OpenAI launches SearchGPT',
    summary: 'SearchGPT search engine',
    score: 0,
    signals: [sig1, sig2]
  };

  // Rule weights: 30% attention, 25% velocity, 20% cross_source_confirmation, 15% freshness, 10% source_trust
  const ruleWeights = {
    attention: 0.30,
    velocity: 0.25,
    cross_source_confirmation: 0.20,
    freshness: 0.15,
    source_trust: 0.10
  };

  const sourceWeights = {
    hacker_news: 0.25,
    reddit: 0.20
  };

  const score = ScorerService.scoreCluster(clusterInput, ruleWeights, sourceWeights);
  
  assert(score > 0 && score <= 100, 'Scored value should be between 0 and 100');
  console.log(`✅ Scoring Engine Tests Passed (Mock Score: ${score}).`);
}

async function testCanonicalUrlSelection() {
  console.log('🧪 Running Canonical URL Selection Tests...');

  const sigBlog = NormalizerService.normalize({
    regionId: 'us',
    categoryId: 'ai_tech',
    sourceId: 'rss',
    sourceType: 'rss',
    title: 'OpenAI SearchGPT Announcement',
    url: 'https://openai.com/blog/searchgpt',
    author: 'OpenAI'
  });

  const sigGithub = NormalizerService.normalize({
    regionId: 'us',
    categoryId: 'ai_tech',
    sourceId: 'rss',
    sourceType: 'rss',
    title: 'SearchGPT Github Repo',
    url: 'https://github.com/openai/searchgpt-demo',
    author: 'Github'
  });

  const sigReddit = NormalizerService.normalize({
    regionId: 'us',
    categoryId: 'ai_tech',
    sourceId: 'reddit',
    sourceType: 'forum',
    title: 'Reddit discussions on SearchGPT',
    url: 'https://reddit.com/r/tech/searchgpt',
    author: 'u/someone'
  });

  const cluster = {
    id: 'cluster_1',
    regionId: 'us',
    categoryId: 'ai_tech',
    title: 'SearchGPT Discussion',
    summary: 'Discussion details',
    score: 85,
    signals: [sigReddit, sigGithub, sigBlog] // Reddit first in array
  };

  const canonical = CanonicalService.selectCanonicalUrl(cluster, 'ai_tech');

  // Should select the blog post because it ranks highest in AI category URL selector priority
  assert(canonical.url === 'https://openai.com/blog/searchgpt', 'Should prioritize official company blog over reddit/github');
  assert(canonical.sourceName === 'OpenAI', 'Source name should match canonical publisher');

  console.log('✅ Canonical URL Selection Tests Passed.');
}

async function testUrlVerification() {
  console.log('🧪 Running URL Verification Tests...');

  // Test isSpecificResource
  assert(!VerificationService.isSpecificResource('https://www.netflix.com/search?q=oscar'), 'Search URL should be invalid');
  assert(!VerificationService.isSpecificResource('https://www.netflix.com/'), 'Root URL should be invalid');
  assert(!VerificationService.isSpecificResource('https://www.instagram.com/explore/tags/cringe'), 'Instagram explore URL should be invalid');
  
  assert(VerificationService.isSpecificResource('https://www.netflix.com/tudum/squid-game'), 'Specific article URL should be valid');
  assert(VerificationService.isSpecificResource('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'YouTube watch URL should be valid');
  assert(VerificationService.isSpecificResource('https://www.instagram.com/p/C-VfK3xS3N_/'), 'Instagram post URL should be valid');
  assert(VerificationService.isSpecificResource('https://github.com/google/generative-ai-js'), 'GitHub repo URL should be valid');

  // Test verifyUrl format check
  const resInvalid = await VerificationService.verifyUrl('https://www.netflix.com/search?q=oscar');
  assert(!resInvalid.isValid, 'verifyUrl should reject search URL');

  // Test fallback pool
  const fallback = VerificationService.getFallbackItemUrl('gaming', 'https://www.gameinformer.com/search');
  assert(fallback.startsWith('https://'), 'Fallback should return a valid URL protocol');
  assert(VerificationService.isSpecificResource(fallback), 'Fallback URL should be a specific resource');

  console.log('✅ URL Verification Tests Passed.');
}

async function runAll() {
  console.log('🚀 Starting Squirryfy pipeline test suite...');
  try {
    await testNormalization();
    await testClustering();
    await testScoringEngine();
    await testCanonicalUrlSelection();
    await testUrlVerification();
    console.log('\n🎉 ALL PIPELINE TESTS COMPLETED SUCCESSFULLY!');
  } catch (error: any) {
    console.error('\n❌ TEST SUITE FAILED:', error.message);
    process.exit(1);
  }
}

runAll();
