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
    Align face using step-by-step approach (CORRECTED ORDER):
    1. Rotate image so eyes are horizontally level (same y value)
    2. Scale image so eyes are TARGET_INTER_EYE_DISTANCE apart (simple horizontal distance)
    3. Translate to place eyes at exact target positions

    Args:
        image_bytes: Image data as bytes
        left_eye: Tuple (x, y) of detected left eye position
        right_eye: Tuple (x, y) of detected right eye position

    Returns:
        Aligned image as JPEG bytes, or None if failed
    """
    # Decode image from bytes
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return None

    left_eye = np.array(left_eye, dtype=np.float32)
    right_eye = np.array(right_eye, dtype=np.float32)

    print(f'📍 Input eye positions:')
    print(f'   Left: ({left_eye[0]:.1f}, {left_eye[1]:.1f})')
    print(f'   Right: ({right_eye[0]:.1f}, {right_eye[1]:.1f})')

    # STEP 1: Rotate image so eyes are horizontal
    # Calculate angle to make eyes horizontal
    delta_y = right_eye[1] - left_eye[1]
    delta_x = right_eye[0] - left_eye[0]
    angle_rad = np.arctan2(delta_y, delta_x)
    angle_deg = np.degrees(angle_rad)

    print(f'🔄 Step 1 - Rotate:')
    print(f'   Current tilt: {angle_deg:.2f}°')

    # Calculate rotation center (midpoint between eyes)
    center = ((left_eye + right_eye) / 2).astype(np.float32)

    # Get rotation matrix
    rotation_matrix = cv2.getRotationMatrix2D(tuple(center), angle_deg, 1.0)

    # Calculate new image size to fit rotated image
    height, width = img.shape[:2]
    cos = np.abs(rotation_matrix[0, 0])
    sin = np.abs(rotation_matrix[0, 1])
    new_w = int((height * sin) + (width * cos))
    new_h = int((height * cos) + (width * sin))

    # Adjust rotation matrix for new center
    rotation_matrix[0, 2] += (new_w / 2) - center[0]
    rotation_matrix[1, 2] += (new_h / 2) - center[1]

    # Rotate the image
    rotated_img = cv2.warpAffine(
        img,
        rotation_matrix,
        (new_w, new_h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(255, 255, 255)
    )

    # Rotate the eye positions
    left_homogeneous = np.array([left_eye[0], left_eye[1], 1])
    right_homogeneous = np.array([right_eye[0], right_eye[1], 1])

    rotated_left = rotation_matrix @ left_homogeneous
    rotated_right = rotation_matrix @ right_homogeneous

    print(f'   Rotated left eye: ({rotated_left[0]:.1f}, {rotated_left[1]:.1f})')
    print(f'   Rotated right eye: ({rotated_right[0]:.1f}, {rotated_right[1]:.1f})')
    print(f'   Y values should be equal now: left_y={rotated_left[1]:.1f}, right_y={rotated_right[1]:.1f}')

    # STEP 2: Scale image so inter-eye distance = TARGET_INTER_EYE_DISTANCE
    # Now that eyes are horizontal, distance is simply horizontal difference
    current_distance = abs(rotated_left[0] - rotated_right[0])
    scale = TARGET_INTER_EYE_DISTANCE / current_distance

    print(f'🔍 Step 2 - Scale:')
    print(f'   Current horizontal inter-eye distance: {current_distance:.1f}px')
    print(f'   Target inter-eye distance: {TARGET_INTER_EYE_DISTANCE}px')
    print(f'   Scale factor: {scale:.4f}')

    # Scale the rotated image
    scaled_width = int(new_w * scale)
    scaled_height = int(new_h * scale)
    scaled_img = cv2.resize(rotated_img, (scaled_width, scaled_height), interpolation=cv2.INTER_CUBIC)

    # Scale the eye positions
    scaled_left = rotated_left * scale
    scaled_right = rotated_right * scale

    print(f'   Scaled image: {scaled_width}x{scaled_height}')
    print(f'   Scaled left eye: ({scaled_left[0]:.1f}, {scaled_left[1]:.1f})')
    print(f'   Scaled right eye: ({scaled_right[0]:.1f}, {scaled_right[1]:.1f})')
    print(f'   Horizontal distance after scale: {abs(scaled_left[0] - scaled_right[0]):.1f}px (should be {TARGET_INTER_EYE_DISTANCE}px)')

    # STEP 3: Translate to place eyes at target positions
    # Use left eye as reference point
    target_left = np.array(TARGET_LEFT_EYE, dtype=np.float32)
    translation = target_left - scaled_left

    print(f'📐 Step 3 - Translate:')
    print(f'   Translation: ({translation[0]:.1f}, {translation[1]:.1f})')

    # Create translation matrix
    translation_matrix = np.float32([
        [1, 0, translation[0]],
        [0, 1, translation[1]]
    ])

    # Apply translation and crop to output size
    final_img = cv2.warpAffine(
        scaled_img,
        translation_matrix,
        OUTPUT_SIZE,
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(255, 255, 255)
    )

    # Calculate final eye positions for verification
    final_left = scaled_left + translation
    final_right = scaled_right + translation

    print(f'✅ Final eye positions:')
    print(f'   Left: ({final_left[0]:.1f}, {final_left[1]:.1f}) - Target: {TARGET_LEFT_EYE}')
    print(f'   Right: ({final_right[0]:.1f}, {final_right[1]:.1f}) - Target: {TARGET_RIGHT_EYE}')
    print(f'   Error: Left={np.linalg.norm(final_left - target_left):.1f}px, Right={np.linalg.norm(final_right - np.array(TARGET_RIGHT_EYE)):.1f}px')

    # Encode as JPEG
    _, buffer = cv2.imencode('.jpg', final_img, [cv2.IMWRITE_JPEG_QUALITY, 95])

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

            # Return success
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            response = {
                'success': True,
                'alignedUrl': aligned_url,
                'debug': {
                    'scaleFactor': scale_factor,
                    'sourceEyes': {
                        'left': {'x': scaled_left_eye[0], 'y': scaled_left_eye[1]},
                        'right': {'x': scaled_right_eye[0], 'y': scaled_right_eye[1]}
                    },
                    'targetEyes': {
                        'left': {'x': TARGET_LEFT_EYE[0], 'y': TARGET_LEFT_EYE[1]},
                        'right': {'x': TARGET_RIGHT_EYE[0], 'y': TARGET_RIGHT_EYE[1]}
                    }
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
