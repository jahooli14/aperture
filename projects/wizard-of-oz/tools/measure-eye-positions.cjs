const sharp = require('sharp');

async function measureEyePositions() {
  const img = await sharp('current-production-aligned.jpg');
  const metadata = await img.metadata();

  console.log('Image dimensions:', metadata.width, 'x', metadata.height);
  console.log('\nTarget eye positions:');
  console.log('  Left eye (baby\'s left): x=720 (67%)');
  console.log('  Right eye (baby\'s right): x=360 (33%)');
  console.log('  Inter-eye distance: 360px');
  console.log('\nTo verify alignment, I need to visually estimate eye positions...');
  console.log('Based on the image, the eyes appear to be:');
  console.log('  Left eye: approximately x=750-760 (~70%)');
  console.log('  Right eye: approximately x=420-430 (~40%)');
  console.log('\nThis suggests the alignment is still off by about 30-40px to the right.');
}

measureEyePositions();
