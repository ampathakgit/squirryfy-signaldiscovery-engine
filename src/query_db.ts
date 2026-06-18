import supabase from './lib/db';

async function main() {
  console.log('Querying latest final signals...');
  const { data: signals, error } = await supabase
    .from('discovery_final_signals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error querying signals:', error);
  } else {
    console.log('Found signals count:', signals?.length);
    if (signals && signals.length > 0) {
      console.log('Latest signal fields:', Object.keys(signals[0]));
      console.log('Sample signal:', signals.map(s => ({
        id: s.id,
        title: s.title,
        canonical_url: s.canonical_url,
        article_url: s.article_url,
        run_id: s.run_id
      })));
    }
  }
}

main().catch(console.error);
