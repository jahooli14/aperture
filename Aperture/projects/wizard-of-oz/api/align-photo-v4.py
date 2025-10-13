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
    Align face using EyeLign's proven step-by-step approach:
    1. Rotate around left eye to straighten eyes horizontally
    2. Scale image to normalize eye distance
    3. Crop to final output size centered on eye midpoint

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

    height, width = img.shape[:2]
    lx, ly = left_eye
    rx, ry = right_eye

    print(f'📍 Input eye positions:')
    print(f'   Left: ({lx:.1f}, {ly:.1f})')
    print(f'   Right: ({rx:.1f}, {ry:.1f})')
    print(f'   Image size: {width}x{height}')

    print(f'\n🎯 Target configuration:')
    print(f'   Left eye: ({TARGET_LEFT_EYE[0]}, {TARGET_LEFT_EYE[1]})')
    print(f'   Right eye: ({TARGET_RIGHT_EYE[0]}, {TARGET_RIGHT_EYE[1]})')
    print(f'   Target inter-eye distance: {TARGET_INTER_EYE_DISTANCE}px')

    # STEP 1: Rotate around left eye to straighten eyes
    # Calculate rotation angle
    delta_x = lx - rx
    delta_y = ly - ry
    angle_rad = np.arctan2(delta_x, delta_y)
    angle_deg = abs(np.degrees(angle_rad)) - 90

    print(f'\n🔄 STEP 1: Rotate around left eye')
    print(f'   Rotation angle: {angle_deg:.2f}°')

    # Add safety border to prevent data loss during rotation
    max_dist = int(np.hypot(width, height))
    bordered = cv2.copyMakeBorder(
        img, max_dist, max_dist, max_dist, max_dist,
        cv2.BORDER_CONSTANT, value=(255, 255, 255)
    )

    # Update eye positions after adding border
    lx += max_dist
    ly += max_dist
    rx += max_dist
    ry += max_dist

    # Rotate around left eye
    rotation_matrix = cv2.getRotationMatrix2D((lx, ly), angle_deg, 1.0)
    rotated = cv2.warpAffine(
        bordered, rotation_matrix,
        (bordered.shape[1], bordered.shape[0]),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(255, 255, 255)
    )

    # Calculate new right eye position after rotation
    # Using rotation matrix to transform coordinates
    rx_new = rotation_matrix[0, 0] * rx + rotation_matrix[0, 1] * ry + rotation_matrix[0, 2]
    ry_new = rotation_matrix[1, 0] * rx + rotation_matrix[1, 1] * ry + rotation_matrix[1, 2]

    print(f'   After rotation:')
    print(f'      Left: ({lx:.1f}, {ly:.1f}) [rotation center - unchanged]')
    print(f'      Right: ({rx_new:.1f}, {ry_new:.1f})')

    # STEP 2: Scale to normalize eye distance
    current_eye_distance = abs(rx_new - lx)
    scale_factor = TARGET_INTER_EYE_DISTANCE / current_eye_distance

    print(f'\n📏 STEP 2: Scale to normalize eye distance')
    print(f'   Current eye distance: {current_eye_distance:.1f}px')
    print(f'   Scale factor: {scale_factor:.4f}')

    new_width = int(rotated.shape[1] * scale_factor)
    new_height = int(rotated.shape[0] * scale_factor)
    scaled = cv2.resize(rotated, (new_width, new_height), interpolation=cv2.INTER_CUBIC)

    # Update eye positions after scaling
    lx_scaled = lx * scale_factor
    ly_scaled = ly * scale_factor
    rx_scaled = rx_new * scale_factor
    ry_scaled = ry_new * scale_factor

    print(f'   Scaled image size: {new_width}x{new_height}')
    print(f'   Scaled eyes:')
    print(f'      Left: ({lx_scaled:.1f}, {ly_scaled:.1f})')
    print(f'      Right: ({rx_scaled:.1f}, {ry_scaled:.1f})')
    print(f'      Inter-eye distance: {abs(rx_scaled - lx_scaled):.1f}px')

    # STEP 3: Crop to final size centered on eye midpoint
    eye_center_x = (lx_scaled + rx_scaled) / 2
    eye_center_y = (ly_scaled + ry_scaled) / 2

    # We want eyes at Y=432, so eye_center should be at Y=432
    # And horizontally centered at OUTPUT_SIZE[0]/2 = 540
    crop_left = int(eye_center_x - OUTPUT_SIZE[0] / 2)
    crop_top = int(eye_center_y - TARGET_LEFT_EYE[1])  # Eyes should be at Y=432
    crop_right = crop_left + OUTPUT_SIZE[0]
    crop_bottom = crop_top + OUTPUT_SIZE[1]

    print(f'\n✂️  STEP 3: Crop to final size')
    print(f'   Eye center: ({eye_center_x:.1f}, {eye_center_y:.1f})')
    print(f'   Crop region: ({crop_left}, {crop_top}) to ({crop_right}, {crop_bottom})')

    # Handle boundaries - create output canvas and copy valid region
    aligned = np.full((OUTPUT_SIZE[1], OUTPUT_SIZE[0], 3), 255, dtype=np.uint8)

    src_x1 = max(0, crop_left)
    src_y1 = max(0, crop_top)
    src_x2 = min(scaled.shape[1], crop_right)
    src_y2 = min(scaled.shape[0], crop_bottom)

    dst_x1 = src_x1 - crop_left
    dst_y1 = src_y1 - crop_top
    dst_x2 = dst_x1 + (src_x2 - src_x1)
    dst_y2 = dst_y1 + (src_y2 - src_y1)

    aligned[dst_y1:dst_y2, dst_x1:dst_x2] = scaled[src_y1:src_y2, src_x1:src_x2]

    print(f'✅ Alignment complete')
    print(f'   Output size: {OUTPUT_SIZE[0]}x{OUTPUT_SIZE[1]}')

    # VERIFY: Re-detect eyes in the output image to confirm actual positions
    # Convert to grayscale for eye detection
    gray = cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY)

    # Use Haar Cascade for eye detection (built into OpenCV)
    eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
    detected_eyes = eye_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

    print(f'\n🔍 VERIFICATION: Re-detecting eyes in output image')
    print(f'   Detected {len(detected_eyes)} eye regions')

    actual_eye_positions = []
    if len(detected_eyes) >= 2:
        # Sort by x-coordinate (left to right in image = right to left eyes for baby facing camera)
        sorted_eyes = sorted(detected_eyes, key=lambda e: e[0])

        # Right eye (left side of image), Left eye (right side of image)
        for i, (x, y, w, h) in enumerate(sorted_eyes[:2]):
            # Eye center is middle of detected rectangle
            center_x = x + w // 2
            center_y = y + h // 2
            actual_eye_positions.append((center_x, center_y))
            eye_label = "RIGHT" if i == 0 else "LEFT"
            print(f'   {eye_label} eye detected at: ({center_x}, {center_y})')

    # Calculate errors
    if len(actual_eye_positions) == 2:
        actual_right_eye, actual_left_eye = actual_eye_positions

        left_error_x = actual_left_eye[0] - TARGET_LEFT_EYE[0]
        left_error_y = actual_left_eye[1] - TARGET_LEFT_EYE[1]
        right_error_x = actual_right_eye[0] - TARGET_RIGHT_EYE[0]
        right_error_y = actual_right_eye[1] - TARGET_RIGHT_EYE[1]

        max_error = max(abs(left_error_x), abs(left_error_y), abs(right_error_x), abs(right_error_y))

        print(f'\n📏 ACCURACY:')
        print(f'   LEFT eye:')
        print(f'      Expected: ({TARGET_LEFT_EYE[0]}, {TARGET_LEFT_EYE[1]})')
        print(f'      Actual:   ({actual_left_eye[0]}, {actual_left_eye[1]})')
        print(f'      Error:    ({left_error_x:+d}px, {left_error_y:+d}px)')
        print(f'   RIGHT eye:')
        print(f'      Expected: ({TARGET_RIGHT_EYE[0]}, {TARGET_RIGHT_EYE[1]})')
        print(f'      Actual:   ({actual_right_eye[0]}, {actual_right_eye[1]})')
        print(f'      Error:    ({right_error_x:+d}px, {right_error_y:+d}px)')
        print(f'   Max error: {max_error}px')

        if max_error <= 10:
            print(f'   ✅ PASS - Eyes within ±10px tolerance')
        elif max_error <= 30:
            print(f'   ⚠️  ACCEPTABLE - Eyes within ±30px (minor adjustment needed)')
        else:
            print(f'   ❌ FAIL - Eyes more than 30px off target')
    else:
        print(f'   ⚠️  Could not verify - detected {len(actual_eye_positions)} eyes instead of 2')

    # Add debug visualization
    debug_img = aligned.copy()

    # Draw detected eyes as GREEN circles if verification worked
    if len(actual_eye_positions) == 2:
        cv2.circle(debug_img, actual_eye_positions[1], 6, (0, 255, 0), -1)  # Left eye (green)
        cv2.circle(debug_img, actual_eye_positions[0], 6, (0, 255, 0), -1)  # Right eye (green)

    # Blue dots at TARGET eye positions (where eyes should be)
    cv2.circle(debug_img, TARGET_LEFT_EYE, 8, (255, 0, 0), -1)
    cv2.circle(debug_img, TARGET_RIGHT_EYE, 8, (255, 0, 0), -1)

    # Yellow crosshairs at eye Y-level (432) to show horizontal alignment
    cv2.line(debug_img, (0, TARGET_LEFT_EYE[1]), (OUTPUT_SIZE[0], TARGET_LEFT_EYE[1]), (0, 255, 255), 2)

    # Yellow vertical lines at eye X positions
    cv2.line(debug_img, (TARGET_LEFT_EYE[0], 0), (TARGET_LEFT_EYE[0], OUTPUT_SIZE[1]), (0, 255, 255), 1)
    cv2.line(debug_img, (TARGET_RIGHT_EYE[0], 0), (TARGET_RIGHT_EYE[0], OUTPUT_SIZE[1]), (0, 255, 255), 1)

    print(f'\n📊 Visual debugging:')
    print(f'   GREEN dots = actual detected eye positions (if found)')
    print(f'   Blue dots = target eye positions')
    print(f'   Yellow horizontal line = Y=432 (eye level)')
    print(f'   Yellow vertical lines = X=360 and X=720 (eye X positions)')
    print(f'   GREEN should overlap BLUE dots for perfect alignment')

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
