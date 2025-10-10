import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the most recent photo with alignment data
    const { data: photos, error } = await supabase
      .from('photos')
      .select('*')
      .order('upload_date', { ascending: false })
      .limit(5);

    if (error) {
      throw error;
    }

    // Format the data for display
    const debugData = photos?.map(photo => ({
      id: photo.id,
      uploadDate: photo.upload_date,
      hasAligned: !!photo.aligned_url,
      eyeCoordinates: photo.eye_coordinates,
      alignmentTransform: photo.alignment_transform,
      aligned_url: photo.aligned_url,
    }));

    // Return HTML page
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Wizard of Oz - Debug Logs</title>
  <style>
    body {
      font-family: monospace;
      margin: 20px;
      background: #1e1e1e;
      color: #d4d4d4;
    }
    h1 {
      color: #4ec9b0;
    }
    .photo {
      border: 1px solid #3e3e3e;
      padding: 15px;
      margin: 15px 0;
      background: #252526;
      border-radius: 5px;
    }
    .photo h2 {
      color: #dcdcaa;
      margin-top: 0;
    }
    .status {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: bold;
    }
    .status.aligned {
      background: #0e7490;
      color: white;
    }
    .status.pending {
      background: #ca8a04;
      color: white;
    }
    pre {
      background: #1e1e1e;
      padding: 10px;
      border-left: 3px solid #007acc;
      overflow-x: auto;
      color: #ce9178;
    }
    .key {
      color: #9cdcfe;
    }
    .refresh {
      background: #0e7490;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .refresh:hover {
      background: #155e75;
    }
  </style>
</head>
<body>
  <h1>🔬 Wizard of Oz - Alignment Debug Logs</h1>
  <button class="refresh" onclick="location.reload()">🔄 Refresh Logs</button>

  ${debugData?.map(photo => `
    <div class="photo">
      <h2>
        Photo: ${new Date(photo.uploadDate).toLocaleString()}
        <span class="status ${photo.hasAligned ? 'aligned' : 'pending'}">
          ${photo.hasAligned ? '✓ ALIGNED' : '⏳ PENDING'}
        </span>
      </h2>

      <h3>Eye Detection (from Gemini)</h3>
      ${photo.eyeCoordinates ? `
        <pre>${JSON.stringify(photo.eyeCoordinates, null, 2)}</pre>

        <h3>Analysis</h3>
        <pre>Left eye X: ${photo.eyeCoordinates.leftEye?.x} (${photo.eyeCoordinates.imageWidth ? ((photo.eyeCoordinates.leftEye.x / photo.eyeCoordinates.imageWidth) * 100).toFixed(1) : '?'}%)
Right eye X: ${photo.eyeCoordinates.rightEye?.x} (${photo.eyeCoordinates.imageWidth ? ((photo.eyeCoordinates.rightEye.x / photo.eyeCoordinates.imageWidth) * 100).toFixed(1) : '?'}%)

${photo.eyeCoordinates.leftEye?.x && photo.eyeCoordinates.rightEye?.x
  ? (photo.eyeCoordinates.leftEye.x > photo.eyeCoordinates.rightEye.x
    ? '✓ Left eye is on right side (baby facing camera)'
    : '⚠️ WARNING: Left eye is on left side - labels might be swapped!')
  : ''}

Inter-eye distance: ${photo.eyeCoordinates.leftEye && photo.eyeCoordinates.rightEye
  ? Math.sqrt(
      Math.pow(photo.eyeCoordinates.rightEye.x - photo.eyeCoordinates.leftEye.x, 2) +
      Math.pow(photo.eyeCoordinates.rightEye.y - photo.eyeCoordinates.leftEye.y, 2)
    ).toFixed(1) + ' px'
  : 'N/A'}
Eyes open: ${photo.eyeCoordinates.eyesOpen !== undefined ? (photo.eyeCoordinates.eyesOpen ? 'Yes' : 'No') : 'Unknown'}</pre>
      ` : '<p style="color: #ce9178">No eye detection data</p>'}

      <h3>Alignment Transform</h3>
      ${photo.alignmentTransform ? `
        <pre>${JSON.stringify(photo.alignmentTransform, null, 2)}</pre>
      ` : '<p style="color: #ce9178">No alignment data yet</p>'}

      ${photo.aligned_url ? `
        <h3>Aligned Image (with target markers)</h3>
        <div style="position: relative; display: inline-block;">
          <img src="${photo.aligned_url}" style="max-width: 540px; border: 2px solid #007acc; border-radius: 5px;" />
          <!-- Target positions scaled to 50% (540px display from 1080px image) -->
          <!-- Right eye target at x=360 (scaled to 180px at 50%) -->
          <div style="position: absolute; left: 180px; top: 216px; width: 20px; height: 20px; border: 2px solid red; border-radius: 50%; transform: translate(-50%, -50%);"></div>
          <div style="position: absolute; left: 180px; top: 205px; color: red; font-size: 12px; font-weight: bold; background: rgba(0,0,0,0.7); padding: 2px 4px;">R</div>

          <!-- Left eye target at x=720 (scaled to 360px at 50%) -->
          <div style="position: absolute; left: 360px; top: 216px; width: 20px; height: 20px; border: 2px solid lime; border-radius: 50%; transform: translate(-50%, -50%);"></div>
          <div style="position: absolute; left: 360px; top: 205px; color: lime; font-size: 12px; font-weight: bold; background: rgba(0,0,0,0.7); padding: 2px 4px;">L</div>

          <!-- Center line at x=540 (scaled to 270px) -->
          <div style="position: absolute; left: 270px; top: 0; width: 2px; height: 100%; background: yellow; opacity: 0.5;"></div>
        </div>
        <p style="color: #9cdcfe; font-size: 12px;">
          🔴 Red circle (R) = Right eye target (x=360 / 33%)<br>
          🟢 Green circle (L) = Left eye target (x=720 / 67%)<br>
          🟡 Yellow line = Center (x=540 / 50%)
        </p>
      ` : ''}
    </div>
  `).join('') || '<p>No photos found</p>'}

  <script>
    // Auto-refresh every 10 seconds if there are pending photos
    const hasPending = ${debugData?.some(p => !p.hasAligned) || false};
    if (hasPending) {
      setTimeout(() => location.reload(), 10000);
    }
  </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Error fetching debug logs:', error);
    return res.status(500).json({
      error: 'Failed to fetch debug logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
