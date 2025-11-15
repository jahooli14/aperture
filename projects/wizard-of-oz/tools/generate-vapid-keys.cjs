/**
 * Generate VAPID keys for Web Push notifications
 * Run: node tools/generate-vapid-keys.cjs
 */

const webpush = require('web-push');

console.log('\n🔑 Generating VAPID keys for Web Push notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('='.repeat(60));
console.log('VAPID Keys Generated Successfully!');
console.log('='.repeat(60));
console.log('\nAdd these to your environment variables:\n');
console.log('# Vercel Environment Variables (for production)');
console.log(`VITE_VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`);
console.log(`VAPID_EMAIL="mailto:your-email@example.com"`);
console.log('\n# Local .env file (for development)');
console.log(`VITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:your-email@example.com`);
console.log('\n' + '='.repeat(60));
console.log('\n⚠️  IMPORTANT:');
console.log('1. Add VITE_VAPID_PUBLIC_KEY to Vercel (exposed to client)');
console.log('2. Add VAPID_PRIVATE_KEY to Vercel (secret, server-only)');
console.log('3. Add VAPID_EMAIL to Vercel (your contact email)');
console.log('4. Never commit the private key to git!');
console.log('\n');
