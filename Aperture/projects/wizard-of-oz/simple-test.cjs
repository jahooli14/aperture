const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const sharp = require('sharp');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
  const buf = fs.readFileSync('./test-output/real-baby-photo.jpg');
  const b64 = buf.toString('base64');
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent([
    'Review this image of a face. The eyes may be open or closed, but there will be a pair of eyes somewhere in the photo. Return the x/y coordinate pairs of the 2 eyes. JSON: {"leftEye": {"x": number, "y": number}, "rightEye": {"x": number, "y": number}}',
    { inlineData: { data: b64, mimeType: 'image/jpeg' } }
  ]);

  const d = JSON.parse(result.response.text());
  console.log('Left:', d.leftEye);
  console.log('Right:', d.rightEye);

  const meta = await sharp(buf).metadata();
  const svg = '<svg width="' + meta.width + '" height="' + meta.height + '"><circle cx="' + d.leftEye.x + '" cy="' + d.leftEye.y + '" r="30" fill="none" stroke="lime" stroke-width="4"/><circle cx="' + d.rightEye.x + '" cy="' + d.rightEye.y + '" r="30" fill="none" stroke="red" stroke-width="4"/></svg>';

  await sharp(buf).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toFile('./test-output/simple-marked.jpg');
  console.log('Saved: ./test-output/simple-marked.jpg');
  fs.writeFileSync('./test-output/simple-coords.json', JSON.stringify(d, null, 2));
}

test();
