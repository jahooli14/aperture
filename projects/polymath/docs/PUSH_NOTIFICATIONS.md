# Setting up Bedtime Push Notifications (9:30 PM)

To get a notification at 9:30 PM even when the app is closed, we need to use the **Web Push API**.

## Prerequisites
1.  **VAPID Keys:** You need a public/private key pair to secure your push messages.
2.  **Service Worker:** We already have one (`sw.js`), but we need to update it to handle `push` events.
3.  **Subscription Storage:** We need to store your device's "Push Subscription" in Supabase so the server knows where to send the message.

## Step-by-Step Implementation Plan

### 1. Generate Keys
Run this in your terminal to generate keys:
```bash
npx web-push generate-vapid-keys
```
Save these in your `.env` (and Vercel Environment Variables):
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

### 2. Update Service Worker (`public/sw.js`)
Add a listener for the `push` event.

```javascript
self.addEventListener('push', function(event) {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/badge.png',
    data: { url: data.url }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

### 3. Create Subscription Table
Run this SQL in Supabase:
```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Client-Side Subscription Logic
In `HomePage.tsx` or a settings component, add a button to "Enable Notifications".

```typescript
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  });

  // Send subscription to backend
  await fetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription)
  });
}
```

### 5. The 9:30 PM Trigger
We already have a cron job running at **21:30 UTC** (check `vercel.json`).
Update `api/cron/jobs.ts` to send the push notification.

```typescript
import webpush from 'web-push';

// In the 9:30 PM block:
if (job === 'daily') {
    // ... generate prompts ...
    
    // Send Push
    webpush.setVapidDetails(
      'mailto:your@email.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const { data: subscriptions } = await supabase.from('push_subscriptions').select('*');
    
    subscriptions.forEach(sub => {
        webpush.sendNotification(sub, JSON.stringify({
            title: "🌙 Bedtime Ideas Ready",
            body: "Your subconscious is ready to work. Tap to see tonight's prompts.",
            url: "/bedtime"
        }));
    });
}
```

## Immediate Workaround (Local Notification)
If you don't want to set up VAPID keys yet, you can use **Local Notifications**.
This works only if the app is open or suspended in the background on mobile.

Add this to `HomePage.tsx`:
```typescript
useEffect(() => {
  // Request permission
  if (Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
  
  // Check time every minute
  const interval = setInterval(() => {
    const now = new Date();
    if (now.getHours() === 21 && now.getMinutes() === 30) {
       new Notification("🌙 Bedtime Ideas", { body: "Ready for review" });
    }
  }, 60000);
  
  return () => clearInterval(interval);
}, []);
```
