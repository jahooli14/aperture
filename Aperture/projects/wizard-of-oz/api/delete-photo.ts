import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.js';

// Simple logger for API routes (production logging)
const logger = {
  info: (msg: string, data?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'INFO', message: msg, ...data, timestamp: new Date().toISOString() }));
  },
  error: (msg: string, data?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: 'ERROR', message: msg, ...data, timestamp: new Date().toISOString() }));
  },
  warn: (msg: string, data?: Record<string, unknown>) => {
    console.warn(JSON.stringify({ level: 'WARN', message: msg, ...data, timestamp: new Date().toISOString() }));
  }
};

const supabase = createClient<Database>(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  logger.info('delete-photo called', { method: req.method });

  if (req.method !== 'DELETE') {
    logger.error('Method not allowed', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { photoId } = req.body;
    logger.info('Deleting photo', { photoId });

    if (!photoId) {
      logger.error('Missing photoId in request');
      return res.status(400).json({ error: 'Photo ID is required' });
    }

    // First, get the photo to find the file paths
    logger.info('Fetching photo details', { photoId });
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('original_url, aligned_url, user_id')
      .eq('id', photoId)
      .single();

    if (fetchError) {
      logger.error('Error fetching photo', { photoId, error: fetchError.message });
      return res.status(404).json({ error: 'Photo not found' });
    }

    if (!photo) {
      logger.error('Photo not found', { photoId });
      return res.status(404).json({ error: 'Photo not found' });
    }

    logger.info('Photo found', {
      photoId,
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

    logger.info('Files to delete', { count: filesToDelete.length, files: filesToDelete });

    // Delete files from storage buckets
    for (const file of filesToDelete) {
      logger.info('Deleting file', { bucket: file.bucket, path: file.path });
      const { error: deleteError } = await supabase.storage
        .from(file.bucket)
        .remove([file.path]);

      if (deleteError) {
        logger.warn('Could not delete file', {
          bucket: file.bucket,
          path: file.path,
          error: deleteError.message
        });
        // Continue with database deletion even if file deletion fails
      } else {
        logger.info('File deleted successfully', { bucket: file.bucket, path: file.path });
      }
    }

    // Delete the database record
    logger.info('Deleting database record', { photoId });
    const { error: dbDeleteError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbDeleteError) {
      logger.error('Error deleting photo from database', {
        photoId,
        error: dbDeleteError.message
      });
      return res.status(500).json({ error: 'Failed to delete photo from database' });
    }

    logger.info('Photo deleted successfully', { photoId, filesDeleted: filesToDelete.length });
    return res.status(200).json({
      success: true,
      message: 'Photo deleted successfully',
      deletedFiles: filesToDelete.length
    });

  } catch (error) {
    logger.error('Unexpected error in delete-photo', {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}