const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteAllPhotos() {
  try {
    console.log('🗑️  Fetching all photos...');

    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('id, original_url, aligned_url');

    if (fetchError) {
      console.error('❌ Error fetching photos:', fetchError);
      process.exit(1);
    }

    console.log(`📊 Found ${photos.length} photos`);

    if (photos.length === 0) {
      console.log('✅ No photos to delete');
      return;
    }

    // Delete from database
    console.log('🗑️  Deleting from database...');
    const { error: deleteError } = await supabase
      .from('photos')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (dummy condition)

    if (deleteError) {
      console.error('❌ Error deleting from database:', deleteError);
      process.exit(1);
    }

    console.log('✅ All photos deleted from database');

    // Note: Storage files are NOT deleted (would need separate cleanup)
    console.log('⚠️  Note: Storage files still exist in Supabase Storage');
    console.log('   To clean up storage, manually delete from Supabase dashboard');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

deleteAllPhotos();
