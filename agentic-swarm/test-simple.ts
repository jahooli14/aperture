console.log('Test simple script working');
import 'dotenv/config';
console.log('Dotenv loaded');
console.log('Google API Key present:', !!process.env.GOOGLE_API_KEY);
