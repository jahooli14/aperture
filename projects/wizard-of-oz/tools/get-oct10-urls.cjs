const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  'https://zaruvcwdqkqmyscwvxci.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUrls() {
  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .gte('upload_date', '2025-10-10')
    .lte('upload_date', '2025-10-10T23:59:59');

  if (!photos || photos.length === 0) {
    console.log('No photos found');
    return;
  }

  console.log('\n📸 Oct 10 Photo URLs:\n');
  console.log('Original URL:');
  console.log(photos[0].original_url);
  console.log('\nAligned URL:');
  console.log(photos[0].aligned_url);
  console.log('\n\nEye Coordinates:');
  console.log(`Left:  (${photos[0].eye_coordinates.leftEye.x}, ${photos[0].eye_coordinates.leftEye.y})`);
  console.log(`Right: (${photos[0].eye_coordinates.rightEye.x}, ${photos[0].eye_coordinates.rightEye.y})`);
}

getUrls().catch(console.error);
