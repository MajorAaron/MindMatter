import supabase from './supabaseClient.js';

async function testConnection() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error testing connection:', error);
    process.exit(1);
  } else {
    console.log('Storage Buckets:', data);
  }
}

testConnection(); 