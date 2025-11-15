const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function download() {
  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .gte('upload_date', '2025-10-10')
    .lte('upload_date', '2025-10-10T23:59:59')
    .limit(1);

  if (!photos || photos.length === 0) {
    console.log('Photo not found');
    return;
  }

  const photo = photos[0];
  console.log('Found Oct 10 photo');
  console.log('Eye coords:', photo.eye_coordinates);

  const downloadFile = (url, filename) => {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        const file = fs.createWriteStream(filename);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded: ${filename}`);
          resolve();
        });
      }).on('error', reject);
    });
  };

  await downloadFile(photo.original_url, './oct10-original.jpg');
  await downloadFile(photo.aligned_url, './oct10-aligned.jpg');

  console.log('\nOpen the downloaded files to inspect them!');
  console.log('Eye detection marked:');
  console.log(`  Left Eye: (${Math.round(photo.eye_coordinates.leftEye.x)}, ${Math.round(photo.eye_coordinates.leftEye.y)})`);
  console.log(`  Right Eye: (${Math.round(photo.eye_coordinates.rightEye.x)}, ${Math.round(photo.eye_coordinates.rightEye.y)})`);
}

download().catch(console.error);
