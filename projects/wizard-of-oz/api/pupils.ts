/**
 * Consolidated Pupils API Endpoint
 *
 * Handles all Pupils (wizard-of-oz) project operations:
 * - Send push notifications (?action=send-push)
 * - Delete photos (?action=delete-photo)
 *
 * This consolidates:
 * - /api/send-push.ts
 * - /api/delete-photo.ts
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import type { Database } from '../src/types/database.js'

// Initialize Supabase with service role key for admin operations
const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

// VAPID keys for web push
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY!
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:notifications@pupils.app'

// Configure web push
webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)

// Simple logger for API routes (production logging)
const logger = {
  info: (msg: string, data?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'INFO', message: msg, ...data, timestamp: new Date().toISOString() }))
  },
  error: (msg: string, data?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: 'ERROR', message: msg, ...data, timestamp: new Date().toISOString() }))
  },
  warn: (msg: string, data?: Record<string, unknown>) => {
    console.warn(JSON.stringify({ level: 'WARN', message: msg, ...data, timestamp: new Date().toISOString() }))
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query

  // SEND PUSH NOTIFICATION
  if (action === 'send-push') {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const { userId, title, body, url } = req.body

      // Validate input
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' })
      }

      // Get user's push subscription from database
      type UserSettings = Pick<Database['public']['Tables']['user_settings']['Row'], 'push_subscription'>
      const { data: settings, error: fetchError } = await supabase
        .from('user_settings')
        .select('push_subscription')
        .eq('user_id', userId)
        .single() as { data: UserSettings | null; error: unknown }

      if (fetchError || !settings) {
        logger.error('Failed to fetch user settings', { userId, error: fetchError })
        return res.status(404).json({ error: 'User settings not found' })
      }

      if (!settings.push_subscription) {
        return res.status(400).json({ error: 'User has no push subscription' })
      }

      // Prepare notification payload
      const payload = JSON.stringify({
        title: title || 'Pupils Reminder',
        body: body || 'Time to take today\'s photo!',
        url: url || '/'
      })

      // Send push notification
      try {
        await webpush.sendNotification(settings.push_subscription, payload)

        logger.info('Push notification sent successfully', { userId })
        return res.status(200).json({ success: true, message: 'Notification sent' })
      } catch (pushError: any) {
        logger.error('Failed to send push notification', { userId, error: pushError })

        // If subscription is invalid/expired, remove it from database
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          await supabase
            .from('user_settings')
            // @ts-ignore - Supabase type inference issue with null values
            .update({ push_subscription: null })
            .eq('user_id', userId)

          return res.status(410).json({ error: 'Push subscription expired' })
        }

        throw pushError
      }
    } catch (error) {
      logger.error('Error in send-push handler', {
        error: error instanceof Error ? error.message : String(error)
      })
      return res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      })
    }
  }

  // DELETE PHOTO
  if (action === 'delete-photo') {
    logger.info('delete-photo called', { method: req.method })

    if (req.method !== 'DELETE') {
      logger.error('Method not allowed', { method: req.method })
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const { photoId } = req.body
      logger.info('Deleting photo', { photoId })

      if (!photoId) {
        logger.error('Missing photoId in request')
        return res.status(400).json({ error: 'Photo ID is required' })
      }

      // First, get the photo to find the file paths
      logger.info('Fetching photo details', { photoId })
      type PhotoData = Pick<Database['public']['Tables']['photos']['Row'], 'original_url' | 'aligned_url' | 'user_id'>
      const { data: photo, error: fetchError } = await supabase
        .from('photos')
        .select('original_url, aligned_url, user_id')
        .eq('id', photoId)
        .single() as { data: PhotoData | null; error: unknown }

      if (fetchError) {
        logger.error('Error fetching photo', {
          photoId,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError)
        })
        return res.status(404).json({ error: 'Photo not found' })
      }

      if (!photo) {
        logger.error('Photo not found', { photoId })
        return res.status(404).json({ error: 'Photo not found' })
      }

      logger.info('Photo found', {
        photoId,
        hasOriginal: !!photo.original_url,
        hasAligned: !!photo.aligned_url,
        userId: photo.user_id
      })

      // Extract file paths from URLs for deletion
      const filesToDelete: { bucket: string; path: string }[] = []

      if (photo.original_url) {
        const originalPath = photo.original_url.split('/storage/v1/object/public/originals/')[1]
        if (originalPath) {
          filesToDelete.push({ bucket: 'originals', path: originalPath })
        }
      }

      if (photo.aligned_url) {
        const alignedPath = photo.aligned_url.split('/storage/v1/object/public/aligned/')[1]
        if (alignedPath) {
          filesToDelete.push({ bucket: 'aligned', path: alignedPath })
        }
      }

      logger.info('Files to delete', { count: filesToDelete.length, files: filesToDelete })

      // Delete files from storage buckets
      for (const file of filesToDelete) {
        logger.info('Deleting file', { bucket: file.bucket, path: file.path })
        const { error: deleteError } = await supabase.storage
          .from(file.bucket)
          .remove([file.path])

        if (deleteError) {
          logger.warn('Could not delete file', {
            bucket: file.bucket,
            path: file.path,
            error: deleteError.message
          })
          // Continue with database deletion even if file deletion fails
        } else {
          logger.info('File deleted successfully', { bucket: file.bucket, path: file.path })
        }
      }

      // Delete the database record
      logger.info('Deleting database record', { photoId })
      const { error: dbDeleteError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId)

      if (dbDeleteError) {
        logger.error('Error deleting photo from database', {
          photoId,
          error: dbDeleteError.message
        })
        return res.status(500).json({ error: 'Failed to delete photo from database' })
      }

      logger.info('Photo deleted successfully', { photoId, filesDeleted: filesToDelete.length })
      return res.status(200).json({
        success: true,
        message: 'Photo deleted successfully',
        deletedFiles: filesToDelete.length
      })

    } catch (error) {
      logger.error('Unexpected error in delete-photo', {
        error: error instanceof Error ? error.message : String(error)
      })
      return res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Unknown action
  return res.status(400).json({
    error: 'Invalid action',
    details: 'Use ?action=send-push or ?action=delete-photo'
  })
}
