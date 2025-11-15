// Test alignment algorithm with concrete numbers

// Test case - baby facing camera, head tilted 5° clockwise
// Left eye (baby's left) appears on RIGHT side of image
// Right eye (baby's right) appears on LEFT side of image
const originalWidth = 768;
const originalHeight = 1024;
const detectedLeftEye = { x: 500, y: 400 };   // Right side of image, lower
const detectedRightEye = { x: 300, y: 382 };  // Left side of image, higher

console.log('=== INPUT ===');
console.log('Image size:', originalWidth, 'x', originalHeight);
console.log('Left eye:', detectedLeftEye);
console.log('Right eye:', detectedRightEye);

// Calculate rotation angle
const eyeAngle = Math.atan2(
  detectedRightEye.y - detectedLeftEye.y,
  detectedRightEye.x - detectedLeftEye.x
);
const rotationDegrees = -(eyeAngle * 180) / Math.PI;

console.log('\n=== ROTATION ===');
console.log('Eye angle:', (eyeAngle * 180 / Math.PI).toFixed(2), 'degrees');
console.log('Rotation needed:', rotationDegrees.toFixed(2), 'degrees');

// Calculate inter-eye distance
const detectedInterEyeDistance = Math.sqrt(
  Math.pow(detectedRightEye.x - detectedLeftEye.x, 2) +
  Math.pow(detectedRightEye.y - detectedLeftEye.y, 2)
);

const TARGET_INTER_EYE_DISTANCE = 360;
const scaleFactor = TARGET_INTER_EYE_DISTANCE / detectedInterEyeDistance;

console.log('\n=== SCALE ===');
console.log('Detected inter-eye distance:', detectedInterEyeDistance.toFixed(2));
console.log('Target inter-eye distance:', TARGET_INTER_EYE_DISTANCE);
console.log('Scale factor:', scaleFactor.toFixed(3));

// Step 1: Rotate
const angleRadians = (rotationDegrees * Math.PI) / 180;
const cosAngle = Math.cos(angleRadians);
const sinAngle = Math.sin(angleRadians);

const origCenterX = originalWidth / 2;
const origCenterY = originalHeight / 2;

console.log('\n=== STEP 1: ROTATION ===');
console.log('Original center:', origCenterX, origCenterY);
console.log('cos:', cosAngle.toFixed(4), 'sin:', sinAngle.toFixed(4));

// Rotate left eye
const leftRelX = detectedLeftEye.x - origCenterX;
const leftRelY = detectedLeftEye.y - origCenterY;
const rotatedLeftX = leftRelX * cosAngle - leftRelY * sinAngle;
const rotatedLeftY = leftRelX * sinAngle + leftRelY * cosAngle;

console.log('\nLeft eye:');
console.log('  Relative to center:', leftRelX, leftRelY);
console.log('  After rotation:', rotatedLeftX.toFixed(2), rotatedLeftY.toFixed(2));

// Rotate right eye
const rightRelX = detectedRightEye.x - origCenterX;
const rightRelY = detectedRightEye.y - origCenterY;
const rotatedRightX = rightRelX * cosAngle - rightRelY * sinAngle;
const rotatedRightY = rightRelX * sinAngle + rightRelY * cosAngle;

console.log('\nRight eye:');
console.log('  Relative to center:', rightRelX, rightRelY);
console.log('  After rotation:', rotatedRightX.toFixed(2), rotatedRightY.toFixed(2));

// Calculate rotated image size (Sharp adds padding)
// For a rectangle rotated by angle θ:
// newWidth = |width * cos(θ)| + |height * sin(θ)|
// newHeight = |width * sin(θ)| + |height * cos(θ)|
const absAngleRad = Math.abs(angleRadians);
const rotatedWidth = Math.round(Math.abs(originalWidth * Math.cos(absAngleRad)) + Math.abs(originalHeight * Math.sin(absAngleRad)));
const rotatedHeight = Math.round(Math.abs(originalWidth * Math.sin(absAngleRad)) + Math.abs(originalHeight * Math.cos(absAngleRad)));

console.log('\nRotated image size:', rotatedWidth, 'x', rotatedHeight);

const paddingX = (rotatedWidth - originalWidth) / 2;
const paddingY = (rotatedHeight - originalHeight) / 2;

