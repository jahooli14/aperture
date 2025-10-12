import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.js';

const supabase = createClient<Database>(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('delete-photo called with method:', req.method);

  if (req.method !== 'DELETE') {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { photoId } = req.body;
    console.log('Deleting photo with ID:', photoId);

    if (!photoId) {
      console.log('❌ Missing photoId in request');
      return res.status(400).json({ error: 'Photo ID is required' });
    }

    // First, get the photo to find the file paths
    console.log('Fetching photo details...');
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('original_url, aligned_url, user_id')
      .eq('id', photoId)
      .single();

    if (fetchError || !photo) {
      console.error('❌ Error fetching photo:', fetchError);
      return res.status(404).json({ error: 'Photo not found' });
    }

    console.log('Photo found:', {
      id: photoId,
      hasOriginal: !!photo.original_url,
      hasAligned: !!photo.aligned_url,
      userId: photo.user_id
    });

    // Extract file paths from URLs for deletion
    const filesToDelete: { bucket: string; path: string }[] = [];

    if (photo.original_url) {
      const originalPath = photo.original_url.split('/storage/v1/object/public/originals/')[1];
      if (originalPath) {
        filesToDelete.push({ bucket: 'originals', path: originalPath });
      }
    }

    if (photo.aligned_url) {
      const alignedPath = photo.aligned_url.split('/storage/v1/object/public/aligned/')[1];
      if (alignedPath) {
        filesToDelete.push({ bucket: 'aligned', path: alignedPath });
      }
    }

    console.log('Files to delete:', filesToDelete);

    // Delete files from storage buckets
    for (const file of filesToDelete) {
      console.log(`Deleting from ${file.bucket}: ${file.path}`);
      const { error: deleteError } = await supabase.storage
        .from(file.bucket)
        .remove([file.path]);

      if (deleteError) {
        console.warn(`⚠️ Warning: Could not delete file ${file.path} from ${file.bucket}:`, deleteError);
        // Continue with database deletion even if file deletion fails
      } else {
        console.log(`✅ Successfully deleted file from ${file.bucket}: ${file.path}`);
      }
    }

    // Delete the database record
    console.log('Deleting database record...');
    const { error: dbDeleteError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbDeleteError) {
      console.error('❌ Error deleting photo from database:', dbDeleteError);
      return res.status(500).json({ error: 'Failed to delete photo from database' });
    }

    console.log('✅ Photo deleted successfully:', photoId);
    return res.status(200).json({
      success: true,
      message: 'Photo deleted successfully',
      deletedFiles: filesToDelete.length
    });

  } catch (error) {
    console.error('❌ Unexpected error in delete-photo:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}