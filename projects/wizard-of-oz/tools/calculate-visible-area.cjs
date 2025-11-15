const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1350;

async function calculateVisibleArea() {
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, upload_date, eye_coordinates')
    .not('eye_coordinates', 'is', null)
    .order('upload_date', { ascending: true });

  if (error) throw error;

  console.log('\n📏 Visible Area After Transformation\n');
  console.log(`Target canvas: ${TARGET_WIDTH}x${TARGET_HEIGHT}\n`);

  photos.forEach((photo) => {
    const date = new Date(photo.upload_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    const coords = photo.eye_coordinates;
    const { leftEye, rightEye, imageWidth, imageHeight } = coords;

    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const angleRad = Math.atan2(dy, dx);

    const currentEyeDistance = Math.sqrt(dx * dx + dy * dy);
    const targetEyeDistance = 367.2; // TARGET_RIGHT_EYE.x - TARGET_LEFT_EYE.x
    const scale = targetEyeDistance / currentEyeDistance;

    const sourceCenterX = (leftEye.x + rightEye.x) / 2;
    const sourceCenterY = (leftEye.y + rightEye.y) / 2;

    // After scaling, what are the dimensions of the image on the canvas?
    const scaledWidth = imageWidth * scale;
    const scaledHeight = imageHeight * scale;

    // How far is the eye center from the edges of the original image?
    const distanceToLeft = sourceCenterX;
    const distanceToRight = imageWidth - sourceCenterX;
    const distanceToTop = sourceCenterY;
    const distanceToBottom = imageHeight - sourceCenterY;

    // After scaling, these distances become:
    const scaledDistToLeft = distanceToLeft * scale;
    const scaledDistToRight = distanceToRight * scale;
    const scaledDistToTop = distanceToTop * scale;
    const scaledDistToBottom = distanceToBottom * scale;

    // On the target canvas, the eye center is at (540, 540)
    // So the image edges would be at:
    const leftEdge = 540 - scaledDistToLeft;
    const rightEdge = 540 + scaledDistToRight;
    const topEdge = 540 - scaledDistToTop;
    const bottomEdge = 540 + scaledDistToBottom;

    // Check if image covers the entire canvas
    const coversLeft = leftEdge <= 0;
    const coversRight = rightEdge >= TARGET_WIDTH;
    const coversTop = topEdge <= 0;
    const coversBottom = bottomEdge >= TARGET_HEIGHT;
    const fullyCovered = coversLeft && coversRight && coversTop && coversBottom;

    console.log(`${date} (${photo.id.substring(0, 8)}):`);
    console.log(`  Original: ${imageWidth}x${imageHeight}`);
    console.log(`  Scale: ${scale.toFixed(3)}x → Scaled: ${Math.round(scaledWidth)}x${Math.round(scaledHeight)}`);
    console.log(`  Eye center from edges: L:${Math.round(distanceToLeft)} R:${Math.round(distanceToRight)} T:${Math.round(distanceToTop)} B:${Math.round(distanceToBottom)}`);
    console.log(`  Eye center Y: ${Math.round(sourceCenterY)} (${(sourceCenterY/imageHeight*100).toFixed(1)}% from top)`);
    console.log(`  Scaled distances: L:${Math.round(scaledDistToLeft)} R:${Math.round(scaledDistToRight)} T:${Math.round(scaledDistToTop)} B:${Math.round(scaledDistToBottom)}`);
    console.log(`  Image edges on canvas: [${Math.round(leftEdge)}, ${Math.round(topEdge)}] to [${Math.round(rightEdge)}, ${Math.round(bottomEdge)}]`);
    console.log(`  Coverage: L:${coversLeft?'✓':'❌'} R:${coversRight?'✓':'❌'} T:${coversTop?'✓':'❌'} B:${coversBottom?'✓':'❌'} ${fullyCovered?'[FULL]':'[PARTIAL]'}`);

    if (!fullyCovered) {
      const missingAreas = [];
      if (!coversLeft) missingAreas.push(`left edge at ${Math.round(leftEdge)}`);
      if (!coversRight) missingAreas.push(`right edge at ${Math.round(rightEdge)}`);
      if (!coversTop) missingAreas.push(`top edge at ${Math.round(topEdge)}`);
      if (!coversBottom) missingAreas.push(`bottom edge at ${Math.round(bottomEdge)}`);
      console.log(`  ⚠️  White space at: ${missingAreas.join(', ')}`);
    }

    console.log('');
  });
}

calculateVisibleArea().catch(console.error);
