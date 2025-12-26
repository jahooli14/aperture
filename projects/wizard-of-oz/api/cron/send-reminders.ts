/**
 * Cron Job: Send Daily Photo Reminders
 *
 * This endpoint is called by Vercel Cron at 3pm UTC daily (configured in vercel.json)
 * It sends push notifications to users who:
 * 1. Have reminders enabled
 * 2. Have a valid push subscription
 * 3. Haven't uploaded a photo today
 *
 * Schedule: 0 15 * * * (3pm UTC - good for UK afternoon reminders)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import type { Database } from '../../src/types/database.js'

// Initialize Supabase with service role key for admin operations
const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

// VAPID keys for web push
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY!
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:notifications@pupils.app'

// Configure web push
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

// Logger for production
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

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a cron request (Vercel adds this header)
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET

  // In production, verify the cron secret if configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Unauthorized cron request attempted')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  logger.info('Starting daily reminder cron job')

  try {
    const today = getTodayDate()

    // 1. Get all users who have reminders enabled and have a push subscription
    const { data: usersWithReminders, error: fetchError } = await supabase
      .from('user_settings')
      .select('user_id, push_subscription, reminder_time, timezone')
      .eq('reminders_enabled', true)
      .not('push_subscription', 'is', null)

    if (fetchError) {
      logger.error('Failed to fetch users with reminders', { error: fetchError.message })
      return res.status(500).json({ error: 'Failed to fetch users' })
    }

    if (!usersWithReminders || usersWithReminders.length === 0) {
      logger.info('No users with reminders enabled')
      return res.status(200).json({ message: 'No users to notify', sent: 0 })
    }

    logger.info('Found users with reminders enabled', { count: usersWithReminders.length })

    // 2. Get all photos uploaded today to check who has already uploaded
    const { data: todaysPhotos, error: photosError } = await supabase
      .from('photos')
      .select('user_id')
      .eq('upload_date', today)

    if (photosError) {
      logger.error('Failed to fetch today\'s photos', { error: photosError.message })
      return res.status(500).json({ error: 'Failed to fetch photos' })
    }

    // Create a Set of user IDs who have already uploaded today
    const usersWithPhotosToday = new Set(
      (todaysPhotos || []).map(photo => photo.user_id)
    )

    logger.info('Users who have already uploaded today', { count: usersWithPhotosToday.size })

    // 3. Filter to users who haven't uploaded today
    const usersToNotify = usersWithReminders.filter(
      user => !usersWithPhotosToday.has(user.user_id)
    )

    logger.info('Users to notify', { count: usersToNotify.length })

    // 4. Send push notifications
    let successCount = 0
    let failureCount = 0
    const expiredSubscriptions: string[] = []

    for (const user of usersToNotify) {
      if (!user.push_subscription) continue

      try {
        const payload = JSON.stringify({
          title: "Don't forget today's photo!",
          body: 'Capture a moment to add to your timeline',
          url: '/'
        })

        await webpush.sendNotification(user.push_subscription as webpush.PushSubscription, payload)
        successCount++
        logger.info('Push notification sent', { userId: user.user_id })
      } catch (pushError: unknown) {
        const error = pushError as { statusCode?: number; message?: string }
        failureCount++

        // If subscription is expired/invalid (410 or 404), mark for removal
        if (error.statusCode === 410 || error.statusCode === 404) {
          expiredSubscriptions.push(user.user_id)
          logger.warn('Push subscription expired', { userId: user.user_id })
        } else {
          logger.error('Failed to send push notification', {
            userId: user.user_id,
            error: error.message || String(pushError)
          })
        }
      }
    }

    // 5. Clean up expired subscriptions
    if (expiredSubscriptions.length > 0) {
      logger.info('Cleaning up expired subscriptions', { count: expiredSubscriptions.length })

      for (const userId of expiredSubscriptions) {
        await supabase
          .from('user_settings')
          .update({ push_subscription: null } as never)
          .eq('user_id', userId)
      }
    }

    const result = {
      message: 'Daily reminders processed',
      date: today,
      stats: {
        usersWithReminders: usersWithReminders.length,
        usersAlreadyUploaded: usersWithPhotosToday.size,
        notificationsSent: successCount,
        notificationsFailed: failureCount,
        expiredSubscriptionsRemoved: expiredSubscriptions.length
      }
    }

    logger.info('Cron job completed', result)
    return res.status(200).json(result)

  } catch (error) {
    logger.error('Unexpected error in cron job', {
      error: error instanceof Error ? error.message : String(error)
    })
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    })
  }
}
