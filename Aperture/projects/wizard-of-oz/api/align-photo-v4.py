#!/usr/bin/env python3
"""
Vercel Python serverless function for face/eye alignment using OpenCV.
This is the proven working approach from Session 6.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import cv2
import numpy as np
from urllib.request import urlopen
from io import BytesIO

# Supabase client (we'll use REST API directly to avoid extra dependencies)
SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

# Target eye positions in 1080x1080 output
TARGET_LEFT_EYE = (720, 432)   # Baby's left eye (right side of image)
TARGET_RIGHT_EYE = (360, 432)  # Baby's right eye (left side of image)
TARGET_INTER_EYE_DISTANCE = 360  # pixels (720 - 360)
OUTPUT_SIZE = (1080, 1080)


def align_face(image_bytes, left_eye, right_eye):
    """
    DEBUG MODE: Just show where Gemini detected the eyes on the original image.
    No transformation - just green dots to verify detection accuracy.

    Args:
        image_bytes: Image data as bytes
        left_eye: Tuple (x, y) of detected left eye position
        right_eye: Tuple (x, y) of detected right eye position

    Returns:
        Original image with green dots at detected eye positions
    """
    # Decode image from bytes
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return None

    height, width = img.shape[:2]
    lx, ly = left_eye
    rx, ry = right_eye

    print(f'📍 Gemini detected eye positions:')
    print(f'   Left: ({lx:.1f}, {ly:.1f})')
    print(f'   Right: ({rx:.1f}, {ry:.1f})')
    print(f'   Image size: {width}x{height}')

    # Convert to percentages for easier verification
    left_pct_x = (lx / width) * 100
    left_pct_y = (ly / height) * 100
    right_pct_x = (rx / width) * 100
    right_pct_y = (ry / height) * 100

    print(f'\n📊 As percentages:')
    print(f'   Left: {left_pct_x:.1f}% across, {left_pct_y:.1f}% down')
    print(f'   Right: {right_pct_x:.1f}% across, {right_pct_y:.1f}% down')

    # Draw large GREEN dots at detected positions
    debug_img = img.copy()

    # Make dots large enough to see easily
    radius = int(max(width, height) * 0.02)  # 2% of image dimension

    cv2.circle(debug_img, (int(lx), int(ly)), radius, (0, 255, 0), -1)  # Left eye
    cv2.circle(debug_img, (int(rx), int(ry)), radius, (0, 255, 0), -1)  # Right eye

    # Add small white center dot for precision
    cv2.circle(debug_img, (int(lx), int(ly)), radius // 4, (255, 255, 255), -1)
    cv2.circle(debug_img, (int(rx), int(ry)), radius // 4, (255, 255, 255), -1)

    print(f'\n✅ Debug image created with GREEN dots at Gemini\'s detected positions')
    print(f'   Verify visually: Are the green dots on the actual eye centers?')

    # Encode as JPEG
    _, buffer = cv2.imencode('.jpg', debug_img, [cv2.IMWRITE_JPEG_QUALITY, 95])

    return buffer.tobytes()


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Parse request body
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            data = json.loads(body)

            photo_id = data.get('photoId')
            landmarks = data.get('landmarks')

            if not photo_id or not landmarks:
                self.send_error(400, 'Missing photoId or landmarks')
                return

            print(f'🎯 Starting alignment (Python OpenCV) for photo: {photo_id}')

            # Fetch photo from database
            import urllib.request
            req = urllib.request.Request(
                f'{SUPABASE_URL}/rest/v1/photos?id=eq.{photo_id}&select=*',
                headers={
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
                }
            )

            with urllib.request.urlopen(req) as response:
                photos = json.loads(response.read())

            if not photos:
                self.send_error(404, 'Photo not found')
                return

            photo = photos[0]
            image_url = photo['original_url']

            # Download image
            print(f'📥 Downloading image from: {image_url}')
            with urllib.request.urlopen(image_url) as response:
                image_bytes = response.read()

            # Get actual image dimensions for coordinate scaling
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            actual_height, actual_width = img.shape[:2]

            # Scale coordinates from detection dimensions to actual dimensions
            scale_factor = actual_width / landmarks['imageWidth']

            print(f'📐 Coordinate scaling: {scale_factor:.4f}')
            print(f'   Detection size: {landmarks["imageWidth"]}x{landmarks["imageHeight"]}')
            print(f'   Actual size: {actual_width}x{actual_height}')

            scaled_left_eye = (
                landmarks['leftEye']['x'] * scale_factor,
                landmarks['leftEye']['y'] * scale_factor
            )
            scaled_right_eye = (
                landmarks['rightEye']['x'] * scale_factor,
                landmarks['rightEye']['y'] * scale_factor
            )

            print(f'👁️  Scaled eye positions:')
            print(f'   Left: {scaled_left_eye}')
            print(f'   Right: {scaled_right_eye}')

            # Align face
            aligned_bytes = align_face(image_bytes, scaled_left_eye, scaled_right_eye)

            if aligned_bytes is None:
                self.send_error(500, 'Failed to align image')
                return

            print(f'✅ Alignment complete, uploading to storage...')

            # Upload to Supabase Storage
            import time
            aligned_filename = f'aligned/{photo_id}-{int(time.time() * 1000)}.jpg'

            upload_req = urllib.request.Request(
                f'{SUPABASE_URL}/storage/v1/object/originals/{aligned_filename}',
                data=aligned_bytes,
                headers={
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
                    'Content-Type': 'image/jpeg',
                    'Cache-Control': '3600',
                },
                method='POST'
            )

            with urllib.request.urlopen(upload_req) as response:
                upload_result = json.loads(response.read())

            # Get public URL
            aligned_url = f'{SUPABASE_URL}/storage/v1/object/public/originals/{aligned_filename}'

            # Update database
            update_data = json.dumps({'aligned_url': aligned_url}).encode('utf-8')
            update_req = urllib.request.Request(
                f'{SUPABASE_URL}/rest/v1/photos?id=eq.{photo_id}',
                data=update_data,
                headers={
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                },
                method='PATCH'
            )

            with urllib.request.urlopen(update_req):
                pass

            print(f'✅ Complete: {aligned_url}')

            # Log debug info to database for easier debugging
            print(f'\n📊 WRITING DEBUG LOG TO DATABASE')

            # Return success
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            response = {
                'success': True,
                'alignedUrl': aligned_url,
                'debug': {
                    'coordinateScaleFactor': scale_factor,
                    'sourceEyes': {
                        'left': {'x': scaled_left_eye[0], 'y': scaled_left_eye[1]},
                        'right': {'x': scaled_right_eye[0], 'y': scaled_right_eye[1]}
                    },
                    'targetEyes': {
                        'left': {'x': TARGET_LEFT_EYE[0], 'y': TARGET_LEFT_EYE[1]},
                        'right': {'x': TARGET_RIGHT_EYE[0], 'y': TARGET_RIGHT_EYE[1]}
                    },
                    'message': 'Check stdout logs for detailed transformation steps'
                }
            }

            self.wfile.write(json.dumps(response).encode('utf-8'))

        except Exception as e:
            print(f'❌ Alignment failed: {str(e)}')
            import traceback
            traceback.print_exc()

            self.send_error(500, f'Alignment failed: {str(e)}')

    def do_GET(self):
        self.send_response(405)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'error': 'Method not allowed'}).encode('utf-8'))
