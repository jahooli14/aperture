import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Initialize Supabase with service role key for admin operations
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// VAPID keys for web push
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:notifications@pupils.app';

// Configure web push
webpush.setVapidDetails(
  vapidEmail,
  vapidPublicKey,
  vapidPrivateKey
);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, title, body, url } = req.body;

    // Validate input
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Get user's push subscription from database
    const { data: settings, error: fetchError } = await supabase
      .from('user_settings')
      .select('push_subscription')
      .eq('user_id', userId)
      .single();

    if (fetchError || !settings) {
      console.error('Failed to fetch user settings:', fetchError);
      return res.status(404).json({ error: 'User settings not found' });
    }

    if (!settings.push_subscription) {
      return res.status(400).json({ error: 'User has no push subscription' });
    }

    // Prepare notification payload
    const payload = JSON.stringify({
      title: title || 'Pupils Reminder',
      body: body || 'Time to take today\'s photo!',
      url: url || '/'
    });

    // Send push notification
    try {
      await webpush.sendNotification(
        settings.push_subscription,
        payload
      );

      console.log('Push notification sent successfully:', userId);
      return res.status(200).json({ success: true, message: 'Notification sent' });
    } catch (pushError: any) {
      console.error('Failed to send push notification:', pushError);

      // If subscription is invalid/expired, remove it from database
      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        await supabase
          .from('user_settings')
          .update({ push_subscription: null })
          .eq('user_id', userId);

        return res.status(410).json({ error: 'Push subscription expired' });
      }

      throw pushError;
    }
  } catch (error) {
    console.error('Error in send-push handler:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
