import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_API_KEY;
console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND');

if (!apiKey) {
  console.error('No API key found');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

console.log('Testing Gemini API...');

try {
  const result = await model.generateContent('Say hello in one sentence');
  const response = await result.response;
  console.log('✅ Success:', response.text());
} catch (error) {
  console.error('❌ Error:', error);
}
