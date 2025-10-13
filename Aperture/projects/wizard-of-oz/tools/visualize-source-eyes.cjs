const sharp = require('sharp');
const fs = require('fs');

async function visualizeSourceEyes() {
  const metadata = JSON.parse(fs.readFileSync('./test-output/real-baby-photo-metadata.json', 'utf8'));
  const eyes = metadata.detectedEyes;

  const markerSvg = `
    <svg width="${eyes.imageWidth}" height="${eyes.imageHeight}">
      <!-- Detected eye positions -->
      <circle cx="${eyes.leftEye.x}" cy="${eyes.leftEye.y}" r="30" fill="none" stroke="blue" stroke-width="4"/>
      <circle cx="${eyes.rightEye.x}" cy="${eyes.rightEye.y}" r="30" fill="none" stroke="red" stroke-width="4"/>
      <text x="${eyes.leftEye.x}" y="${eyes.leftEye.y - 40}" fill="blue" font-size="24" font-weight="bold" text-anchor="middle">LEFT (${eyes.leftEye.x}, ${eyes.leftEye.y})</text>
      <text x="${eyes.rightEye.x}" y="${eyes.rightEye.y - 40}" fill="red" font-size="24" font-weight="bold" text-anchor="middle">RIGHT (${eyes.rightEye.x}, ${eyes.rightEye.y})</text>
    </svg>
  `;

  await sharp('./test-output/real-baby-photo.jpg')
    .composite([{
      input: Buffer.from(markerSvg),
      top: 0,
      left: 0,
    }])
    .toFile('./test-output/source-eyes-marked.jpg');

  console.log('✅ Created: ./test-output/source-eyes-marked.jpg');
  console.log('Check if the markers are actually on the eyes!');
}

visualizeSourceEyes();
