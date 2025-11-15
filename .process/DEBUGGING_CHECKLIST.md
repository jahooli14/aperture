# Debugging Checklist - Lessons Learned

## Critical: Always Verify Your Assumptions First

### Case Study: Eye Alignment Bug (2025-01-12)

**Problem**: Spent 90+ minutes debugging "wrong eye detection" when the actual issue was coordinate scaling.

**Root Cause**: Never verified that the test image dimensions matched the detection metadata dimensions.

**Time Wasted**: 90 minutes

**Fix Time Once Found**: 30 seconds

---

## The Debugging Checklist

When debugging coordinate/positioning issues, **ALWAYS check these FIRST**:

### 1. Dimension Verification (DO THIS FIRST!)

```javascript
// ✅ ALWAYS verify dimensions match
const actualImage = await sharp(buffer).metadata();
const detectionMeta = database.eye_coordinates;

console.log('═══ DIMENSION CHECK ═══');
console.log('Actual image:', actualImage.width, 'x', actualImage.height);
console.log('Detection done on:', detectionMeta.imageWidth, 'x', detectionMeta.imageHeight);

if (actualImage.width !== detectionMeta.imageWidth) {
  const scale = actualImage.width / detectionMeta.imageWidth;
  console.warn('⚠️  MISMATCH! Scale factor:', scale);
  console.warn('Coordinates need scaling by', scale + 'x');

  // Apply scaling
  const scaledCoords = {
    leftEye: {
      x: detectionMeta.leftEye.x * scale,
      y: detectionMeta.leftEye.y * scale
    },
    rightEye: {
      x: detectionMeta.rightEye.x * scale,
      y: detectionMeta.rightEye.y * scale
    }
  };
}
```

### 2. Coordinate System Verification

- ✅ Confirm origin (0,0) location: top-left? center? bottom-left?
- ✅ Confirm axes: X = horizontal, Y = vertical?
- ✅ Confirm units: pixels? percentages? normalized 0-1?

### 3. Visual Verification with Metadata

When creating test visualizations, **ALWAYS show the metadata**:

```javascript
// ❌ BAD - No context
const svg = `<circle cx="${x}" cy="${y}" r="30" stroke="red"/>`;

// ✅ GOOD - Shows dimensions and coordinates
const svg = `
  <svg width="${width}" height="${height}">
    <circle cx="${x}" cy="${y}" r="30" stroke="red"/>
    <text x="10" y="30" fill="white" font-size="20">
      Image: ${width}×${height}
      Coords: (${x}, ${y})
      Expected: ${expectedWidth}×${expectedHeight}
    </text>
  </svg>`;
```

### 4. Sanity Check with Percentages

Convert coordinates to percentages as a sanity check:

```javascript
const leftEyePercent = {
  x: (leftEye.x / imageWidth * 100).toFixed(1) + '%',
  y: (leftEye.y / imageHeight * 100).toFixed(1) + '%'
};

console.log('Left eye at:', leftEyePercent);
// Expected: roughly 30-40% across, 30-40% down for face photos
// If you see 5% or 95%, something is very wrong!
```

### 5. Work Backwards from Success

If you have ONE working example:
1. Document EXACTLY what made it work
2. Compare dimensions, coordinate systems, scales
3. Find what's different in the failing case

---

## Red Flags That Should Trigger Dimension Check

🚩 Coordinates produce results that are way off (>100px error)
🚩 Visual markers appear on edges/corners instead of features
🚩 Transformation produces zoomed-in or zoomed-out unexpected results
🚩 You're seeing "dark fabric" or "background" instead of subject
🚩 Algorithm works perfectly in theory but fails in practice

**If you see ANY of these, STOP and check dimensions immediately.**

---

## The 30-Second Rule

> "Any coordinate bug that takes more than 30 seconds to fix is probably a dimension mismatch you haven't checked yet."

---

## Process Integration

### Before Starting Any Coordinate Work:

1. ✅ Print actual image dimensions
2. ✅ Print metadata dimensions
3. ✅ Verify they match OR calculate scale factor
4. ✅ Test with ONE example end-to-end before building complex solution
5. ✅ Visualize with metadata overlay

### During Debugging:

1. ✅ Check dimensions FIRST (not last!)
2. ✅ Convert to percentages for sanity check
3. ✅ Create minimal reproducible test case
4. ✅ Work backwards from any working example

### After Fixing:

1. ✅ Document what the bug was
2. ✅ Add dimension checks to production code
3. ✅ Add assertion/validation that catches this in future

---

## Applying This to Eye Alignment

### Production Code Should Have:

```typescript
export async function alignPhoto(imageBuffer: Buffer, eyeCoords: EyeCoordinates) {
  // STEP 1: ALWAYS verify dimensions
  const actualDimensions = await sharp(imageBuffer).metadata();
  const detectionDimensions = {
    width: eyeCoords.imageWidth,
    height: eyeCoords.imageHeight
  };

  // STEP 2: Calculate scale if needed
  const scale = actualDimensions.width / detectionDimensions.width;

  if (Math.abs(scale - 1.0) > 0.01) {
    // Dimensions don't match - scale coordinates
    console.warn('Scaling coordinates by factor:', scale);
    eyeCoords = {
      ...eyeCoords,
      leftEye: {
        x: eyeCoords.leftEye.x * scale,
        y: eyeCoords.leftEye.y * scale
      },
      rightEye: {
        x: eyeCoords.rightEye.x * scale,
        y: eyeCoords.rightEye.y * scale
      }
    };
  }

  // STEP 3: Validate coordinates are within bounds
  if (eyeCoords.leftEye.x < 0 || eyeCoords.leftEye.x > actualDimensions.width) {
    throw new Error('Eye coordinates out of bounds after scaling');
  }

  // STEP 4: Proceed with alignment...
}
```

---

## Key Takeaway

> **"Verify dimensions before debugging algorithms."**

When coordinates don't work, 99% of the time it's:
1. Dimension mismatch (scale issue)
2. Coordinate system mismatch (origin/axes)
3. Units mismatch (pixels vs percentages)

NOT:
- Complex algorithm bugs
- ML model failures
- Mathematical errors

**Check the simple stuff first.**

---

*Last updated: 2025-01-12*
*Incident: Eye alignment coordinate scaling bug*
*Time lost: 90 minutes*
*Lesson: Always verify dimensions FIRST*
