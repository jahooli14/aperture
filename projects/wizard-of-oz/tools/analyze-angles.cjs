const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeAngles() {
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, upload_date, eye_coordinates')
    .not('eye_coordinates', 'is', null)
    .order('upload_date', { ascending: true });

  if (error) throw error;

  console.log('\n🔍 Angle Analysis - Understanding the Flip Issue\n');

  photos.forEach((photo) => {
    const date = new Date(photo.upload_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    const coords = photo.eye_coordinates;
    const { leftEye, rightEye } = coords;

    // Calculate angle
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = angleRad * (180 / Math.PI);

    // Calculate final rotation after alignment + flip
    const alignmentRotation = -angleDeg;  // First rotate to align eyes
    const flipRotation = 180;              // Then flip 180°
    const finalRotation = alignmentRotation + flipRotation;

    // Normalize to -180 to 180 range
    let normalizedFinal = finalRotation;
    while (normalizedFinal > 180) normalizedFinal -= 360;
    while (normalizedFinal < -180) normalizedFinal += 360;

    // Determine if eyes are left<->right swapped (which would indicate wrong orientation)
    // If rightEye.x > leftEye.x, eyes are in correct left-right order
    // If rightEye.x < leftEye.x, eyes are swapped (upside down)
    const eyesSwapped = rightEye.x < leftEye.x;

    console.log(`${date}:`);
    console.log(`  Original angle: ${angleDeg.toFixed(2)}°`);
    console.log(`  Alignment rotation: ${alignmentRotation.toFixed(2)}°`);
    console.log(`  After +180° flip: ${finalRotation.toFixed(2)}° (normalized: ${normalizedFinal.toFixed(2)}°)`);
    console.log(`  Eyes L-R order: ${eyesSwapped ? '❌ SWAPPED (upside-down)' : '✓ Correct'}`);
    console.log(`  Left eye X: ${Math.round(leftEye.x)}, Right eye X: ${Math.round(rightEye.x)}`);
    console.log('');
  });
}

analyzeAngles().catch(console.error);
