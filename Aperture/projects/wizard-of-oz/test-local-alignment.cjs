const sharp = require('sharp');

// Create 3 test images with detected eye coordinates from production
const testCases = [
  { name: 'photo1', leftEye: {x: 454.2, y: 316.7}, rightEye: {x: 267.8, y: 323.5}, width: 768, height: 1024 },
  { name: 'photo2', leftEye: {x: 451.6, y: 336.0}, rightEye: {x: 246.3, y: 341.8}, width: 768, height: 1024 },
  { name: 'photo3', leftEye: {x: 531.8, y: 349.9}, rightEye: {x: 298.9, y: 367.6}, width: 768, height: 1024 },
];

async function testAlignment(testCase) {
  const { name, leftEye, rightEye, width, height } = testCase;

  // Calculate alignment (same as production code)
  const dist = Math.sqrt((leftEye.x - rightEye.x)**2 + (leftEye.y - rightEye.y)**2);
  const scale = 360 / dist;

  const scaledWidth = Math.round(width * scale);
  const scaledHeight = Math.round(height * scale);

  const scaledLeftX = leftEye.x * scale;
  const scaledRightX = rightEye.x * scale;

  const currentMidX = (scaledLeftX + scaledRightX) / 2;
  const extractLeft = Math.round(currentMidX - 540);

  console.log(`\n${name}:`);
  console.log(`  Scale: ${scale.toFixed(3)} -> ${scaledWidth}x${scaledHeight}`);
  console.log(`  Extract from: (${extractLeft}, ...)`);
  console.log(`  Expected final: left=${(scaledLeftX - extractLeft).toFixed(1)}, right=${(scaledRightX - extractLeft).toFixed(1)}`);

  // Create test image with colored circles at eye positions
  const buffer = Buffer.alloc(width * height * 3, 200);

  // Draw left eye (blue)
  for (let y = -30; y <= 30; y++) {
    for (let x = -30; x <= 30; x++) {
      if (x*x + y*y <= 900) {
        const px = Math.floor(leftEye.x + x);
        const py = Math.floor(leftEye.y + y);
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * 3;
          buffer[idx] = 0; buffer[idx+1] = 0; buffer[idx+2] = 255;
        }
      }
    }
  }

  // Draw right eye (red)
  for (let y = -30; y <= 30; y++) {
    for (let x = -30; x <= 30; x++) {
      if (x*x + y*y <= 900) {
        const px = Math.floor(rightEye.x + x);
        const py = Math.floor(rightEye.y + y);
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * 3;
          buffer[idx] = 255; buffer[idx+1] = 0; buffer[idx+2] = 0;
        }
      }
    }
  }

  // Perform same alignment as production
  await sharp(buffer, { raw: { width, height, channels: 3 }})
    .resize(scaledWidth, scaledHeight, { kernel: 'lanczos3', fit: 'fill' })
    .extract({ left: Math.max(0, extractLeft), top: 0, width: 1080, height: 1080 })
    .jpeg()
    .toFile(`test-${name}-aligned.jpg`);

  console.log(`  Saved test-${name}-aligned.jpg`);
}

Promise.all(testCases.map(testAlignment))
  .then(() => console.log('\n✓ All test images created'))
  .catch(err => console.error('Error:', err));
