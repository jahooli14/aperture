const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listPhotos() {
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, upload_date, eye_coordinates, original_url, aligned_url')
    .not('eye_coordinates', 'is', null)
    .order('upload_date', { ascending: true });

  if (error) throw error;

  console.log('\n📸 All photos with eye coordinates (sorted by upload date):\n');
  photos.forEach((p, i) => {
    const uploadDate = new Date(p.upload_date);
    console.log(`${i + 1}. ${uploadDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
    console.log(`   ID: ${p.id.substring(0, 8)}...`);
    console.log(`   Confidence: ${p.eye_coordinates.confidence}`);
    console.log(`   Left: (${Math.round(p.eye_coordinates.leftEye.x)}, ${Math.round(p.eye_coordinates.leftEye.y)})`);
    console.log(`   Right: (${Math.round(p.eye_coordinates.rightEye.x)}, ${Math.round(p.eye_coordinates.rightEye.y)})`);
    console.log(`   Image size: ${p.eye_coordinates.imageWidth}x${p.eye_coordinates.imageHeight}`);
    console.log(`   Has aligned: ${p.aligned_url ? 'YES' : 'NO'}`);
    console.log('');
  });
}

listPhotos();
