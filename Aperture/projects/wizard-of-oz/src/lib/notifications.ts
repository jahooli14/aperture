import { supabase } from './supabase';
import { logger } from './logger';

// VAPID public key - will be generated and stored in env vars
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported
 */
export function isPushNotificationSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported in this browser');
  }

  const permission = await Notification.requestPermission();
  logger.info('Notification permission', { permission }, 'Notifications');
  return permission;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  try {
    // Check permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      logger.warn('Notification permission denied', { permission }, 'Notifications');
      // Don't throw - just return null so it doesn't break the app
      return null;
    }

    // Get service worker registration
    logger.info('Getting service worker registration', {}, 'Notifications');
    const registration = await navigator.serviceWorker.ready;
    logger.info('Service worker ready', {}, 'Notifications');

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Create new subscription
      if (!VAPID_PUBLIC_KEY) {
        logger.error('VAPID public key not configured', {
          envVarExists: !!import.meta.env.VITE_VAPID_PUBLIC_KEY
        }, 'Notifications');
        throw new Error('Push notifications are not configured. Missing VAPID public key.');
      }

      logger.info('Creating new push subscription', { vapidKeyLength: VAPID_PUBLIC_KEY.length }, 'Notifications');
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any
      });

      logger.info('Created new push subscription', {}, 'Notifications');
    } else {
      logger.info('Using existing push subscription', {}, 'Notifications');
    }

    // Save subscription to database
    await savePushSubscription(subscription);

    return subscription;
  } catch (error) {
    logger.error('Failed to subscribe to push notifications', {
      error: error instanceof Error ? error.message : String(error)
    }, 'Notifications');
    throw error;
  }
}

/**
 * Save push subscription to database
 */
async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const subscriptionData = subscription.toJSON();

    // Upsert subscription to user_settings
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        push_subscription: subscriptionData as any,
        updated_at: new Date().toISOString()
      } as any, {
        onConflict: 'user_id'
      });

    if (error) {
      throw error;
    }

    logger.info('Saved push subscription to database', {}, 'Notifications');
  } catch (error) {
    logger.error('Failed to save push subscription', {
      error: error instanceof Error ? error.message : String(error)
    }, 'Notifications');
    throw error;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      logger.info('Unsubscribed from push notifications', {}, 'Notifications');

      // Remove from database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        (supabase
          .from('user_settings') as any)
          .update({ push_subscription: null })
          .eq('user_id', user.id);
      }
    }
  } catch (error) {
    logger.error('Failed to unsubscribe from push notifications', {
      error: error instanceof Error ? error.message : String(error)
    }, 'Notifications');
    throw error;
  }
}

/**
 * Get current push subscription status
 */
export async function getPushSubscriptionStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}> {
  const supported = isPushNotificationSupported();

  if (!supported) {
    return {
      supported: false,
      permission: 'denied',
      subscribed: false
    };
  }

  const permission = Notification.permission;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return {
      supported: true,
      permission,
      subscribed: !!subscription
    };
  } catch (error) {
    return {
      supported: true,
      permission,
      subscribed: false
    };
  }
}
