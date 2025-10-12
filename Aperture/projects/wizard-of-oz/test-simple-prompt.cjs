const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const sharp = require('sharp');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testSimplePrompt() {
  console.log('\n🧪 Testing Ultra-Simple Prompt\n');

  const imageBuffer = fs.readFileSync('./test-output/real-baby-photo.jpg');
  const base64 = imageBuffer.toString('base64');

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = `Review this image of a face. The eyes may be open or closed, but there will be a pair of eyes somewhere in the photo. Return the x/y coordinate pairs of the 2 eyes.

Return JSON:
{
  "leftEye": {"x": number, "y": number},
  "rightEye": {"x": number, "y": number}
}`;

  console.log('Calling Gemini with simple prompt...\n');

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: base64, mimeType: 'image/jpeg' } },
  ]);

  const detected = JSON.parse(result.response.text());

  console.log('Detected:');
  console.log('  Left Eye:', detected.leftEye);
  console.log('  Right Eye:', detected.rightEye);
  console.log('');

  // Visualize
  const meta = await sharp(imageBuffer).metadata();
  const markerSvg = `
    <svg width="${meta.width}" height="${meta.height}">
      <circle cx="${detected.leftEye.x}" cy="${detected.leftEye.y}" r="30" fill="none" stroke="lime" stroke-width="4"/>
      <circle cx="${detected.rightEye.x}" cy="${detected.rightEye.y}" r="30" fill="none" stroke="red" stroke-width="4"/>
      <text x="${detected.leftEye.x}" y="${detected.leftEye.y - 40}" fill="lime" font-size="20" font-weight="bold" text-anchor="middle">L (${Math.round(detected.leftEye.x)}, ${Math.round(detected.leftEye.y)})</text>
      <text x="${detected.rightEye.x}" y="${detected.rightEye.y - 40}" fill="red" font-size="20" font-weight="bold" text-anchor="middle">R (${Math.round(detected.rightEye.x)}, ${Math.round(detected.rightEye.y)})</text>
    </svg>
  `;

  await sharp(imageBuffer)
    .composite([{ input: Buffer.from(markerSvg), top: 0, left: 0 }])
    .toFile('./test-output/simple-prompt-marked.jpg');

  console.log('✅ Saved: ./test-output/simple-prompt-marked.jpg');
  console.log('👁️  CHECK: Are markers on the actual eyes?\n');

  fs.writeFileSync('./test-output/simple-prompt-detection.json', JSON.stringify(detected, null, 2));

  return detected;
}

testSimplePrompt().catch(console.error);
