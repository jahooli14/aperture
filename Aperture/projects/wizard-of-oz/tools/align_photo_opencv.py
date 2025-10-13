#!/usr/bin/env python3
"""
Face/Eye alignment using OpenCV's proven affine transformation approach.
This eliminates manual coordinate tracking entirely.

Usage:
    python3 align_photo_opencv.py input.jpg output.jpg left_x left_y right_x right_y
"""

import sys
import cv2
import numpy as np
import json

# Target eye positions in 1080x1080 output
TARGET_LEFT_EYE = (720, 432)   # Baby's left eye (right side of image)
TARGET_RIGHT_EYE = (360, 432)  # Baby's right eye (left side of image)
OUTPUT_SIZE = (1080, 1080)

def align_face(image_path, output_path, left_eye, right_eye):
    """
    Align face using OpenCV's getAffineTransform + warpAffine.

    Args:
        image_path: Path to input image
        output_path: Path to save aligned image
        left_eye: Tuple (x, y) of detected left eye position
        right_eye: Tuple (x, y) of detected right eye position

    Returns:
        dict with status and debug info
    """
    # Read image
    img = cv2.imread(image_path)
    if img is None:
        return {"success": False, "error": "Could not read image"}

    original_height, original_width = img.shape[:2]

    # Use estimateAffinePartial2D for similarity transform (rotation + scale + translation only)
    # This is more constrained than full affine and works with just 2 points

    # Source points (detected eye positions)
    src_points = np.array([
        left_eye,
        right_eye
    ], dtype=np.float32).reshape(-1, 1, 2)

    # Destination points (target eye positions in output)
    dst_points = np.array([
        TARGET_LEFT_EYE,
        TARGET_RIGHT_EYE
    ], dtype=np.float32).reshape(-1, 1, 2)

    # Calculate similarity transformation matrix (no shearing/skewing)
    # This is the correct approach for face alignment
    M, _ = cv2.estimateAffinePartial2D(src_points, dst_points)

    # Apply transformation
    aligned = cv2.warpAffine(
        img,
        M,
        OUTPUT_SIZE,
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(255, 255, 255)  # White background
    )

    # Save aligned image
    cv2.imwrite(output_path, aligned, [cv2.IMWRITE_JPEG_QUALITY, 95])

    # Return debug info
    return {
        "success": True,
        "original_size": {"width": original_width, "height": original_height},
        "output_size": {"width": OUTPUT_SIZE[0], "height": OUTPUT_SIZE[1]},
        "source_eyes": {
            "left": {"x": float(left_eye[0]), "y": float(left_eye[1])},
            "right": {"x": float(right_eye[0]), "y": float(right_eye[1])}
        },
        "target_eyes": {
            "left": {"x": TARGET_LEFT_EYE[0], "y": TARGET_LEFT_EYE[1]},
            "right": {"x": TARGET_RIGHT_EYE[0], "y": TARGET_RIGHT_EYE[1]}
        },
        "transformation_matrix": M.tolist()
    }

def main():
    if len(sys.argv) != 7:
        print(json.dumps({
            "success": False,
            "error": "Usage: python3 align_photo_opencv.py input.jpg output.jpg left_x left_y right_x right_y"
        }))
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    try:
        left_eye = (float(sys.argv[3]), float(sys.argv[4]))
        right_eye = (float(sys.argv[5]), float(sys.argv[6]))
    except ValueError:
        print(json.dumps({
            "success": False,
            "error": "Eye coordinates must be numbers"
        }))
        sys.exit(1)

    result = align_face(input_path, output_path, left_eye, right_eye)
    print(json.dumps(result, indent=2))

    if not result["success"]:
        sys.exit(1)

if __name__ == "__main__":
    main()
