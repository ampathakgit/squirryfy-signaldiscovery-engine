import supabase from '../lib/db';

async function main() {
  console.log('Querying all final signals...');
  const { data, error } = await supabase
    .from('discovery_final_signals')
    .select('id, signal_id, title, run_id, created_at, category_id, region_id')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching signals:', error);
    return;
  }

  console.log(`Total final signals in database: ${data?.length}`);
  console.log('---');
  for (const s of data || []) {
    console.log(`ID: ${s.signal_id} | Created: ${s.created_at} | Run: ${s.run_id?.substring(0, 8)}`);
    console.log(`Title: ${s.title}`);
    console.log(`Category: ${s.category_id} | Region: ${s.region_id}`);
    console.log('---');
  }
}

main().catch(console.error);
