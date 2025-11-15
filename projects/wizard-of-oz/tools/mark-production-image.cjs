const sharp = require('sharp');

async function markImage() {
  const img = sharp('current-production-aligned.jpg');
  const metadata = await img.metadata();

  console.log('Image dimensions:', metadata.width, 'x', metadata.height);

  // Create an SVG overlay with markers at target positions
  const svg = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <!-- Right eye target at x=360 (33%) -->
      <circle cx="360" cy="432" r="20" fill="none" stroke="red" stroke-width="4"/>
      <text x="360" y="415" text-anchor="middle" font-size="30" font-weight="bold" fill="red">R</text>

      <!-- Left eye target at x=720 (67%) -->
      <circle cx="720" cy="432" r="20" fill="none" stroke="lime" stroke-width="4"/>
      <text x="720" y="415" text-anchor="middle" font-size="30" font-weight="bold" fill="lime">L</text>

      <!-- Center line at x=540 (50%) -->
      <line x1="540" y1="0" x2="540" y2="${metadata.height}" stroke="yellow" stroke-width="3" opacity="0.7"/>

      <!-- Grid lines every 108px (10%) -->
      ${[0, 108, 216, 324, 432, 540, 648, 756, 864, 972, 1080].map(x =>
        `<line x1="${x}" y1="0" x2="${x}" y2="${metadata.height}" stroke="white" stroke-width="1" opacity="0.3"/>`
      ).join('\n      ')}
    </svg>
  `;

  await img
    .composite([{
      input: Buffer.from(svg),
      top: 0,
      left: 0
    }])
    .toFile('current-production-marked.jpg');

  console.log('Created current-production-marked.jpg with target markers');
  console.log('  Red circle (R) at x=360 (33%) = Right eye target');
  console.log('  Green circle (L) at x=720 (67%) = Left eye target');
  console.log('  Yellow line at x=540 (50%) = Center');
}

markImage().catch(console.error);
