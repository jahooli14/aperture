import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_API_KEY!;
const genAI = new GoogleGenerativeAI(apiKey);

const models = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

for (const modelName of models) {
  try {
    console.log(`\nTesting ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Hi');
    const response = await result.response;
    console.log(`✅ ${modelName} works:`, response.text().substring(0, 50));
  } catch (error: any) {
    console.log(`❌ ${modelName} failed:`, error.message);
  }
}
