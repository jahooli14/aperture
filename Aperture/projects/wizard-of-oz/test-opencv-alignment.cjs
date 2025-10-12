const { spawn } = require('child_process');
const sharp = require('sharp');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const TARGET_LEFT_EYE = { x: 720, y: 432 };
const TARGET_RIGHT_EYE = { x: 360, y: 432 };

/**
 * Call Python OpenCV alignment script
 */
async function alignWithOpenCV(inputPath, outputPath, leftEye, rightEye) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [
      './align_photo_opencv.py',
      inputPath,
      outputPath,
      leftEye.x.toString(),
      leftEye.y.toString(),
      rightEye.x.toString(),
      rightEye.y.toString()
    ]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${stderr}`));
      } else {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      }
    });
  });
}

/**
 * Verify alignment by re-detecting eyes in output image
 */
async function verifyAlignment(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = `Analyze this baby photo and detect the CENTER of each eye socket with sub-pixel precision.

CRITICAL: Eyes may be OPEN or CLOSED - detect the eye center in BOTH cases.

Return JSON with this exact structure:
{
  "leftEye": {"x": number, "y": number},
  "rightEye": {"x": number, "y": number},
  "confidence": number,
  "eyesOpen": boolean
}

IMPORTANT: leftEye is baby's left (RIGHT side of image), rightEye is baby's right (LEFT side of image).`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: base64, mimeType: 'image/jpeg' } },
  ]);

  return JSON.parse(result.response.text());
}

/**
 * Create visualization with target markers
 */
async function createVerificationImage(inputPath, outputPath) {
  const targetMarkerSvg = `
    <svg width="1080" height="1080">
      <!-- Target circles -->
      <circle cx="${TARGET_LEFT_EYE.x}" cy="${TARGET_LEFT_EYE.y}" r="40" fill="none" stroke="lime" stroke-width="3"/>
      <circle cx="${TARGET_RIGHT_EYE.x}" cy="${TARGET_RIGHT_EYE.y}" r="40" fill="none" stroke="red" stroke-width="3"/>

      <!-- Labels -->
      <text x="${TARGET_LEFT_EYE.x}" y="${TARGET_LEFT_EYE.y - 50}" fill="lime" font-size="20" font-weight="bold" text-anchor="middle">L TARGET</text>
      <text x="${TARGET_RIGHT_EYE.x}" y="${TARGET_RIGHT_EYE.y - 50}" fill="red" font-size="20" font-weight="bold" text-anchor="middle">R TARGET</text>

      <!-- Horizontal line -->
      <line x1="0" y1="${TARGET_LEFT_EYE.y}" x2="1080" y2="${TARGET_LEFT_EYE.y}" stroke="yellow" stroke-width="2" stroke-dasharray="5,5"/>
    </svg>
  `;

  await sharp(inputPath)
    .composite([{
      input: Buffer.from(targetMarkerSvg),
      top: 0,
      left: 0,
    }])
    .toFile(outputPath);
}

/**
 * Main test function
 */
async function testOpenCVAlignment() {
  console.log('\n🧪 Testing OpenCV-based Alignment\n');
  console.log('Algorithm: cv2.getAffineTransform + cv2.warpAffine\n');

  // Load test photo metadata
  const metadata = JSON.parse(fs.readFileSync('./test-output/real-baby-photo-metadata.json', 'utf8'));
  const detectedEyes = metadata.detectedEyes;

  console.log('Photo ID:', metadata.photoId);
  console.log('Original detection:');
  console.log('  Left Eye:', detectedEyes.leftEye);
  console.log('  Right Eye:', detectedEyes.rightEye);
  console.log('  Confidence:', detectedEyes.confidence);
  console.log('');

  try {
    // Call Python OpenCV script
    console.log('═══ STEP 1: Python OpenCV Alignment ═══');
    const result = await alignWithOpenCV(
      './test-output/real-baby-photo.jpg',
      './test-output/opencv-aligned.jpg',
      detectedEyes.leftEye,
      detectedEyes.rightEye
    );

    console.log('✅ Alignment complete');
    console.log('  Transformation matrix:', result.transformation_matrix);
    console.log('');

    // Create verification image with markers
    console.log('═══ STEP 2: Create Verification Image ═══');
    await createVerificationImage(
      './test-output/opencv-aligned.jpg',
      './test-output/opencv-verification.jpg'
    );
    console.log('✅ Saved: ./test-output/opencv-verification.jpg\n');

    // Verify with Gemini
    console.log('═══ STEP 3: Verify with Gemini Re-detection ═══');
    const actualEyes = await verifyAlignment('./test-output/opencv-aligned.jpg');

    console.log('Detected in aligned image:');
    console.log('  Left Eye:', actualEyes.leftEye);
    console.log('  Right Eye:', actualEyes.rightEye);
    console.log('  Confidence:', actualEyes.confidence);
    console.log('');

    // Calculate errors
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

    console.log('═══ STEP 4: Accuracy Analysis ═══');
    console.log('Target positions:');
    console.log('  Left Eye:', TARGET_LEFT_EYE);
    console.log('  Right Eye:', TARGET_RIGHT_EYE);
    console.log('');
    console.log('Error from targets:');
    console.log('  Left Eye:', `(${leftError.x.toFixed(1)}, ${leftError.y.toFixed(1)}) px`);
    console.log('  Right Eye:', `(${rightError.x.toFixed(1)}, ${rightError.y.toFixed(1)}) px`);
    console.log('  Max Error:', maxError.toFixed(1) + 'px');
    console.log('');

    // Evaluate results
    let status;
    if (maxError <= 20) {
      status = '✅ EXCELLENT';
      console.log(`${status}: Alignment within target tolerance (≤ 20px)`);
    } else if (maxError <= 50) {
      status = '⚠️  ACCEPTABLE';
      console.log(`${status}: Alignment usable but could be better (20-50px)`);
    } else {
      status = '❌ FAILED';
      console.log(`${status}: Alignment error too large (> 50px)`);
    }

    console.log('');
    console.log('📁 Output files:');
    console.log('  ./test-output/opencv-aligned.jpg        - Aligned image');
    console.log('  ./test-output/opencv-verification.jpg   - With target markers');
    console.log('');
    console.log('👁️  VISUAL INSPECTION REQUIRED: Check opencv-verification.jpg');
    console.log('   Make sure eyes are at targets, not nostrils/forehead!');
    console.log('');

    return {
      success: maxError <= 50,
      maxError,
      status,
      leftError,
      rightError,
      actualEyes,
    };

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Run test
testOpenCVAlignment().catch(console.error);
