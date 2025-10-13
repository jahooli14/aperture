#!/usr/bin/env node
/**
 * Test script to verify Supabase connection and photos table
 * Run: node test-supabase.js
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Connection...\n');
console.log('URL:', supabaseUrl);
console.log('Anon Key:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
console.log('');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    // Test 1: Query photos table (without auth - should fail with RLS)
    console.log('📊 Test 1: Query photos table (unauthenticated)');
    const { data, error } = await supabase
      .from('photos')
      .select('id')
      .limit(1);

    if (error) {
      console.log('Error:', error.message);
      if (error.message.includes('relation "photos" does not exist')) {
        console.log('❌ CRITICAL: photos table does NOT exist in database');
        console.log('   Solution: Run migration 001_initial_schema.sql in Supabase SQL Editor');
      } else if (error.message.includes('RLS') || error.message.includes('policy')) {
        console.log('✅ Table exists (RLS blocking unauthenticated access - expected)');
      } else {
        console.log('⚠️  Unexpected error:', error);
      }
    } else {
      console.log('✅ Query succeeded:', data);
    }
    console.log('');

    // Test 2: Check storage buckets
    console.log('📦 Test 2: List storage buckets');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
      console.log('❌ Error listing buckets:', bucketError.message);
    } else {
      console.log('✅ Buckets found:', buckets.map(b => b.name).join(', '));

      const hasOriginals = buckets.some(b => b.name === 'originals');
      const hasAligned = buckets.some(b => b.name === 'aligned');

      if (!hasOriginals) console.log('❌ "originals" bucket missing');
      if (!hasAligned) console.log('❌ "aligned" bucket missing');
    }
    console.log('');

    // Test 3: Try to get current user
    console.log('👤 Test 3: Check authentication');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.log('ℹ️  No authenticated user (expected for test script)');
    } else if (user) {
      console.log('✅ Authenticated as:', user.email);
    } else {
      console.log('ℹ️  No user session');
    }

  } catch (err) {
    console.error('💥 Unexpected error:', err);
  }
}

testConnection();
