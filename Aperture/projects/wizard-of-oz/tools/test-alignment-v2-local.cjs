const sharp = require('sharp');
const fs = require('fs');

/**
 * Local test of Alignment V2 algorithm
 * Uses the newest photo's eye coordinates to verify alignment works correctly
 */

const TARGET_LEFT_EYE = { x: 720, y: 432 };
const TARGET_RIGHT_EYE = { x: 360, y: 432 };
const TARGET_INTER_EYE_DISTANCE = 360;
const OUTPUT_SIZE = 1080;

// Test case from newest uploaded photo
const test = {
  name: 'newest-photo',
  leftEye: { x: 453.5, y: 336.9 },
  rightEye: { x: 253.2, y: 348.9 },
  imageWidth: 768,
  imageHeight: 1024,
};

async function testAlignment() {
  console.log('=== TESTING ALIGNMENT V2 LOCALLY ===');
  console.log('Test:', test.name);
  console.log('Input size:', test.imageWidth, 'x', test.imageHeight);
  console.log('Detected eyes:', { left: test.leftEye, right: test.rightEye });

  // Download original image (use the newest-aligned.jpg we already have, but we'll re-process it)
  // For this test, we'll use a sample image
  if (!fs.existsSync('newest-aligned.jpg')) {
    console.error('Error: newest-aligned.jpg not found. Download it first.');
    return;
  }

  // For testing, we'll create a fake original at the right size
  // In reality, we'd download the actual original photo
  console.log('\n⚠️  NOTE: Using aligned photo as proxy for original (for testing math only)');

  // STEP 1: Calculate scale factor
  const detectedInterEyeDistance = Math.sqrt(
    Math.pow(test.leftEye.x - test.rightEye.x, 2) +
    Math.pow(test.leftEye.y - test.rightEye.y, 2)
  );

  console.log('\nDetected inter-eye distance:', detectedInterEyeDistance.toFixed(2), 'px');

  const scale = TARGET_INTER_EYE_DISTANCE / detectedInterEyeDistance;
  console.log('Scale factor:', scale.toFixed(4));

  // STEP 2: Calculate scaled dimensions
  const scaledWidth = Math.round(test.imageWidth * scale);
  const scaledHeight = Math.round(test.imageHeight * scale);
  console.log('Scaled dimensions:', scaledWidth, 'x', scaledHeight);

  // STEP 3: Calculate scaled eye positions
  const scaledLeftEye = {
    x: test.leftEye.x * scale,
    y: test.leftEye.y * scale,
  };
  const scaledRightEye = {
    x: test.rightEye.x * scale,
    y: test.rightEye.y * scale,
  };

  console.log('\nScaled eye positions:');
  console.log('  Left:', { x: scaledLeftEye.x.toFixed(2), y: scaledLeftEye.y.toFixed(2) });
  console.log('  Right:', { x: scaledRightEye.x.toFixed(2), y: scaledRightEye.y.toFixed(2) });

  // STEP 4: Calculate extraction offset
  const extractLeft = Math.round(scaledLeftEye.x - TARGET_LEFT_EYE.x);
  const extractTop = Math.round(scaledLeftEye.y - TARGET_LEFT_EYE.y);

  console.log('\nExtraction offset:', { left: extractLeft, top: extractTop });

  // STEP 5: Predict final positions
  const finalLeftEye = {
    x: scaledLeftEye.x - extractLeft,
    y: scaledLeftEye.y - extractTop,
  };
  const finalRightEye = {
    x: scaledRightEye.x - extractLeft,
    y: scaledRightEye.y - extractTop,
  };

  console.log('\n=== VERIFICATION ===');
  console.log('PREDICTED final positions:');
  console.log('  Left eye:', { x: finalLeftEye.x.toFixed(2), y: finalLeftEye.y.toFixed(2) });
  console.log('  Right eye:', { x: finalRightEye.x.toFixed(2), y: finalRightEye.y.toFixed(2) });

  console.log('\nEXPECTED final positions:');
  console.log('  Left eye:', TARGET_LEFT_EYE);
  console.log('  Right eye:', TARGET_RIGHT_EYE);

  console.log('\nERROR (should be ~0):');
  console.log('  Left eye:', {
    x: (finalLeftEye.x - TARGET_LEFT_EYE.x).toFixed(2) + 'px',
    y: (finalLeftEye.y - TARGET_LEFT_EYE.y).toFixed(2) + 'px',
  });
  console.log('  Right eye:', {
    x: (finalRightEye.x - TARGET_RIGHT_EYE.x).toFixed(2) + 'px',
    y: (finalRightEye.y - TARGET_RIGHT_EYE.y).toFixed(2) + 'px',
  });

  const maxError = Math.max(
    Math.abs(finalLeftEye.x - TARGET_LEFT_EYE.x),
    Math.abs(finalLeftEye.y - TARGET_LEFT_EYE.y),
    Math.abs(finalRightEye.x - TARGET_RIGHT_EYE.x),
    Math.abs(finalRightEye.y - TARGET_RIGHT_EYE.y)
  );

  console.log('\nMax error:', maxError.toFixed(2) + 'px');

  if (maxError < 1.0) {
    console.log('✅ ALGORITHM IS MATHEMATICALLY CORRECT (error < 1px)');
  } else {
    console.log('❌ ALGORITHM HAS ERRORS (error >= 1px)');
  }

  console.log('\n=== TEST COMPLETE ===');
}

testAlignment().catch(console.error);
