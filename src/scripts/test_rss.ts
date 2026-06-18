import Parser from 'rss-parser';
const parser = new Parser();

async function test() {
  console.log('Fetching live BBC Technology RSS feed...');
  const feed = await parser.parseURL('http://feeds.bbci.co.uk/news/technology/rss.xml');
  const items = feed.items || [];
  console.log(`Feed Title: ${feed.title}`);
  console.log(`Total items found: ${items.length}`);
  console.log('---');
  for (const item of items.slice(0, 10)) {
    console.log(`Title: ${item.title}`);
    console.log(`Link: ${item.link}`);
    console.log(`PubDate: ${item.pubDate}`);
    console.log(`Parsed Date: ${item.pubDate ? new Date(item.pubDate).toISOString() : 'none'}`);
    console.log('---');
  }
}
test().catch(console.error);
