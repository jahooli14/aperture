const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const sharp = require('sharp');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function redetectEyes() {
  console.log('\n🔍 Re-detecting Eyes with Improved Prompt\n');

  const imageBuffer = fs.readFileSync('./test-output/real-baby-photo.jpg');
  const base64 = imageBuffer.toString('base64');

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = `You are an expert at detecting facial features in baby photos.

Analyze this baby photo and detect the CENTER of each EYE SOCKET with sub-pixel precision.

CRITICAL INSTRUCTIONS:
1. Locate the baby's FACE (not clothing, not background)
2. Find the eye sockets - they are horizontal slits in the middle of the face
3. Eyes may be OPEN (showing iris/pupil) or CLOSED (eyelids shut)
4. For CLOSED eyes: Detect the center of the eyelid crease (the eye socket center)
5. For OPEN eyes: Detect the center of the iris/pupil

IMPORTANT: Return coordinates for the baby's LEFT and RIGHT eyes:
- leftEye: Baby's left eye (appears on RIGHT side of image when facing viewer)
- rightEye: Baby's right eye (appears on LEFT side of image when facing viewer)

Return ONLY this JSON structure (coordinates with 1 decimal place):
{
  "leftEye": {"x": number, "y": number},
  "rightEye": {"x": number, "y": number},
  "confidence": number,
  "eyesOpen": boolean,
  "imageWidth": number,
  "imageHeight": number,
  "notes": "Brief description of what you detected"
}

VALIDATION: Make sure x,y coordinates are on the baby's FACE, not on clothing or background!`;

  console.log('Calling Gemini API...\n');

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: base64, mimeType: 'image/jpeg' } },
  ]);

  const detected = JSON.parse(result.response.text());

  console.log('Detected Eyes:');
  console.log('  Left Eye:', detected.leftEye);
  console.log('  Right Eye:', detected.rightEye);
  console.log('  Confidence:', detected.confidence);
  console.log('  Eyes Open:', detected.eyesOpen);
  console.log('  Notes:', detected.notes);
  console.log('');

  // Visualize
  const meta = await sharp(imageBuffer).metadata();
  const markerSvg = `
    <svg width="${meta.width}" height="${meta.height}">
      <circle cx="${detected.leftEye.x}" cy="${detected.leftEye.y}" r="30" fill="none" stroke="lime" stroke-width="4"/>
      <circle cx="${detected.rightEye.x}" cy="${detected.rightEye.y}" r="30" fill="none" stroke="red" stroke-width="4"/>
      <text x="${detected.leftEye.x}" y="${detected.leftEye.y - 40}" fill="lime" font-size="20" font-weight="bold" text-anchor="middle">L (${detected.leftEye.x.toFixed(0)}, ${detected.leftEye.y.toFixed(0)})</text>
      <text x="${detected.rightEye.x}" y="${detected.rightEye.y - 40}" fill="red" font-size="20" font-weight="bold" text-anchor="middle">R (${detected.rightEye.x.toFixed(0)}, ${detected.rightEye.y.toFixed(0)})</text>
    </svg>
  `;

  await sharp(imageBuffer)
    .composite([{ input: Buffer.from(markerSvg), top: 0, left: 0 }])
    .toFile('./test-output/redetected-eyes-marked.jpg');

  console.log('✅ Saved: ./test-output/redetected-eyes-marked.jpg');
  console.log('👁️  CHECK THIS IMAGE - Are the markers on the actual eyes?\n');

  // Save for next test
  fs.writeFileSync('./test-output/redetected-eyes.json', JSON.stringify(detected, null, 2));
  console.log('💾 Saved coordinates to: ./test-output/redetected-eyes.json\n');

  return detected;
}

redetectEyes().catch(console.error);
