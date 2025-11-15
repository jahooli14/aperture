const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'projects/wizard-of-oz/.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getLatestPhoto() {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('id, upload_date, original_url, aligned_url, eye_coordinates')
      .order('upload_date', { ascending: false })
      .limit(1);

    if (error) throw error;

    const photo = data[0];
    console.log('Photo ID:', photo.id);
    console.log('Upload date:', photo.upload_date);
    console.log('\nOriginal URL:', photo.original_url);
    console.log('\nAligned URL:', photo.aligned_url);
    console.log('\nEye coordinates:');
    console.log(JSON.stringify(photo.eye_coordinates, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

getLatestPhoto();
