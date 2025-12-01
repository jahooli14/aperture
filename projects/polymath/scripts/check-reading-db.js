/**
 * Check if reading_queue table exists in database
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
// Load .env.local file
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:');
    console.error('  VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
    console.log('\nMake sure .env.local file exists with these variables.');
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);
async function checkDatabase() {
    console.log('Checking database...\n');
    // Test 1: Check if reading_queue table exists
    console.log('1. Checking if reading_queue table exists...');
    const { data, error } = await supabase
        .from('reading_queue')
        .select('count')
        .limit(1);
    if (error) {
        console.error('❌ Error:', error.message);
        console.log('\n⚠️  The reading_queue table might not exist.');
        console.log('Run this migration: supabase/migrations/004_reading_queue.sql\n');
        return false;
    }
    console.log('✅ reading_queue table exists');
    // Test 2: Try to insert and delete a test article
    console.log('\n2. Testing insert/delete...');
    const testArticle = {
        user_id: 'f2404e61-2010-46c8-8edd-b8a3e702f0fb',
        url: 'https://test.example.com',
        title: 'Test Article',
        content: 'Test content',
        excerpt: 'Test excerpt',
        source: 'example.com',
        status: 'unread',
        tags: [],
        read_time_minutes: 1,
        word_count: 2
    };
    const { data: inserted, error: insertError } = await supabase
        .from('reading_queue')
        .insert([testArticle])
        .select()
        .single();
    if (insertError) {
        console.error('❌ Insert error:', insertError.message);
        return false;
    }
    console.log('✅ Insert successful');
    // Clean up
    if (inserted) {
        await supabase
            .from('reading_queue')
            .delete()
            .eq('id', inserted.id);
        console.log('✅ Cleanup successful');
    }
    // Test 3: Check article_highlights table
    console.log('\n3. Checking if article_highlights table exists...');
    const { error: highlightsError } = await supabase
        .from('article_highlights')
        .select('count')
        .limit(1);
    if (highlightsError) {
        console.error('❌ Error:', highlightsError.message);
        return false;
    }
    console.log('✅ article_highlights table exists');
    console.log('\n✅ All database checks passed!\n');
    return true;
}
checkDatabase()
    .then((success) => {
    process.exit(success ? 0 : 1);
})
    .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
