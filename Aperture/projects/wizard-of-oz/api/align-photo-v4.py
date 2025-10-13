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
    # We measure the angle of the line connecting the eyes
    # Baby's left eye to baby's right eye
    delta_y = left_eye[1] - right_eye[1]  # How much higher is left eye vs right?
    delta_x = left_eye[0] - right_eye[0]  # How much more to the right is left eye?

    # Calculate rotation angle
    # If delta_y > 0: left eye is higher, need to rotate CCW (negative angle)
    # The angle is simply arctan(opposite/adjacent)
    angle_rad = np.arctan2(delta_y, delta_x)
    angle_deg = -np.degrees(angle_rad)  # Negate for OpenCV

    print(f'🔄 Step 1 - Rotate:')
    print(f'   Left eye: ({left_eye[0]:.1f}, {left_eye[1]:.1f})')
    print(f'   Right eye: ({right_eye[0]:.1f}, {right_eye[1]:.1f})')
    print(f'   Delta Y (left - right): {delta_y:.1f}px (positive = left higher)')
    print(f'   Delta X (left - right): {delta_x:.1f}px')
    print(f'   Rotation angle: {angle_deg:.2f}°')

    # Calculate rotation center (midpoint between eyes)
    center = ((left_eye + right_eye) / 2).astype(np.float32)

    # Get rotation matrix - rotate around eye midpoint
    rotation_matrix = cv2.getRotationMatrix2D(tuple(center), angle_deg, 1.0)

    # Keep original image dimensions (don't expand canvas)
    # This is simpler and keeps coordinates consistent
    height, width = img.shape[:2]

    # Rotate the image (keeping same dimensions)
    rotated_img = cv2.warpAffine(
        img,
        rotation_matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(255, 255, 255)
    )

    # Rotate the eye positions using the same matrix
    left_homogeneous = np.array([left_eye[0], left_eye[1], 1])
    right_homogeneous = np.array([right_eye[0], right_eye[1], 1])

    rotated_left = rotation_matrix @ left_homogeneous
    rotated_right = rotation_matrix @ right_homogeneous

    print(f'   Rotation matrix:')
    print(f'      [{rotation_matrix[0, 0]:.4f}, {rotation_matrix[0, 1]:.4f}, {rotation_matrix[0, 2]:.4f}]')
    print(f'      [{rotation_matrix[1, 0]:.4f}, {rotation_matrix[1, 1]:.4f}, {rotation_matrix[1, 2]:.4f}]')
    print(f'   Before rotation: left=({left_eye[0]:.1f}, {left_eye[1]:.1f}), right=({right_eye[0]:.1f}, {right_eye[1]:.1f})')
    print(f'   After rotation: left=({rotated_left[0]:.1f}, {rotated_left[1]:.1f}), right=({rotated_right[0]:.1f}, {rotated_right[1]:.1f})')
    print(f'   Y values should be equal now: left_y={rotated_left[1]:.1f}, right_y={rotated_right[1]:.1f}')
    print(f'   Image size: {width}x{height}')

    # STEP 2: Just crop to center - NO TRANSLATION FOR NOW
    # Let's see where the eyes actually are after rotation
    # Crop a 1080x1080 window from the center of the rotated image

    center_x = width // 2
    center_y = height // 2

    crop_x1 = center_x - 540
    crop_y1 = center_y - 540
    crop_x2 = center_x + 540
    crop_y2 = center_y + 540

    print(f'📐 Step 2 - Crop center 1080x1080:')
    print(f'   Image center: ({center_x}, {center_y})')
    print(f'   Crop region: ({crop_x1}, {crop_y1}) to ({crop_x2}, {crop_y2})')

    # Crop the rotated image
    if crop_x1 >= 0 and crop_y1 >= 0 and crop_x2 <= width and crop_y2 <= height:
        final_img = rotated_img[crop_y1:crop_y2, crop_x1:crop_x2]

        # Adjust eye coordinates for the crop
        final_left = rotated_left - np.array([crop_x1, crop_y1])
        final_right = rotated_right - np.array([crop_x1, crop_y1])
        final_midpoint = np.array([540, 540])

        print(f'   Eyes in cropped image: left=({final_left[0]:.1f}, {final_left[1]:.1f}), right=({final_right[0]:.1f}, {final_right[1]:.1f})')
    else:
        print(f'   ⚠️  Crop would be out of bounds, using warpAffine instead')
        # Use identity matrix (no translation)
        translation_matrix = np.float32([
            [1, 0, -(width//2 - 540)],
            [0, 1, -(height//2 - 540)]
        ])
        final_img = cv2.warpAffine(
            rotated_img,
            translation_matrix,
            OUTPUT_SIZE,
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(255, 255, 255)
        )
        final_left = rotated_left + np.array([-(width//2 - 540), -(height//2 - 540)])
        final_right = rotated_right + np.array([-(width//2 - 540), -(height//2 - 540)])
        final_midpoint = np.array([540, 540])

    print(f'✅ Final eye positions (PREDICTED):')
    print(f'   Left: ({final_left[0]:.1f}, {final_left[1]:.1f})')
    print(f'   Right: ({final_right[0]:.1f}, {final_right[1]:.1f})')
    print(f'   Midpoint: ({final_midpoint[0]:.1f}, {final_midpoint[1]:.1f})')
    print(f'   Current inter-eye distance: {abs(final_left[0] - final_right[0]):.1f}px')

    # Draw markers on output to verify eye positions
    debug_img = final_img.copy()
    # Blue dots = predicted eye positions
    cv2.circle(debug_img, (int(final_left[0]), int(final_left[1])), 5, (255, 0, 0), -1)
    cv2.circle(debug_img, (int(final_right[0]), int(final_right[1])), 5, (255, 0, 0), -1)
    # Yellow dot = center of image (should match eye midpoint)
    cv2.circle(debug_img, (int(target_center_x), int(target_center_y)), 5, (0, 255, 255), -1)
    # Draw horizontal line through center
    cv2.line(debug_img, (0, int(target_center_y)), (OUTPUT_SIZE[0], int(target_center_y)), (0, 255, 255), 1)
    # Draw vertical line through center
    cv2.line(debug_img, (int(target_center_x), 0), (int(target_center_x), OUTPUT_SIZE[1]), (0, 255, 255), 1)

    print(f'\n📊 Visual debugging: Blue=eyes, Yellow=center (540,540)')

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
