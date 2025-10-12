const sharp = require('sharp');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Test Gemini re-detection on rotated synthetic images
 * This tests if Gemini can accurately detect eyes in rotated images
 */
async function testGeminiRedetection() {
  console.log('\n🧪 Testing Gemini Re-Detection on Rotated Images\n');

  // Test Case: Synthetic image with colored circles representing eyes
  const testCase = {
    name: 'synthetic-tilted',
    leftEye: { x: 454.2, y: 316.7 },
    rightEye: { x: 267.8, y: 323.5 },
    imageWidth: 768,
    imageHeight: 1024,
  };

  console.log('Original eye positions:', testCase.leftEye, testCase.rightEye);

  // STEP 1: Generate synthetic test image with tilted eyes
  const buffer = Buffer.alloc(testCase.imageWidth * testCase.imageHeight * 3, 200);

  // Draw left eye (blue circle)
  for (let y = -30; y <= 30; y++) {
    for (let x = -30; x <= 30; x++) {
      if (x * x + y * y <= 900) {
        const px = Math.floor(testCase.leftEye.x + x);
        const py = Math.floor(testCase.leftEye.y + y);
        if (px >= 0 && px < testCase.imageWidth && py >= 0 && py < testCase.imageHeight) {
          const idx = (py * testCase.imageWidth + px) * 3;
          buffer[idx] = 0;
          buffer[idx + 1] = 0;
          buffer[idx + 2] = 255;
        }
      }
    }
  }

  // Draw right eye (red circle)
  for (let y = -30; y <= 30; y++) {
    for (let x = -30; x <= 30; x++) {
      if (x * x + y * y <= 900) {
        const px = Math.floor(testCase.rightEye.x + x);
        const py = Math.floor(testCase.rightEye.y + y);
        if (px >= 0 && px < testCase.imageWidth && py >= 0 && py < testCase.imageHeight) {
          const idx = (py * testCase.imageWidth + px) * 3;
          buffer[idx] = 255;
          buffer[idx + 1] = 0;
          buffer[idx + 2] = 0;
        }
      }
    }
  }

  const originalBuffer = await sharp(buffer, {
    raw: { width: testCase.imageWidth, height: testCase.imageHeight, channels: 3 },
  })
    .jpeg()
    .toBuffer();

  await sharp(originalBuffer).toFile('./test-output/gemini-test-original.jpg');
  console.log('✓ Created synthetic test image: ./test-output/gemini-test-original.jpg');

  // STEP 2: Rotate image to level the eyes
  const deltaX = testCase.leftEye.x - testCase.rightEye.x;
  const deltaY = testCase.leftEye.y - testCase.rightEye.y;
  const angleDegrees = -(Math.atan2(deltaY, deltaX) * 180 / Math.PI);

  console.log(`\nRotating by ${angleDegrees.toFixed(2)}° to level eyes...`);

  const rotatedBuffer = await sharp(originalBuffer)
    .rotate(angleDegrees, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer();

  const rotatedMeta = await sharp(rotatedBuffer).metadata();
  await sharp(rotatedBuffer).toFile('./test-output/gemini-test-rotated.jpg');
  console.log(`✓ Rotated image: ./test-output/gemini-test-rotated.jpg (${rotatedMeta.width}x${rotatedMeta.height})`);

  // STEP 3: Call Gemini API to re-detect eyes in rotated image
  console.log('\n📡 Calling Gemini API to detect eyes in rotated image...');

  const rotatedBase64 = rotatedBuffer.toString('base64');
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = `Analyze this image and detect the CENTER of each eye-like circular shape with sub-pixel precision.

This image contains two colored circles representing eyes:
- BLUE circle is the LEFT eye (baby's left, appears on RIGHT side of image)
- RED circle is the RIGHT eye (baby's right, appears on LEFT side of image)

The image has been pre-rotated, so the circles should be nearly horizontal.

Return JSON with this exact structure (coordinates with 1 decimal place):
{
  "leftEye": {"x": number, "y": number},
  "rightEye": {"x": number, "y": number},
  "confidence": number,
  "imageWidth": ${rotatedMeta.width},
  "imageHeight": ${rotatedMeta.height},
  "eyesOpen": true
}

IMPORTANT: leftEye should be the BLUE circle, rightEye should be the RED circle.`;

  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: rotatedBase64, mimeType: 'image/jpeg' } },
    ]);

    const detectedEyes = JSON.parse(result.response.text());

    console.log('\n✅ Gemini Detection Results:');
    console.log('  Left Eye (Blue):', detectedEyes.leftEye);
    console.log('  Right Eye (Red):', detectedEyes.rightEye);
    console.log('  Confidence:', detectedEyes.confidence);
    console.log('  Eyes Open:', detectedEyes.eyesOpen);

    // Validate horizontal alignment
    const yDifference = Math.abs(detectedEyes.leftEye.y - detectedEyes.rightEye.y);
    console.log('\n📊 Validation:');
    console.log('  Y-axis difference:', yDifference.toFixed(2) + 'px', yDifference < 10 ? '✅' : '❌');

    // Calculate inter-eye distance
    const distance = Math.sqrt(
      Math.pow(detectedEyes.leftEye.x - detectedEyes.rightEye.x, 2) +
      Math.pow(detectedEyes.leftEye.y - detectedEyes.rightEye.y, 2)
    );
    const percent = (distance / rotatedMeta.width) * 100;
    console.log('  Inter-eye distance:', distance.toFixed(2) + 'px (' + percent.toFixed(1) + '% of width)');

    // Draw detected positions on rotated image
    const markerSvg = `
      <svg width="${rotatedMeta.width}" height="${rotatedMeta.height}">
        <!-- Detected positions -->
        <circle cx="${detectedEyes.leftEye.x}" cy="${detectedEyes.leftEye.y}" r="50" fill="none" stroke="lime" stroke-width="4"/>
        <circle cx="${detectedEyes.rightEye.x}" cy="${detectedEyes.rightEye.y}" r="50" fill="none" stroke="orange" stroke-width="4"/>

        <!-- Labels -->
        <text x="${detectedEyes.leftEye.x}" y="${detectedEyes.leftEye.y - 60}" fill="lime" font-size="24" font-weight="bold" text-anchor="middle">DETECTED L</text>
        <text x="${detectedEyes.rightEye.x}" y="${detectedEyes.rightEye.y - 60}" fill="orange" font-size="24" font-weight="bold" text-anchor="middle">DETECTED R</text>

        <!-- Horizontal line -->
        <line x1="0" y1="${detectedEyes.leftEye.y}" x2="${rotatedMeta.width}" y2="${detectedEyes.leftEye.y}" stroke="yellow" stroke-width="2" stroke-dasharray="10,10"/>
        <line x1="0" y1="${detectedEyes.rightEye.y}" x2="${rotatedMeta.width}" y2="${detectedEyes.rightEye.y}" stroke="yellow" stroke-width="2" stroke-dasharray="10,10"/>
      </svg>
    `;

    await sharp(rotatedBuffer)
      .composite([{
        input: Buffer.from(markerSvg),
        top: 0,
        left: 0,
      }])
      .toFile('./test-output/gemini-test-detected.jpg');

    console.log('\n📁 Output: ./test-output/gemini-test-detected.jpg');
    console.log('   Check if lime/orange circles align with blue/red circles!\n');

    if (yDifference < 10) {
      console.log('✅ SUCCESS: Gemini successfully detected horizontal eye positions after rotation!\n');
    } else {
      console.log('⚠️  WARNING: Eyes not perfectly horizontal, but may still work.\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR calling Gemini API:', error.message);
    console.error('   Make sure GEMINI_API_KEY is set in .env file\n');
    throw error;
  }
}

// Run test
testGeminiRedetection().catch(console.error);
