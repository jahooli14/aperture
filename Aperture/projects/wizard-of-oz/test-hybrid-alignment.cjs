const sharp = require('sharp');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Target positions in output image
const TARGET_LEFT_EYE = { x: 720, y: 432 };
const TARGET_RIGHT_EYE = { x: 360, y: 432 };
const TARGET_INTER_EYE_DISTANCE = 360;
const OUTPUT_SIZE = 1080;

/**
 * Test cases with real production data
 * These are actual eye coordinates detected by Gemini in production
 */
const testCases = [
  {
    name: 'photo1-level',
    description: 'Nearly level photo (small rotation)',
    imagePath: './test-images/test1.jpg', // You'll need to provide test images
    detectedEyes: {
      leftEye: { x: 454.2, y: 316.7 },
      rightEye: { x: 267.8, y: 323.5 },
      imageWidth: 768,
      imageHeight: 1024,
    },
  },
  {
    name: 'photo2-tilted',
    description: 'Moderately tilted photo',
    detectedEyes: {
      leftEye: { x: 451.6, y: 336.0 },
      rightEye: { x: 246.3, y: 341.8 },
      imageWidth: 768,
      imageHeight: 1024,
    },
  },
  {
    name: 'photo3-tilted',
    description: 'More tilted photo',
    detectedEyes: {
      leftEye: { x: 531.8, y: 349.9 },
      rightEye: { x: 298.9, y: 367.6 },
      imageWidth: 768,
      imageHeight: 1024,
    },
  },
];

/**
 * Simulate eye detection using mock data instead of real API call
 * In production, this would call Gemini API
 */
async function detectEyesMock(buffer, originalEyes) {
  // For testing, simulate a nearly horizontal result after rotation
  // In reality, we'd call Gemini API here
  const meta = await sharp(buffer).metadata();

  return {
    leftEye: { x: meta.width * 0.6, y: meta.height * 0.4 },
    rightEye: { x: meta.width * 0.4, y: meta.height * 0.4 }, // Same Y = horizontal
    confidence: 0.85,
    imageWidth: meta.width,
    imageHeight: meta.height,
    eyesOpen: true,
  };
}

/**
 * Main hybrid alignment algorithm
 */
