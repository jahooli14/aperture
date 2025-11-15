const https = require('https');
const fs = require('fs');

// Production aligned photo URLs from Supabase storage
const urls = [
  'https://ktaofrzrjuslahxrwhqz.supabase.co/storage/v1/object/public/photos/aligned/photo1.jpg',
  'https://ktaofrzrjuslahxrwhqz.supabase.co/storage/v1/object/public/photos/aligned/photo2.jpg',
  'https://ktaofrzrjuslahxrwhqz.supabase.co/storage/v1/object/public/photos/aligned/photo3.jpg',
];

async function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(filename);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded ${filename}`);
          resolve();
        });
      } else {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

async function main() {
  console.log('Downloading production aligned photos...');
  for (let i = 0; i < urls.length; i++) {
    try {
      await downloadImage(urls[i], `production-photo${i + 1}-aligned.jpg`);
    } catch (error) {
      console.error(`Error downloading photo ${i + 1}:`, error.message);
    }
  }
  console.log('Done!');
}

main();
