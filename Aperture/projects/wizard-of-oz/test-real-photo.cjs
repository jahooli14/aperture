const sharp = require('sharp');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Target positions in output image
const TARGET_LEFT_EYE = { x: 720, y: 432 };
const TARGET_RIGHT_EYE = { x: 360, y: 432 };
const TARGET_INTER_EYE_DISTANCE = 360;
const OUTPUT_SIZE = 1080;

async function testRealPhoto() {
  console.log('\n🧪 Testing Hybrid Algorithm with Real Baby Photo\n');
  console.log('Algorithm: Rotate → Re-Detect → Scale → Extract\n');

  // Load metadata
  const metadata = JSON.parse(fs.readFileSync('./test-output/real-baby-photo-metadata.json', 'utf8'));
  const detectedEyes = metadata.detectedEyes;

  console.log('Photo ID:', metadata.photoId);
  console.log('Original detection:');
  console.log('  Left Eye:', detectedEyes.leftEye);
  console.log('  Right Eye:', detectedEyes.rightEye);
  console.log('  Confidence:', detectedEyes.confidence);
  console.log('  Eyes Open:', detectedEyes.eyesOpen);
  console.log('');

  // Load image
  const imageBuffer = fs.readFileSync('./test-output/real-baby-photo.jpg');

  try {
    // STEP 1: Rotate to level eyes
    console.log('STEP 1: Rotation');
    const deltaX = detectedEyes.leftEye.x - detectedEyes.rightEye.x;
    const deltaY = detectedEyes.leftEye.y - detectedEyes.rightEye.y;
    const angleRadians = Math.atan2(deltaY, deltaX);
    const angleDegrees = -(angleRadians * 180 / Math.PI);

    console.log('  Rotation angle:', angleDegrees.toFixed(2) + '°');

    const rotatedBuffer = await sharp(imageBuffer)
      .rotate(angleDegrees, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .toBuffer();

    const rotatedMeta = await sharp(rotatedBuffer).metadata();
    console.log('  Rotated size:', `${rotatedMeta.width}x${rotatedMeta.height}`);

    await sharp(rotatedBuffer).toFile('./test-output/real-1-rotated.jpg');
    console.log('  ✅ Saved: ./test-output/real-1-rotated.jpg\n');

    // STEP 2: Re-detect eyes with Gemini
    console.log('STEP 2: Re-Detection with Gemini API');
    const rotatedBase64 = rotatedBuffer.toString('base64');
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `Analyze this baby photo and detect the CENTER of each eye socket with sub-pixel precision.

CRITICAL: Eyes may be OPEN or CLOSED - detect the eye center in BOTH cases:
- If eyes are OPEN: Detect the exact center of the iris/pupil
- If eyes are CLOSED: Detect the center of the eye socket beneath the eyelid

This image has been pre-rotated, so eyes should be nearly horizontal.

Return JSON with this exact structure (coordinates with 1 decimal place):
{
  "leftEye": {"x": number, "y": number},
  "rightEye": {"x": number, "y": number},
  "confidence": number,
  "imageWidth": ${rotatedMeta.width},
  "imageHeight": ${rotatedMeta.height},
  "eyesOpen": boolean
}

VALIDATION:
- leftEye is baby's left (RIGHT side of image)
- rightEye is baby's right (LEFT side of image)`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: rotatedBase64, mimeType: 'image/jpeg' } },
    ]);

    const rotatedEyes = JSON.parse(result.response.text());
    console.log('  Detected:');
    console.log('    Left Eye:', rotatedEyes.leftEye);
    console.log('    Right Eye:', rotatedEyes.rightEye);
    console.log('    Confidence:', rotatedEyes.confidence);

    const yDiff = Math.abs(rotatedEyes.leftEye.y - rotatedEyes.rightEye.y);
    console.log('  Y-difference:', yDiff.toFixed(2) + 'px', yDiff < 10 ? '✅' : '⚠️');
    console.log('');

    // STEP 3: Scale to achieve 360px inter-eye distance
    console.log('STEP 3: Scaling');
    const detectedDistance = Math.sqrt(
      Math.pow(rotatedEyes.leftEye.x - rotatedEyes.rightEye.x, 2) +
      Math.pow(rotatedEyes.leftEye.y - rotatedEyes.rightEye.y, 2)
    );
    const scaleFactor = TARGET_INTER_EYE_DISTANCE / detectedDistance;

    console.log('  Scale factor:', scaleFactor.toFixed(4));
    console.log('  Inter-eye distance:', detectedDistance.toFixed(2) + 'px → 360px');

    const scaledWidth = Math.round(rotatedMeta.width * scaleFactor);
    const scaledHeight = Math.round(rotatedMeta.height * scaleFactor);

    const scaledBuffer = await sharp(rotatedBuffer)
      .resize(scaledWidth, scaledHeight, {
        kernel: 'lanczos3',
        fit: 'fill',
      })
      .toBuffer();

    console.log('  Scaled size:', `${scaledWidth}x${scaledHeight}`);

    const scaledLeftEye = {
      x: rotatedEyes.leftEye.x * scaleFactor,
      y: rotatedEyes.leftEye.y * scaleFactor,
    };
    const scaledRightEye = {
      x: rotatedEyes.rightEye.x * scaleFactor,
      y: rotatedEyes.rightEye.y * scaleFactor,
    };

    await sharp(scaledBuffer).toFile('./test-output/real-2-scaled.jpg');
    console.log('  ✅ Saved: ./test-output/real-2-scaled.jpg\n');

    // STEP 4: Extract 1080x1080 region
    console.log('STEP 4: Extraction');
    const eyeMidX = (scaledLeftEye.x + scaledRightEye.x) / 2;
    const eyeMidY = (scaledLeftEye.y + scaledRightEye.y) / 2;

    const targetMidX = (TARGET_LEFT_EYE.x + TARGET_RIGHT_EYE.x) / 2;
    const targetMidY = TARGET_LEFT_EYE.y;

    let extractLeft = Math.round(eyeMidX - targetMidX);
    let extractTop = Math.round(eyeMidY - targetMidY);

    console.log('  Eye midpoint:', { x: eyeMidX.toFixed(2), y: eyeMidY.toFixed(2) });
    console.log('  Extract offset:', { left: extractLeft, top: extractTop });

    let finalBuffer = scaledBuffer;

    // Handle out of bounds
    if (extractLeft < 0 || extractTop < 0 ||
        (extractLeft + OUTPUT_SIZE) > scaledWidth ||
        (extractTop + OUTPUT_SIZE) > scaledHeight) {

      const extendLeft = Math.max(0, -extractLeft);
      const extendTop = Math.max(0, -extractTop);
      const extendRight = Math.max(0, (extractLeft + OUTPUT_SIZE) - scaledWidth);
      const extendBottom = Math.max(0, (extractTop + OUTPUT_SIZE) - scaledHeight);

      console.log('  Canvas extension:', { extendLeft, extendTop, extendRight, extendBottom });

      finalBuffer = await sharp(scaledBuffer)
        .extend({
          top: extendTop,
          bottom: extendBottom,
          left: extendLeft,
          right: extendRight,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .toBuffer();

      extractLeft += extendLeft;
      extractTop += extendTop;
    }

    const alignedBuffer = await sharp(finalBuffer)
      .extract({
        left: extractLeft,
        top: extractTop,
        width: OUTPUT_SIZE,
        height: OUTPUT_SIZE,
      })
      .jpeg({ quality: 95 })
      .toBuffer();

    await sharp(alignedBuffer).toFile('./test-output/real-3-final.jpg');
    console.log('  ✅ Saved: ./test-output/real-3-final.jpg\n');

    // STEP 5: Verification with markers
    console.log('STEP 5: Creating Verification Image');

    const targetMarkerSvg = `
      <svg width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE}">
        <!-- Target circles -->
        <circle cx="${TARGET_LEFT_EYE.x}" cy="${TARGET_LEFT_EYE.y}" r="40" fill="none" stroke="lime" stroke-width="3"/>
        <circle cx="${TARGET_RIGHT_EYE.x}" cy="${TARGET_RIGHT_EYE.y}" r="40" fill="none" stroke="red" stroke-width="3"/>

        <!-- Target labels -->
        <text x="${TARGET_LEFT_EYE.x}" y="${TARGET_LEFT_EYE.y - 50}" fill="lime" font-size="20" font-weight="bold" text-anchor="middle">L TARGET</text>
        <text x="${TARGET_RIGHT_EYE.x}" y="${TARGET_RIGHT_EYE.y - 50}" fill="red" font-size="20" font-weight="bold" text-anchor="middle">R TARGET</text>

        <!-- Center line -->
        <line x1="0" y1="${TARGET_LEFT_EYE.y}" x2="${OUTPUT_SIZE}" y2="${TARGET_LEFT_EYE.y}" stroke="yellow" stroke-width="2" stroke-dasharray="5,5"/>
      </svg>
    `;

    await sharp(alignedBuffer)
      .composite([{
        input: Buffer.from(targetMarkerSvg),
        top: 0,
        left: 0,
      }])
      .toFile('./test-output/real-4-verification.jpg');

    console.log('  ✅ Saved: ./test-output/real-4-verification.jpg\n');

    // STEP 6: Final verification with Gemini
    console.log('STEP 6: Final Verification');
    const verifyBase64 = alignedBuffer.toString('base64');

    const verifyResult = await model.generateContent([
      {
        text: 'Detect the CENTER of each eye in this baby photo. ' +
              'Return ONLY valid JSON: ' +
              '{"leftEye": {"x": number, "y": number}, "rightEye": {"x": number, "y": number}}'
      },
      { inlineData: { data: verifyBase64, mimeType: 'image/jpeg' } }
    ]);

    const actualEyes = JSON.parse(verifyResult.response.text());

    const leftError = {
      x: actualEyes.leftEye.x - TARGET_LEFT_EYE.x,
      y: actualEyes.leftEye.y - TARGET_LEFT_EYE.y,
    };
    const rightError = {
      x: actualEyes.rightEye.x - TARGET_RIGHT_EYE.x,
      y: actualEyes.rightEye.y - TARGET_RIGHT_EYE.y,
    };

    const maxError = Math.max(
      Math.abs(leftError.x), Math.abs(leftError.y),
      Math.abs(rightError.x), Math.abs(rightError.y)
    );

    console.log('  Actual positions in output:');
    console.log('    Left Eye:', actualEyes.leftEye);
    console.log('    Right Eye:', actualEyes.rightEye);
    console.log('');
    console.log('  Error from targets:');
    console.log('    Left Eye:', `(${leftError.x.toFixed(1)}, ${leftError.y.toFixed(1)}) px`);
    console.log('    Right Eye:', `(${rightError.x.toFixed(1)}, ${rightError.y.toFixed(1)}) px`);
    console.log('    Max Error:', maxError.toFixed(1) + 'px');
    console.log('');

    if (maxError <= 20) {
      console.log('✅ SUCCESS: Alignment within acceptable tolerance (<= 20px)');
    } else if (maxError <= 50) {
      console.log('⚠️  WARNING: Alignment outside preferred range but usable (20-50px)');
    } else {
      console.log('❌ FAILED: Alignment error too large (> 50px)');
    }

    console.log('\n📁 Output files:');
    console.log('  ./test-output/real-baby-photo.jpg         - Original');
    console.log('  ./test-output/real-1-rotated.jpg          - After rotation');
    console.log('  ./test-output/real-2-scaled.jpg           - After scaling');
    console.log('  ./test-output/real-3-final.jpg            - Final aligned (1080x1080)');
    console.log('  ./test-output/real-4-verification.jpg     - With target markers\n');

    console.log('👉 Check real-4-verification.jpg to visually confirm alignment!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRealPhoto().catch(console.error);
