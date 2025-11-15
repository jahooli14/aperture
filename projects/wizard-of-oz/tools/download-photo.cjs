const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const https = require('https');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function downloadPhoto(date) {
  // Find photo by upload_date
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, upload_date, original_url, aligned_url')
    .gte('upload_date', date)
    .lte('upload_date', date + 'T23:59:59')
    .limit(1);

  if (error) throw error;
  if (!photos || photos.length === 0) {
    console.log('No photo found for date:', date);
    return;
  }

  const photo = photos[0];
  console.log('Found photo:', photo.id);
  console.log('Original URL:', photo.original_url);
  console.log('Aligned URL:', photo.aligned_url);

  // Download original
  if (photo.original_url) {
    const originalPath = `./downloaded-${date}-original.jpg`;
    await downloadFile(photo.original_url, originalPath);
    console.log('Downloaded original to:', originalPath);
  }

  // Download aligned
  if (photo.aligned_url) {
    const alignedPath = `./downloaded-${date}-aligned.jpg`;
    await downloadFile(photo.aligned_url, alignedPath);
    console.log('Downloaded aligned to:', alignedPath);
  }
}

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    }).on('error', reject);
  });
}

const date = process.argv[2] || '2025-10-10';
downloadPhoto(date).catch(console.error);