console.log('Padding:', paddingX.toFixed(2), paddingY.toFixed(2));

// Eye positions in padded image
const currentLeftEye = {
  x: rotatedLeftX + origCenterX + paddingX,
  y: rotatedLeftY + origCenterY + paddingY,
};
const currentRightEye = {
  x: rotatedRightX + origCenterX + paddingX,
  y: rotatedRightY + origCenterY + paddingY,
};

console.log('\nEyes in padded image:');
console.log('  Left:', currentLeftEye.x.toFixed(2), currentLeftEye.y.toFixed(2));
console.log('  Right:', currentRightEye.x.toFixed(2), currentRightEye.y.toFixed(2));

// Verify they're horizontal
console.log('  Y difference:', Math.abs(currentLeftEye.y - currentRightEye.y).toFixed(4));

// Verify distance is preserved
const rotatedDistance = Math.sqrt(
  Math.pow(currentRightEye.x - currentLeftEye.x, 2) +
  Math.pow(currentRightEye.y - currentLeftEye.y, 2)
);
console.log('  Distance:', rotatedDistance.toFixed(2), '(should be', detectedInterEyeDistance.toFixed(2) + ')');

// Step 2: Scale
console.log('\n=== STEP 2: SCALING ===');
const scaledWidth = Math.round(rotatedWidth * scaleFactor);
const scaledHeight = Math.round(rotatedHeight * scaleFactor);

console.log('Scaled image size:', scaledWidth, 'x', scaledHeight);

const scaledLeftEye = {
  x: currentLeftEye.x * scaleFactor,
  y: currentLeftEye.y * scaleFactor,
};
const scaledRightEye = {
  x: currentRightEye.x * scaleFactor,
  y: currentRightEye.y * scaleFactor,
};

console.log('Eyes after scaling:');
console.log('  Left:', scaledLeftEye.x.toFixed(2), scaledLeftEye.y.toFixed(2));
console.log('  Right:', scaledRightEye.x.toFixed(2), scaledRightEye.y.toFixed(2));

const scaledDistance = Math.sqrt(
  Math.pow(scaledRightEye.x - scaledLeftEye.x, 2) +
  Math.pow(scaledRightEye.y - scaledLeftEye.y, 2)
);
console.log('  Distance:', scaledDistance.toFixed(2), '(should be 360.00)');

// Step 3: Extract
console.log('\n=== STEP 3: EXTRACTION ===');
const TARGET_LEFT_EYE = { x: 360, y: 432 };
const TARGET_RIGHT_EYE = { x: 720, y: 432 };

const extractLeft = Math.round(scaledLeftEye.x - TARGET_LEFT_EYE.x);
const extractTop = Math.round(scaledLeftEye.y - TARGET_LEFT_EYE.y);

console.log('Extract offset:', extractLeft, extractTop);
console.log('Extract region: from (' + extractLeft + ',' + extractTop + ') size 1080x1080');

// Calculate final eye positions
const finalLeftEye = {
  x: scaledLeftEye.x - extractLeft,
  y: scaledLeftEye.y - extractTop,
};
const finalRightEye = {
  x: scaledRightEye.x - extractLeft,
  y: scaledRightEye.y - extractTop,
};

console.log('\n=== FINAL RESULT ===');
console.log('Left eye:', finalLeftEye.x.toFixed(2), finalLeftEye.y.toFixed(2), '(target: 360, 432)');
console.log('Right eye:', finalRightEye.x.toFixed(2), finalRightEye.y.toFixed(2), '(target: 720, 432)');

console.log('\n=== VALIDATION ===');
const leftError = Math.sqrt(Math.pow(finalLeftEye.x - 360, 2) + Math.pow(finalLeftEye.y - 432, 2));
const rightError = Math.sqrt(Math.pow(finalRightEye.x - 720, 2) + Math.pow(finalRightEye.y - 432, 2));

console.log('Left eye error:', leftError.toFixed(2), 'pixels');
console.log('Right eye error:', rightError.toFixed(2), 'pixels');

if (leftError < 1 && rightError < 1) {
  console.log('\n✅ ALIGNMENT CORRECT!');
} else {
  console.log('\n❌ ALIGNMENT ERROR - eyes not at target positions');
}
