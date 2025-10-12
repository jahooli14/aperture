const sharp = require('sharp');
const fs = require('fs');

/**
 * Debug script to trace coordinate transformations
 * This will help us find where the 180px Y-axis error is coming from
 */

async function debugCoordinates() {
  console.log('\n🔍 DEBUG: Coordinate Transformation Analysis\n');

  // Load metadata
  const metadata = JSON.parse(fs.readFileSync('./test-output/real-baby-photo-metadata.json', 'utf8'));

  // Simulated data from actual test
  const originalEyes = {
    leftEye: { x: 470.9, y: 318.1 },
    rightEye: { x: 257.3, y: 334.9 },
    imageWidth: 768,
    imageHeight: 1024
  };

  const rotatedEyes = {
    leftEye: { x: 2154.8, y: 1382.5 },
    rightEye: { x: 1247.6, y: 1375.8 },
    imageWidth: 3382,
    imageHeight: 4308
  };

  const TARGET_LEFT_EYE = { x: 720, y: 432 };
  const TARGET_RIGHT_EYE = { x: 360, y: 432 };
  const TARGET_INTER_EYE_DISTANCE = 360;
  const OUTPUT_SIZE = 1080;

  console.log('═══ ORIGINAL IMAGE ═══');
  console.log('Dimensions:', `${originalEyes.imageWidth}x${originalEyes.imageHeight}`);
  console.log('Left eye:', originalEyes.leftEye);
  console.log('Right eye:', originalEyes.rightEye);

  const origDistance = Math.sqrt(
    Math.pow(originalEyes.leftEye.x - originalEyes.rightEye.x, 2) +
    Math.pow(originalEyes.leftEye.y - originalEyes.rightEye.y, 2)
  );
  console.log('Inter-eye distance:', origDistance.toFixed(2) + 'px');
  console.log('');

  console.log('═══ AFTER ROTATION ═══');
  console.log('Dimensions:', `${rotatedEyes.imageWidth}x${rotatedEyes.imageHeight}`);
  console.log('Left eye:', rotatedEyes.leftEye);
  console.log('Right eye:', rotatedEyes.rightEye);

  const rotDistance = Math.sqrt(
    Math.pow(rotatedEyes.leftEye.x - rotatedEyes.rightEye.x, 2) +
    Math.pow(rotatedEyes.leftEye.y - rotatedEyes.rightEye.y, 2)
  );
  console.log('Inter-eye distance:', rotDistance.toFixed(2) + 'px');
  console.log('Y-difference:', Math.abs(rotatedEyes.leftEye.y - rotatedEyes.rightEye.y).toFixed(2) + 'px');
  console.log('');

  console.log('═══ SCALING CALCULATION ═══');
  const scaleFactor = TARGET_INTER_EYE_DISTANCE / rotDistance;
  console.log('Target inter-eye distance:', TARGET_INTER_EYE_DISTANCE + 'px');
  console.log('Current inter-eye distance:', rotDistance.toFixed(2) + 'px');
  console.log('Scale factor:', scaleFactor.toFixed(6));
  console.log('');

  const scaledWidth = Math.round(rotatedEyes.imageWidth * scaleFactor);
  const scaledHeight = Math.round(rotatedEyes.imageHeight * scaleFactor);
  console.log('Scaled dimensions:', `${scaledWidth}x${scaledHeight}`);
  console.log('');

  // Scale eye coordinates
  const scaledLeftEye = {
    x: rotatedEyes.leftEye.x * scaleFactor,
    y: rotatedEyes.leftEye.y * scaleFactor
  };
  const scaledRightEye = {
    x: rotatedEyes.rightEye.x * scaleFactor,
    y: rotatedEyes.rightEye.y * scaleFactor
  };

  console.log('Scaled left eye:', {
    x: scaledLeftEye.x.toFixed(2),
    y: scaledLeftEye.y.toFixed(2)
  });
  console.log('Scaled right eye:', {
    x: scaledRightEye.x.toFixed(2),
    y: scaledRightEye.y.toFixed(2)
  });

  const scaledDistance = Math.sqrt(
    Math.pow(scaledLeftEye.x - scaledRightEye.x, 2) +
    Math.pow(scaledLeftEye.y - scaledRightEye.y, 2)
  );
  console.log('Scaled inter-eye distance:', scaledDistance.toFixed(2) + 'px (should be 360px)');
  console.log('Error:', Math.abs(scaledDistance - 360).toFixed(2) + 'px');
  console.log('');

  console.log('═══ EXTRACTION CALCULATION ═══');

  // Calculate eye midpoint in scaled image
  const eyeMidX = (scaledLeftEye.x + scaledRightEye.x) / 2;
  const eyeMidY = (scaledLeftEye.y + scaledRightEye.y) / 2;

  console.log('Eye midpoint in scaled image:', {
    x: eyeMidX.toFixed(2),
    y: eyeMidY.toFixed(2)
  });
  console.log('');

  // Calculate target midpoint in output
  const targetMidX = (TARGET_LEFT_EYE.x + TARGET_RIGHT_EYE.x) / 2;
  const targetMidY = TARGET_LEFT_EYE.y;

  console.log('Target midpoint in output:', {
    x: targetMidX,
    y: targetMidY
  });
  console.log('');

  // Calculate extraction offset
  const extractLeft = Math.round(eyeMidX - targetMidX);
  const extractTop = Math.round(eyeMidY - targetMidY);

  console.log('Extraction offset:', {
    left: extractLeft,
    top: extractTop
  });
  console.log('');

  console.log('═══ VERIFICATION ═══');
  console.log('If we extract from offset:', { left: extractLeft, top: extractTop });
  console.log('The eye midpoint should be at:', {
    x: targetMidX,
    y: targetMidY
  });
  console.log('');

  // Simulate where eyes would end up in output
  const outputLeftEye = {
    x: scaledLeftEye.x - extractLeft,
    y: scaledLeftEye.y - extractTop
  };
  const outputRightEye = {
    x: scaledRightEye.x - extractLeft,
    y: scaledRightEye.y - extractTop
  };

  console.log('PREDICTED eye positions in output:');
  console.log('Left eye:', {
    x: outputLeftEye.x.toFixed(2),
    y: outputLeftEye.y.toFixed(2)
  });
  console.log('Right eye:', {
    x: outputRightEye.x.toFixed(2),
    y: outputRightEye.y.toFixed(2)
  });
  console.log('');

  console.log('TARGET eye positions:');
  console.log('Left eye:', TARGET_LEFT_EYE);
  console.log('Right eye:', TARGET_RIGHT_EYE);
  console.log('');

  console.log('PREDICTED ERROR:');
  const predLeftError = {
    x: outputLeftEye.x - TARGET_LEFT_EYE.x,
    y: outputLeftEye.y - TARGET_LEFT_EYE.y
  };
  const predRightError = {
    x: outputRightEye.x - TARGET_RIGHT_EYE.x,
    y: outputRightEye.y - TARGET_RIGHT_EYE.y
  };
  console.log('Left eye error:', {
    x: predLeftError.x.toFixed(2) + 'px',
    y: predLeftError.y.toFixed(2) + 'px'
  });
  console.log('Right eye error:', {
    x: predRightError.x.toFixed(2) + 'px',
    y: predRightError.y.toFixed(2) + 'px'
  });
  console.log('');

  console.log('ACTUAL (from Gemini verification):');
  console.log('Left eye: { x: 452, y: 265 }  (but might be mislabeled)');
  console.log('Right eye: { x: 672, y: 245 }  (but might be mislabeled)');
  console.log('');

  console.log('═══ ANALYSIS ═══');
  const maxPredError = Math.max(
    Math.abs(predLeftError.x), Math.abs(predLeftError.y),
    Math.abs(predRightError.x), Math.abs(predRightError.y)
  );
  console.log('Maximum predicted error:', maxPredError.toFixed(2) + 'px');

  if (maxPredError < 1) {
    console.log('✅ Math is PERFECT - error must be in Gemini detection or Sharp processing');
  } else if (maxPredError < 20) {
    console.log('✅ Math is GOOD - small rounding errors are acceptable');
  } else {
    console.log('❌ Math has SIGNIFICANT ERROR - calculation bug detected');
  }
  console.log('');

  console.log('💡 HYPOTHESIS:');
  console.log('If predicted error is small but actual error is large (~180px),');
  console.log('then the problem is likely:');
  console.log('1. Sharp\'s image processing introduces coordinate drift');
  console.log('2. Gemini\'s re-detection is inaccurate');
  console.log('3. There\'s a coordinate system mismatch somewhere');
  console.log('');
}

debugCoordinates().catch(console.error);
