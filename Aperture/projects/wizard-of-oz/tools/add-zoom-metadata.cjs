/**
 * Migration Script: Add zoom_level metadata to existing photos
 *
 * This script calculates the age-appropriate zoom level for each photo
 * based on the baby's birthdate and the photo date, then updates the
 * metadata field with zoom_level.
 *
 * Usage: node tools/add-zoom-metadata.cjs
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase client setup - load from .env manually if needed
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Calculate appropriate zoom level based on baby's age
 * Uses smooth logarithmic curve for gradual transition
 */
function calculateZoomLevel(ageInMonths) {
  const START_ZOOM = 0.40;
  const END_ZOOM = 0.20;
  const MAX_AGE = 36; // 3 years

  if (ageInMonths <= 0) return START_ZOOM;
  if (ageInMonths >= MAX_AGE) return END_ZOOM;

  // Logarithmic interpolation for smooth, natural transition
  const t = ageInMonths / MAX_AGE;
  const logT = Math.log(1 + t * 9) / Math.log(10);

  return START_ZOOM - (START_ZOOM - END_ZOOM) * logT;
}

/**
 * Calculate age in months between two dates
 */
function calculateAgeInMonths(birthdate, photoDate) {
  const birth = new Date(birthdate + 'T00:00:00');
  const photo = new Date(photoDate + 'T00:00:00');

  const diffMs = photo.getTime() - birth.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const ageInMonths = diffDays / 30.44; // Average days per month

  return ageInMonths;
}

async function migratePhotos() {
  console.log('🚀 Starting zoom level migration...\n');

  try {
    // Step 1: Get all user settings with birthdates
    console.log('📋 Fetching user settings...');
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('user_id, baby_birthdate')
      .not('baby_birthdate', 'is', null);

    if (settingsError) {
      throw new Error(`Failed to fetch settings: ${settingsError.message}`);
    }

    console.log(`✅ Found ${settings.length} users with birthdates\n`);

    if (settings.length === 0) {
      console.log('No users with birthdates found. Exiting.');
      return;
    }

    // Step 2: Process each user's photos
    let totalPhotos = 0;
    let updatedPhotos = 0;
    let skippedPhotos = 0;

    for (const userSetting of settings) {
      console.log(`\n👤 Processing user: ${userSetting.user_id}`);

      // Get all photos for this user
      const { data: photos, error: photosError } = await supabase
        .from('photos')
        .select('id, upload_date, metadata, eye_coordinates')
        .eq('user_id', userSetting.user_id);

      if (photosError) {
        console.error(`  ⚠️  Error fetching photos: ${photosError.message}`);
        continue;
      }

      console.log(`  📸 Found ${photos.length} photos`);
      totalPhotos += photos.length;

      // Update each photo with zoom level
      for (const photo of photos) {
        // Skip if photo already has zoom_level metadata
        if (photo.metadata && typeof photo.metadata === 'object' && 'zoom_level' in photo.metadata) {
          console.log(`  ⏭️  Photo ${photo.id} already has zoom_level, skipping`);
          skippedPhotos++;
          continue;
        }

        // Skip if photo doesn't have eye detection
        if (!photo.eye_coordinates) {
          console.log(`  ⏭️  Photo ${photo.id} has no eye detection, skipping`);
          skippedPhotos++;
          continue;
        }

        // Calculate age and zoom level
        const ageInMonths = calculateAgeInMonths(userSetting.baby_birthdate, photo.upload_date);
        const zoomLevel = calculateZoomLevel(ageInMonths);

        // Update metadata with zoom level
        const updatedMetadata = {
          ...(photo.metadata || {}),
          zoom_level: zoomLevel
        };

        const { error: updateError } = await supabase
          .from('photos')
          .update({ metadata: updatedMetadata })
          .eq('id', photo.id);

        if (updateError) {
          console.error(`  ❌ Error updating photo ${photo.id}: ${updateError.message}`);
          continue;
        }

        console.log(`  ✅ Updated photo ${photo.id}: age=${ageInMonths.toFixed(1)}mo, zoom=${(zoomLevel * 100).toFixed(0)}%`);
        updatedPhotos++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`Total photos processed: ${totalPhotos}`);
    console.log(`Photos updated: ${updatedPhotos}`);
    console.log(`Photos skipped: ${skippedPhotos}`);
    console.log('='.repeat(60));
    console.log('\n✨ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
migratePhotos();