async function alignPhotoHybrid(imageBuffer, detectedEyes, testName, useMockDetection = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${testName}`);
  console.log(`${'='.repeat(60)}\n`);

  const logs = [];
  const log = (message, data = {}) => {
    const logEntry = { message, data, timestamp: Date.now() };
    logs.push(logEntry);
    console.log(`[${message}]`, data);
  };

  try {
    // STEP 1: Rotate to level eyes
    log('STEP 1: Rotation');

    const deltaX = detectedEyes.leftEye.x - detectedEyes.rightEye.x;
    const deltaY = detectedEyes.leftEye.y - detectedEyes.rightEye.y;
    const angleRadians = Math.atan2(deltaY, deltaX);
    const angleDegrees = -(angleRadians * 180 / Math.PI);

    log('Calculated rotation angle', {
      deltaX: deltaX.toFixed(2),
      deltaY: deltaY.toFixed(2),
      angleDegrees: angleDegrees.toFixed(2),
    });

    // Validation: reject if rotation is too extreme
    if (Math.abs(angleDegrees) > 45) {
      throw new Error(`Rotation angle too extreme: ${angleDegrees.toFixed(2)}° (max ±45°)`);
    }

    const rotatedBuffer = await sharp(imageBuffer)
      .rotate(angleDegrees, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .toBuffer();

    const rotatedMeta = await sharp(rotatedBuffer).metadata();
    log('Rotation complete', {
      rotatedDimensions: `${rotatedMeta.width}x${rotatedMeta.height}`,
    });

    // Save intermediate image
    await sharp(rotatedBuffer).toFile(`./test-output/${testName}-1-rotated.jpg`);

    // STEP 2: Re-detect eyes in rotated image
    log('STEP 2: Re-detection');

    let rotatedEyes;
    if (useMockDetection) {
      rotatedEyes = await detectEyesMock(rotatedBuffer, detectedEyes);
      log('Using mock detection (test mode)', rotatedEyes);
    } else {
      // Real Gemini API call
      const rotatedBase64 = rotatedBuffer.toString('base64');
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: { responseMimeType: 'application/json' },
      });

      const prompt = `Analyze this baby photo and detect the CENTER of each eye socket with sub-pixel precision.

CRITICAL: Eyes may be OPEN or CLOSED - detect the eye center in BOTH cases.

This image has been pre-rotated, so eyes should be nearly horizontal.

Return JSON with this exact structure (coordinates with 1 decimal place):
{
  "leftEye": {"x": number, "y": number},
  "rightEye": {"x": number, "y": number},
  "confidence": number,
  "imageWidth": ${rotatedMeta.width},
  "imageHeight": ${rotatedMeta.height},
  "eyesOpen": boolean
}`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: rotatedBase64, mimeType: 'image/jpeg' } },
      ]);

      rotatedEyes = JSON.parse(result.response.text());
      log('Gemini re-detection complete', rotatedEyes);
    }

    // Validation: check if eyes are horizontal
    const yDifference = Math.abs(rotatedEyes.leftEye.y - rotatedEyes.rightEye.y);
    if (yDifference > 10) {
      throw new Error(`Eyes not horizontal after rotation: y-difference = ${yDifference.toFixed(2)}px`);
    }

    // Validation: check inter-eye distance
    const detectedDistance = Math.sqrt(
      Math.pow(rotatedEyes.leftEye.x - rotatedEyes.rightEye.x, 2) +
      Math.pow(rotatedEyes.leftEye.y - rotatedEyes.rightEye.y, 2)
    );
    const interEyePercent = (detectedDistance / rotatedMeta.width) * 100;

    if (interEyePercent < 10 || interEyePercent > 50) {
      throw new Error(`Invalid inter-eye distance: ${interEyePercent.toFixed(1)}% of width`);
    }

    log('Re-detection validated', {
      yDifference: yDifference.toFixed(2) + 'px',
      interEyeDistance: detectedDistance.toFixed(2) + 'px',
      interEyePercent: interEyePercent.toFixed(1) + '%',
    });

    // STEP 3: Scale to achieve 360px inter-eye distance
    log('STEP 3: Scaling');

    const scaleFactor = TARGET_INTER_EYE_DISTANCE / detectedDistance;

    // Validation: reasonable scale factor
    if (scaleFactor < 0.5 || scaleFactor > 3.0) {
      throw new Error(`Scale factor out of range: ${scaleFactor.toFixed(2)} (must be 0.5-3.0)`);
    }

    const scaledWidth = Math.round(rotatedMeta.width * scaleFactor);
    const scaledHeight = Math.round(rotatedMeta.height * scaleFactor);

    log('Calculated scaling', {
      scaleFactor: scaleFactor.toFixed(4),
      scaledDimensions: `${scaledWidth}x${scaledHeight}`,
    });

    const scaledBuffer = await sharp(rotatedBuffer)
      .resize(scaledWidth, scaledHeight, {
        kernel: 'lanczos3',
        fit: 'fill',
      })
      .toBuffer();

    // Scale eye coordinates
    const scaledLeftEye = {
      x: rotatedEyes.leftEye.x * scaleFactor,
      y: rotatedEyes.leftEye.y * scaleFactor,
    };
    const scaledRightEye = {
      x: rotatedEyes.rightEye.x * scaleFactor,
      y: rotatedEyes.rightEye.y * scaleFactor,
    };

    // Verify scaled inter-eye distance
    const scaledDistance = Math.sqrt(
      Math.pow(scaledLeftEye.x - scaledRightEye.x, 2) +
      Math.pow(scaledLeftEye.y - scaledRightEye.y, 2)
    );

    log('Scaling complete', {
      scaledEyes: { left: scaledLeftEye, right: scaledRightEye },
      scaledInterEyeDistance: scaledDistance.toFixed(2) + 'px',
      error: Math.abs(scaledDistance - TARGET_INTER_EYE_DISTANCE).toFixed(2) + 'px',
    });

    // Save intermediate image
    await sharp(scaledBuffer).toFile(`./test-output/${testName}-2-scaled.jpg`);

    // STEP 4: Extract 1080x1080 region with eyes at target positions
    log('STEP 4: Extraction');

    const eyeMidX = (scaledLeftEye.x + scaledRightEye.x) / 2;
    const eyeMidY = (scaledLeftEye.y + scaledRightEye.y) / 2;

    const targetMidX = (TARGET_LEFT_EYE.x + TARGET_RIGHT_EYE.x) / 2; // 540
    const targetMidY = TARGET_LEFT_EYE.y; // 432

    let extractLeft = Math.round(eyeMidX - targetMidX);
    let extractTop = Math.round(eyeMidY - targetMidY);

    log('Calculated extraction', {
      eyeMidpoint: { x: eyeMidX.toFixed(2), y: eyeMidY.toFixed(2) },
      targetMidpoint: { x: targetMidX, y: targetMidY },
      extractOffset: { left: extractLeft, top: extractTop },
    });

    // Check if extraction is out of bounds
    let finalBuffer = scaledBuffer;
    const needsExtension =
      extractLeft < 0 || extractTop < 0 ||
      (extractLeft + OUTPUT_SIZE) > scaledWidth ||
      (extractTop + OUTPUT_SIZE) > scaledHeight;

    if (needsExtension) {
      const extendLeft = Math.max(0, -extractLeft);
      const extendTop = Math.max(0, -extractTop);
      const extendRight = Math.max(0, (extractLeft + OUTPUT_SIZE) - scaledWidth);
      const extendBottom = Math.max(0, (extractTop + OUTPUT_SIZE) - scaledHeight);

      log('Canvas extension required', {
        extendLeft,
        extendTop,
        extendRight,
        extendBottom,
      });

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

      log('Adjusted extraction offset', { left: extractLeft, top: extractTop });
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

    log('Extraction complete', { outputSize: `${OUTPUT_SIZE}x${OUTPUT_SIZE}` });

    // Save final output
    await sharp(alignedBuffer).toFile(`./test-output/${testName}-3-final.jpg`);

    // STEP 5: Verification (draw target markers on output)
    log('STEP 5: Creating verification image');

    // Create overlay with target markers
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
      .toFile(`./test-output/${testName}-4-verification.jpg`);

    log('✅ SUCCESS', {
      testName,
      status: 'Complete - check verification image to confirm eye positions',
    });

    return {
      success: true,
      logs,
      outputs: {
        rotated: `./test-output/${testName}-1-rotated.jpg`,
        scaled: `./test-output/${testName}-2-scaled.jpg`,
        final: `./test-output/${testName}-3-final.jpg`,
        verification: `./test-output/${testName}-4-verification.jpg`,
      },
    };

  } catch (error) {
    log('❌ ERROR', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message,
      logs,
    };
  }
}

/**
 * Generate a synthetic test image with colored circles at eye positions
 */
async function generateTestImage(testCase) {
  const { detectedEyes } = testCase;
  const { imageWidth, imageHeight } = detectedEyes;

  // Create gray background
  const buffer = Buffer.alloc(imageWidth * imageHeight * 3, 200);

  // Draw left eye (blue circle)
  for (let y = -30; y <= 30; y++) {
    for (let x = -30; x <= 30; x++) {
      if (x * x + y * y <= 900) {
        const px = Math.floor(detectedEyes.leftEye.x + x);
        const py = Math.floor(detectedEyes.leftEye.y + y);
        if (px >= 0 && px < imageWidth && py >= 0 && py < imageHeight) {
          const idx = (py * imageWidth + px) * 3;
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
        const px = Math.floor(detectedEyes.rightEye.x + x);
        const py = Math.floor(detectedEyes.rightEye.y + y);
        if (px >= 0 && px < imageWidth && py >= 0 && py < imageHeight) {
          const idx = (py * imageWidth + px) * 3;
          buffer[idx] = 255;
          buffer[idx + 1] = 0;
          buffer[idx + 2] = 0;
        }
      }
    }
  }

  return sharp(buffer, {
    raw: { width: imageWidth, height: imageHeight, channels: 3 },
  })
    .jpeg()
    .toBuffer();
}

/**
 * Run all test cases
 */
async function runTests() {
  console.log('\n🧪 Hybrid Alignment Algorithm Test Suite\n');
  console.log('Algorithm: Rotate → Re-Detect → Scale → Extract\n');

  // Check for --real-gemini flag
  const useRealGemini = process.argv.includes('--real-gemini');
  console.log('Detection Mode:', useRealGemini ? '📡 Real Gemini API' : '🤖 Mock Detection\n');

  // Create output directory
  const fs = require('fs');
  if (!fs.existsSync('./test-output')) {
    fs.mkdirSync('./test-output');
  }

  const results = [];

  for (const testCase of testCases) {
    try {
      // Generate synthetic test image
      const testImage = await generateTestImage(testCase);

      // Save original for reference
      await sharp(testImage).toFile(`./test-output/${testCase.name}-0-original.jpg`);

      // Check for --real-gemini flag
      const useRealGemini = process.argv.includes('--real-gemini');

      // Run alignment algorithm
      const result = await alignPhotoHybrid(
        testImage,
        testCase.detectedEyes,
        testCase.name,
        !useRealGemini // Use mock unless --real-gemini flag is present
      );

      results.push({ testCase: testCase.name, ...result });
    } catch (error) {
      console.error(`\n❌ Test failed: ${testCase.name}`, error);
      results.push({
        testCase: testCase.name,
        success: false,
        error: error.message,
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Total: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  console.log('\nOutput files:');
  console.log('  ./test-output/*-0-original.jpg     - Original test image');
  console.log('  ./test-output/*-1-rotated.jpg      - After rotation');
  console.log('  ./test-output/*-2-scaled.jpg       - After scaling');
  console.log('  ./test-output/*-3-final.jpg        - Final aligned output');
  console.log('  ./test-output/*-4-verification.jpg - With target markers\n');

  console.log('👉 Check the verification images to confirm eyes align with targets!\n');
}

// Run tests
runTests().catch(console.error);
