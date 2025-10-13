#!/usr/bin/env node
/**
 * Fix photos stuck in "processing" state
 * Sets aligned_url = original_url for photos missing aligned_url
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Fixing photos stuck in processing...\n');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixProcessingPhotos() {
  // Find photos with original_url but no aligned_url
  console.log('📊 Finding photos stuck in processing...');
  const { data: processingPhotos, error: fetchError } = await supabase
    .from('photos')
    .select('id, original_url, aligned_url')
    .is('aligned_url', null)
    .not('original_url', 'is', null);

  if (fetchError) {
    console.error('❌ Error fetching photos:', fetchError);
    return;
  }

  console.log(`Found ${processingPhotos.length} photos stuck in processing\n`);

  if (processingPhotos.length === 0) {
    console.log('✅ No photos need fixing!');
    return;
  }

  // Update each photo
  for (const photo of processingPhotos) {
    console.log(`Fixing photo ${photo.id}...`);
    const { error: updateError } = await supabase
      .from('photos')
      .update({ aligned_url: photo.original_url })
      .eq('id', photo.id);

    if (updateError) {
      console.error(`❌ Failed to update ${photo.id}:`, updateError.message);
    } else {
      console.log(`✅ Fixed ${photo.id}`);
    }
  }

  console.log(`\n✅ Fixed ${processingPhotos.length} photos!`);
}

fixProcessingPhotos();
