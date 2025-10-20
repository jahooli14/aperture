const sharp = require('sharp');

(async () => {
  const svg = `
    <svg width="1080" height="1080">
      <circle cx="360" cy="432" r="25" fill="none" stroke="red" stroke-width="5"/>
      <text x="360" y="410" text-anchor="middle" font-size="35" font-weight="bold" fill="red">R</text>
      <circle cx="720" cy="432" r="25" fill="none" stroke="lime" stroke-width="5"/>
      <text x="720" y="410" text-anchor="middle" font-size="35" font-weight="bold" fill="lime">L</text>
      <line x1="540" y1="0" x2="540" y2="1080" stroke="yellow" stroke-width="4" opacity="0.7"/>
    </svg>
  `;
  await sharp('latest-aligned.jpg')
    .composite([{input: Buffer.from(svg), top: 0, left: 0}])
    .toFile('latest-marked.jpg');
  console.log('Created latest-marked.jpg');
})().catch(console.error);
