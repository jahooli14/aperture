import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

/**
 * Test endpoint to verify Sharp image processing works in production
 *
 * Call: https://your-deployment.vercel.app/api/test-sharp
 *
 * This endpoint:
 * 1. Creates a small test image using Sharp
 * 2. Verifies Sharp binary compatibility
 * 3. Returns platform and version information
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('Testing Sharp availability...');

    // Test basic Sharp operation - create a red 100×100 square
    const testImage = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
    .jpeg({ quality: 90 })
    .toBuffer();

    console.log('✅ Sharp test successful');

    return res.status(200).json({
      success: true,
      message: 'Sharp is working correctly',
      sharpVersion: sharp.versions,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      testImageSize: testImage.length,
      testImageFormat: 'JPEG',
    });
  } catch (error) {
    console.error('❌ Sharp test failed:', error);

    return res.status(500).json({
      success: false,
      error: 'Sharp test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    });
  }
}
