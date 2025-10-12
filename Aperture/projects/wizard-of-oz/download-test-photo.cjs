const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function downloadTestPhoto() {
  console.log('\n📥 Downloading real baby photo from Supabase...\n');

  try {
    // Fetch a photo with eye coordinates from the database
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .not('eye_coordinates', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      throw fetchError;
    }

    if (!photos || photos.length === 0) {
      console.error('❌ No photos with eye coordinates found in database');
      return;
    }

    const photo = photos[0];
    console.log('Found photo:', {
      id: photo.id,
      original_url: photo.original_url,
      eye_coordinates: photo.eye_coordinates,
    });

    // Download the image
    const response = await fetch(photo.original_url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Save to local file
    const filename = './test-output/real-baby-photo.jpg';
    fs.writeFileSync(filename, buffer);

    console.log('\n✅ Downloaded successfully:', filename);
    console.log('\nEye coordinates from database:');
    console.log('  Left Eye:', photo.eye_coordinates.leftEye);
    console.log('  Right Eye:', photo.eye_coordinates.rightEye);
    console.log('  Confidence:', photo.eye_coordinates.confidence);
    console.log('  Image Dimensions:', `${photo.eye_coordinates.imageWidth}x${photo.eye_coordinates.imageHeight}`);

    // Save metadata for testing
    const metadata = {
      photoId: photo.id,
      detectedEyes: photo.eye_coordinates,
      originalUrl: photo.original_url,
      createdAt: photo.created_at,
    };

    fs.writeFileSync(
      './test-output/real-baby-photo-metadata.json',
      JSON.stringify(metadata, null, 2)
    );

    console.log('\n💾 Metadata saved to: ./test-output/real-baby-photo-metadata.json\n');

    return metadata;

  } catch (error) {
    console.error('\n❌ Error downloading photo:', error.message);
    throw error;
  }
}

// Run
downloadTestPhoto().catch(console.error);
