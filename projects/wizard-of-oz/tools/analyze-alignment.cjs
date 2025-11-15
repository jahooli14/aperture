const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Target dimensions
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1350;
const TARGET_LEFT_EYE = { x: TARGET_WIDTH * 0.33, y: TARGET_HEIGHT * 0.40 };
const TARGET_RIGHT_EYE = { x: TARGET_WIDTH * 0.67, y: TARGET_HEIGHT * 0.40 };

async function analyzeAlignment() {
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, upload_date, eye_coordinates')
    .not('eye_coordinates', 'is', null)
    .order('upload_date', { ascending: true });

  if (error) throw error;

  console.log('\n📐 Alignment Transformation Analysis\n');
  console.log('Target eye positions:');
  console.log(`  Left eye:  (${TARGET_LEFT_EYE.x}, ${TARGET_LEFT_EYE.y})`);
  console.log(`  Right eye: (${TARGET_RIGHT_EYE.x}, ${TARGET_RIGHT_EYE.y})`);
  console.log(`  Target distance: ${TARGET_RIGHT_EYE.x - TARGET_LEFT_EYE.x}px\n`);

  photos.forEach((photo) => {
    const date = new Date(photo.upload_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    const coords = photo.eye_coordinates;
    const { leftEye, rightEye, imageWidth, imageHeight } = coords;

    // Calculate transformation parameters (same as imageUtils.ts)
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const angle = Math.atan2(dy, dx);
    const angleDegrees = angle * (180 / Math.PI);

    const currentEyeDistance = Math.sqrt(dx * dx + dy * dy);
    const targetEyeDistance = TARGET_RIGHT_EYE.x - TARGET_LEFT_EYE.x;
    const scale = targetEyeDistance / currentEyeDistance;

    const sourceCenterX = (leftEye.x + rightEye.x) / 2;
    const sourceCenterY = (leftEye.y + rightEye.y) / 2;

    const targetCenterX = (TARGET_LEFT_EYE.x + TARGET_RIGHT_EYE.x) / 2;
    const targetCenterY = (TARGET_LEFT_EYE.y + TARGET_RIGHT_EYE.y) / 2;

    // Check if needs flip (old logic - always flip)
    const needsFlipOld = true;

    // Check if needs flip (new logic - based on eye position)
    const isVeryTop = sourceCenterY < imageHeight * 0.3;
    const needsFlipNew = !isVeryTop;

    console.log(`${date} (${photo.id.substring(0, 8)})`);
    console.log(`  Image: ${imageWidth}x${imageHeight}`);
    console.log(`  Source eyes: L(${Math.round(leftEye.x)}, ${Math.round(leftEye.y)}) R(${Math.round(rightEye.x)}, ${Math.round(rightEye.y)})`);
    console.log(`  Source center: (${Math.round(sourceCenterX)}, ${Math.round(sourceCenterY)})`);
    console.log(`  Eye distance: ${Math.round(currentEyeDistance)}px`);
    console.log(`  Angle: ${angleDegrees.toFixed(2)}°`);
    console.log(`  Scale: ${scale.toFixed(3)}x`);
    console.log(`  Eye Y position: ${Math.round(sourceCenterY)} / ${imageHeight} = ${(sourceCenterY/imageHeight*100).toFixed(1)}% from top`);
    console.log(`  Threshold (30%): ${Math.round(imageHeight * 0.3)}`);
    console.log(`  OLD logic: Flip = ${needsFlipOld ? 'YES' : 'NO'}`);
    console.log(`  NEW logic: Flip = ${needsFlipNew ? 'YES' : 'NO'} ${needsFlipOld !== needsFlipNew ? '⚠️ CHANGED' : ''}`);

    // Calculate where the eyes would end up after transformation
    // This is complex due to the multiple transformations, but let's approximate
    console.log(`  Transform: translate(${Math.round(targetCenterX)}, ${Math.round(targetCenterY)}) → rotate(${(-angleDegrees).toFixed(1)}°) → scale(${scale.toFixed(3)}) → ${needsFlipNew ? 'rotate(180°)' : 'no flip'}`);
    console.log('');
  });
}

analyzeAlignment().catch(console.error);
