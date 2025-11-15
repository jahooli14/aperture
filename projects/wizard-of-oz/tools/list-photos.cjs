const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listPhotos() {
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, eye_coordinates')
    .not('eye_coordinates', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;

  console.log('\n📸 Recent photos with eye coordinates:\n');
  photos.forEach((p, i) => {
    console.log(`${i + 1}. ID: ${p.id.substring(0, 8)}...`);
    console.log(`   Eyes open: ${p.eye_coordinates.eyesOpen}`);
    console.log(`   Confidence: ${p.eye_coordinates.confidence}`);
    console.log(`   Left: (${p.eye_coordinates.leftEye.x}, ${p.eye_coordinates.leftEye.y})`);
    console.log(`   Right: (${p.eye_coordinates.rightEye.x}, ${p.eye_coordinates.rightEye.y})`);
    console.log('');
  });
}

listPhotos();
