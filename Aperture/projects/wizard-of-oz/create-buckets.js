#!/usr/bin/env node
/**
 * Create Supabase storage buckets
 * Run: node create-buckets.js
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🪣 Creating Supabase Storage Buckets...\n');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createBuckets() {
  // Create originals bucket
  console.log('📦 Creating "originals" bucket...');
  const { data: originals, error: originalsError } = await supabase.storage.createBucket('originals', {
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/webp']
  });

  if (originalsError) {
    if (originalsError.message.includes('already exists')) {
      console.log('✅ "originals" bucket already exists');
    } else {
      console.error('❌ Error creating originals bucket:', originalsError.message);
    }
  } else {
    console.log('✅ "originals" bucket created successfully');
  }

  // Create aligned bucket
  console.log('📦 Creating "aligned" bucket...');
  const { data: aligned, error: alignedError } = await supabase.storage.createBucket('aligned', {
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  });

  if (alignedError) {
    if (alignedError.message.includes('already exists')) {
      console.log('✅ "aligned" bucket already exists');
    } else {
      console.error('❌ Error creating aligned bucket:', alignedError.message);
    }
  } else {
    console.log('✅ "aligned" bucket created successfully');
  }

  console.log('\n✅ Bucket creation complete!');
}

createBuckets();
