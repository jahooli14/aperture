import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { alignPhoto, calculateZoomLevel } from '../lib/imageUtils';
import { detectEyesFromImage } from '../lib/faceDetection';
import type { Database } from '../types/database';

type Photo = Database['public']['Tables']['photos']['Row'];
type AlignmentTransform = NonNullable<Photo['alignment_transform']>;

export interface EyeCoordinates {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  confidence: number;
  imageWidth: number;
  imageHeight: number;
  eyesOpen?: number;
  faceWidth?: number;
  irisAgreement?: number;
}

/**
 * Rolling stats over the user's recent photo eye metrics. Used for outlier
 * detection on upload — an interocular distance or face-to-eye ratio that sits
 * wildly outside the user's own history usually indicates a bad detection or a
 * photo of the wrong subject.
 */
export interface EyeHistoryStats {
  sampleSize: number;
  medianNormalizedEyeDistance: number; // eye_distance / image_width
  medianFaceEyeRatio: number;          // face_width / eye_distance (stable across framing)
}

// In-memory cache for signed URLs (1 hour expiry)
interface SignedUrlCache {
  url: string;
  expiresAt: number;
}
const signedUrlCache = new Map<string, SignedUrlCache>();

function getCachedSignedUrl(path: string): string | null {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  if (cached) {
    signedUrlCache.delete(path); // Remove expired entry
  }
  return null;
}

function setCachedSignedUrl(path: string, url: string, expirySeconds: number): void {
  signedUrlCache.set(path, {
    url,
    expiresAt: Date.now() + (expirySeconds * 1000)
  });
}

interface PhotoState {
  photos: Photo[];
  loading: boolean;
  uploading: boolean;
  deleting: boolean;
  fetchError: string | null;
  fetchPhotos: (retryCount?: number) => Promise<void>;
  uploadPhoto: (
    originalFile: File,
    alignedFile: File | null,
    eyeCoords: EyeCoordinates | null,
    transform: AlignmentTransform | null,
    uploadDate?: string,
    note?: string,
    emoji?: string,
    zoomLevel?: number
  ) => Promise<string>;
  updatePhotoNote: (photoId: string, note: string, emoji?: string) => Promise<void>;
  deletePhoto: (photoId: string) => Promise<void>;
  restorePhoto: (photo: Photo) => void;
  hasUploadedToday: () => boolean;
  hasUploadedForDate: (date: string) => boolean;
  getEyeHistoryStats: (limit?: number) => EyeHistoryStats | null;
  reAlignPhoto: (photoId: string, newEyeCoords: Pick<EyeCoordinates, 'leftEye' | 'rightEye'>, birthdate?: string | null) => Promise<void>;
  reAlignBacklog: (
    birthdate?: string | null,
    onProgress?: (done: number, total: number) => void
  ) => Promise<{ processed: number; aligned: number; failed: number }>;
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photos: [],
  loading: false,
  uploading: false,
  deleting: false,
  fetchError: null,

  fetchPhotos: async (retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

    set({ loading: true, fetchError: null });
    console.log(`[PhotoStore] Fetching photos... (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    // Add timeout to prevent infinite loading
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Fetch timeout after 15 seconds')), 15000);
    });

    try {
      const fetchPromise = supabase
        .from('photos')
        .select('*')
        .order('upload_date', { ascending: false });

      const result = await Promise.race([fetchPromise, timeoutPromise]);

      // Type guard for the timeout promise
      if (result instanceof Error) {
        throw result;
      }

      // Type assertion since we know the shape after filtering out Error
      const { data, error } = result as Awaited<typeof fetchPromise>;

      if (error) {
        logger.error('Error fetching photos', { error: error.message }, 'PhotoStore');
        console.error('[PhotoStore] Error fetching photos:', error.message);

        // Retry on database errors
        if (retryCount < MAX_RETRIES) {
          console.log(`[PhotoStore] Retrying in ${RETRY_DELAYS[retryCount]}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retryCount]));
          return get().fetchPhotos(retryCount + 1);
        }

        const errorMsg = `Database error: ${error.message}`;
        set({ loading: false, fetchError: errorMsg });
        return;
      }

      // Generate signed URLs using batch API for performance
      const dataArray: Photo[] = data || [];
      console.log(`[PhotoStore] Fetched ${dataArray.length} photos from database`);

      // Collect all paths that need signed URLs (check cache first)
      const pathsToGenerate: { type: 'original' | 'aligned', path: string, photoIndex: number }[] = [];
      const photosWithSignedUrls = dataArray.map(photo => ({ ...photo } as Photo));

      dataArray.forEach((photo, index) => {
        // Check original URL
        if (photo.original_url) {
          const path = photo.original_url.split('/storage/v1/object/public/originals/')[1];
          if (path) {
            const cachedUrl = getCachedSignedUrl(`original_${path}`);
            if (cachedUrl) {
              photosWithSignedUrls[index].signed_original_url = cachedUrl;
            } else {
              pathsToGenerate.push({ type: 'original', path, photoIndex: index });
            }
          }
        }

        // Check aligned URL
        if (photo.aligned_url) {
          const path = photo.aligned_url.split('/storage/v1/object/public/originals/')[1];
          if (path) {
            const cachedUrl = getCachedSignedUrl(`aligned_${path}`);
            if (cachedUrl) {
              photosWithSignedUrls[index].signed_aligned_url = cachedUrl;
            } else {
              pathsToGenerate.push({ type: 'aligned', path, photoIndex: index });
            }
          }
        }
      });

      // Batch generate signed URLs for uncached paths with timeout protection
      if (pathsToGenerate.length > 0) {
        try {
          const paths = pathsToGenerate.map(item => item.path);

          // Add timeout for signed URL generation
          const signedUrlPromise = supabase.storage
            .from('originals')
            .createSignedUrls(paths, 3600);

          const signedUrlTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Signed URL generation timeout')), 10000);
          });

          const signedResult = await Promise.race([signedUrlPromise, signedUrlTimeout]);
          const { data: signedData, error: signError } = signedResult;

          if (signError) {
            logger.error('Batch signed URL generation failed', { error: signError.message }, 'PhotoStore');
            // Continue without signed URLs - photos will still work with public URLs
          } else if (signedData) {
            // Map signed URLs back to photos and cache them
            signedData.forEach((urlData, idx) => {
              if (urlData.signedUrl) {
                const { type, path, photoIndex } = pathsToGenerate[idx];
                const cacheKey = `${type}_${path}`;

                if (type === 'original') {
                  photosWithSignedUrls[photoIndex].signed_original_url = urlData.signedUrl;
                } else {
                  photosWithSignedUrls[photoIndex].signed_aligned_url = urlData.signedUrl;
                }

                setCachedSignedUrl(cacheKey, urlData.signedUrl, 3600);
              } else if (urlData.error) {
                logger.warn('Failed to create signed URL', {
                  path: pathsToGenerate[idx].path,
                  error: urlData.error
                }, 'PhotoStore');
              }
            });
          }
        } catch (err) {
          // Log but don't fail - photos will use public URLs as fallback
          logger.warn('Signed URL generation failed, using public URLs', {
            error: err instanceof Error ? err.message : String(err)
          }, 'PhotoStore');
        }
      }

      set({ photos: photosWithSignedUrls, loading: false, fetchError: null });
    } catch (err) {
      logger.error('Unexpected error fetching photos', { error: err instanceof Error ? err.message : String(err) }, 'PhotoStore');

      // Retry on network/timeout errors
      if (retryCount < MAX_RETRIES) {
        console.log(`[PhotoStore] Retrying in ${RETRY_DELAYS[retryCount]}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retryCount]));
        return get().fetchPhotos(retryCount + 1);
      }

      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      set({ loading: false, photos: [], fetchError: errorMsg });
    }
  },

  uploadPhoto: async (
    originalFile: File,
    alignedFile: File | null,
    eyeCoords: EyeCoordinates | null,
    transform: AlignmentTransform | null,
    uploadDate?: string,
    note?: string,
    emoji?: string,
    zoomLevel?: number
  ) => {
    set({ uploading: true });

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      // Use provided date or default to today
      const targetDate = uploadDate || new Date().toISOString().split('T')[0];

      // Validate date is not in the future
      const today = new Date().toISOString().split('T')[0];
      if (targetDate > today) {
        throw new Error('Cannot upload photos for future dates');
      }

      // Validate date is not too far in the past (reasonable limit: 5 years)
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const minDate = fiveYearsAgo.toISOString().split('T')[0];
      if (targetDate < minDate) {
        throw new Error('Cannot upload photos older than 5 years');
      }

      // Persist the TRUE original separately from the aligned image. This is
      // what makes re-alignment lossless: the eye_coordinates we store are in
      // the original's pixel space, so a later re-align (manual or auto) starts
      // from untouched pixels instead of re-warping an already-warped image.
      const stamp = Date.now();
      const ext = originalFile.name.split('.').pop() || 'jpg';

      const uploadOne = async (f: File, suffix: string): Promise<string> => {
        const path = `${user.id}/${stamp}${suffix}.${ext}`;
        const { data, error } = await supabase.storage
          .from('originals')
          .upload(path, f, { contentType: f.type || 'image/jpeg', upsert: false });
        if (error) {
          logger.error('Storage upload error', { error: error.message, path }, 'PhotoStore');
          throw error;
        }
        return supabase.storage.from('originals').getPublicUrl(data.path).data.publicUrl;
      };

      const originalUrl = await uploadOne(originalFile, '-original');
      // If alignment ran, store the aligned render too; otherwise the timeline
      // falls back to the original (this should be rare now that failed
      // detection drops the user into manual eye placement instead).
      const alignedUrl = alignedFile ? await uploadOne(alignedFile, '-aligned') : originalUrl;

      type PhotoInsert = Database['public']['Tables']['photos']['Insert'];

      const photoRecord: PhotoInsert = {
        user_id: user.id,
        upload_date: targetDate,
        original_url: originalUrl,
        aligned_url: alignedUrl,
        alignment_transform: alignedFile ? transform : null,
        eye_coordinates: eyeCoords ? {
          leftEye: eyeCoords.leftEye,
          rightEye: eyeCoords.rightEye,
          confidence: eyeCoords.confidence,
          imageWidth: eyeCoords.imageWidth,
          imageHeight: eyeCoords.imageHeight,
          ...(eyeCoords.eyesOpen !== undefined ? { eyesOpen: eyeCoords.eyesOpen } : {}),
          ...(eyeCoords.faceWidth !== undefined ? { faceWidth: eyeCoords.faceWidth } : {}),
          ...(eyeCoords.irisAgreement !== undefined ? { irisAgreement: eyeCoords.irisAgreement } : {}),
        } : null,
        metadata: {
          ...(note ? { note } : {}),
          ...(emoji ? { emoji } : {}),
          ...(zoomLevel !== undefined ? { zoom_level: zoomLevel } : {})
        },
      };

      // Insert photo record (type assertion required for Supabase generated types)
      const { data: photoData, error: insertError } = await supabase
        .from('photos')
        .insert(photoRecord as never)
        .select()
        .single();

      if (insertError || !photoData) {
        logger.error('Database insert error', { error: insertError?.message || 'No photo data returned' }, 'PhotoStore');

        // Handle duplicate photo for date
        if (insertError?.code === '23505') {
          const formattedDate = new Date(targetDate + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          throw new Error(`You already have a photo for ${formattedDate}. Delete the existing photo first if you want to replace it.`);
        }

        throw insertError || new Error('Failed to create photo record');
      }

      // Optimistically insert the new photo so the gallery shows it on the next
      // frame. Previously we awaited fetchPhotos() here, which made the success
      // toast wait on a full DB+signed-URL round trip (~500-2000ms) before
      // anything visible changed.
      //
      // Signed URLs will be populated by the background refetch below; until
      // then we expose the public URL on signed_aligned_url so getPhotoDisplayUrl
      // can render immediately. If the bucket is private the signed version
      // swaps in seconds later — the optimistic image still loads from cache
      // because the upload just wrote it.
      const insertedPhoto = photoData as Photo;
      const optimisticPhoto: Photo = {
        ...insertedPhoto,
        signed_original_url: insertedPhoto.signed_original_url ?? insertedPhoto.original_url,
        signed_aligned_url:
          insertedPhoto.signed_aligned_url ?? insertedPhoto.aligned_url ?? insertedPhoto.original_url,
      };
      const merged = [optimisticPhoto, ...get().photos.filter(p => p.id !== optimisticPhoto.id)]
        .sort((a, b) => b.upload_date.localeCompare(a.upload_date));
      set({ photos: merged, uploading: false });

      // Refresh photos in the background (no await) so signed URLs and any
      // server-side fields (e.g. partner-shared rows) catch up without holding
      // the caller's success animation hostage.
      void get().fetchPhotos();

      return insertedPhoto.id;
    } catch (error) {
      logger.error('Upload failed', { error: error instanceof Error ? error.message : String(error) }, 'PhotoStore');
      set({ uploading: false });
      throw error;
    }
  },

  updatePhotoNote: async (photoId: string, note: string, emoji: string = '💬') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      // Update the photo's metadata with the new note and emoji
      const metadata = {
        note: note.trim() || null,
        emoji: emoji || '💬'
      };

      // Share partners can edit notes on each other's photos (see migration
      // 021); we rely on RLS to enforce the own-or-shared check rather than
      // filtering by user_id here, which would silently exclude partner-owned
      // photos and make the save look successful with zero rows affected.
      const { error } = await supabase
        .from('photos')
        .update({ metadata } as never)
        .eq('id', photoId);

      if (error) {
        logger.error('Error updating photo note', { error: error.message, photoId }, 'PhotoStore');
        throw error;
      }

      // Update local state
      const currentPhotos = get().photos;
      const updatedPhotos = currentPhotos.map(photo =>
        photo.id === photoId
          ? { ...photo, metadata }
          : photo
      );
      set({ photos: updatedPhotos });

      logger.info('Photo note updated successfully', { photoId }, 'PhotoStore');
    } catch (error) {
      logger.error('Failed to update photo note', { error: error instanceof Error ? error.message : String(error), photoId }, 'PhotoStore');
      throw error;
    }
  },

  deletePhoto: async (photoId: string) => {
    set({ deleting: true });

    try {
      // Use the consolidated pupils API endpoint
      const apiUrl = window.location.origin + '/api/pupils?action=delete-photo';

      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete photo');
      }

      // Remove photo from local state
      const currentPhotos = get().photos;
      const updatedPhotos = currentPhotos.filter(photo => photo.id !== photoId);
      set({ photos: updatedPhotos, deleting: false });
    } catch (error) {
      logger.error('Delete photo failed', { error: error instanceof Error ? error.message : String(error), photoId }, 'PhotoStore');
      set({ deleting: false });
      throw error;
    }
  },

  restorePhoto: (photo: Photo) => {
    // Optimistically restore the photo to local state
    const currentPhotos = get().photos;
    const updatedPhotos = [...currentPhotos, photo].sort((a, b) =>
      b.upload_date.localeCompare(a.upload_date)
    );
    set({ photos: updatedPhotos });
  },

  hasUploadedToday: () => {
    const today = new Date().toISOString().split('T')[0];
    const photos = get().photos;
    return photos.some(photo => photo.upload_date === today);
  },

  hasUploadedForDate: (date: string) => {
    const photos = get().photos;
    return photos.some(photo => photo.upload_date === date);
  },

  getEyeHistoryStats: (limit: number = 20) => {
    const photos = get().photos;
    const samples: Array<{ normalizedEyeDistance: number; faceEyeRatio: number | null }> = [];

    for (const photo of photos) {
      const ec = photo.eye_coordinates;
      if (!ec || !ec.imageWidth) continue;
      const dx = ec.rightEye.x - ec.leftEye.x;
      const dy = ec.rightEye.y - ec.leftEye.y;
      const eyeDist = Math.sqrt(dx * dx + dy * dy);
      if (eyeDist <= 0) continue;
      samples.push({
        normalizedEyeDistance: eyeDist / ec.imageWidth,
        faceEyeRatio: ec.faceWidth ? ec.faceWidth / eyeDist : null,
      });
      if (samples.length >= limit) break;
    }

    if (samples.length < 3) return null; // Not enough history to compare.

    const median = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    };

    const normalized = samples.map(s => s.normalizedEyeDistance);
    const ratios = samples.map(s => s.faceEyeRatio).filter((v): v is number => v !== null);

    return {
      sampleSize: samples.length,
      medianNormalizedEyeDistance: median(normalized),
      // If we have zero historical face-width data, fall back to 0 (skip ratio check upstream).
      medianFaceEyeRatio: ratios.length >= 3 ? median(ratios) : 0,
    };
  },

  /**
   * Re-align an existing photo using user-corrected eye coordinates.
   *
   * Fetches the true original, runs alignPhoto() with the supplied coords,
   * uploads the re-aligned bytes to a new storage path, and updates the
   * photo row's `aligned_url`, `eye_coordinates`, and metadata.zoom_level.
   *
   * Re-aligning from the original is what makes rotation/zoom adjustments
   * lossless — every edit re-warps untouched pixels, so the crop frame can
   * move freely without revealing white margins from a prior tight crop.
   * Falls back to the aligned image only for legacy rows that pre-date
   * separate-original storage (where original_url === aligned_url).
   */
  reAlignPhoto: async (photoId, newEyeCoords, birthdate) => {
    const photo = get().photos.find((p) => p.id === photoId);
    if (!photo) throw new Error('Photo not found');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    console.log('[reAlignPhoto] start', {
      photoId,
      photoOwner: photo.user_id,
      currentUser: user.id,
      ownedByCurrentUser: photo.user_id === user.id,
    });

    // Share partners can re-align each other's photos (see migration 021).
    // We still keep the row-count check below as a backstop in case RLS ever
    // rejects the update — that way we fail loud instead of phantom-saving.

    // Always start from the true original when one exists, so adjusting
    // rotation or zoom doesn't re-crop already-cropped pixels.
    const sourceUrl =
      photo.signed_original_url ||
      photo.original_url ||
      photo.signed_aligned_url ||
      photo.aligned_url;
    if (!sourceUrl) throw new Error('No source image available');

    // Fetch the image and wrap it as a File so alignPhoto can consume it.
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`Failed to fetch source image (${response.status})`);
    const blob = await response.blob();
    const sourceFile = new File([blob], `${photoId}-source.jpg`, {
      type: blob.type || 'image/jpeg',
    });

    // Need imageWidth/imageHeight for the full EyeCoordinates shape. We compute
    // them from the fetched image so the caller can pass just left/right coords
    // in that same image's pixel space.
    const bitmap = await createImageBitmap(sourceFile, { imageOrientation: 'from-image' });
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    bitmap.close();

    const coords: EyeCoordinates = {
      leftEye: newEyeCoords.leftEye,
      rightEye: newEyeCoords.rightEye,
      confidence: 1.0, // manual placement
      imageWidth: sourceWidth,
      imageHeight: sourceHeight,
    };

    // Compute zoom level from photo date + optional birthdate. Fall back to
    // the previously stored zoom if we can't derive a fresh one.
    let zoomLevel = 0.40;
    if (birthdate) {
      const photoDate = new Date(photo.upload_date);
      const birth = new Date(birthdate);
      const ageInMonths = Math.floor(
        (photoDate.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );
      zoomLevel = calculateZoomLevel(ageInMonths);
    } else {
      const prev = photo.metadata as Record<string, unknown> | null;
      if (prev && typeof prev.zoom_level === 'number') {
        zoomLevel = prev.zoom_level;
      }
    }

    const result = await alignPhoto(sourceFile, coords, zoomLevel);
    console.log('[reAlignPhoto] aligned', {
      outputBytes: result.alignedImage.size,
      outputType: result.alignedImage.type,
      zoomLevel,
    });

    // Upload to a new storage path so we don't trash the previous object.
    const fileName = `${user.id}/${Date.now()}-realigned.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('originals')
      .upload(fileName, result.alignedImage, {
        contentType: result.alignedImage.type || 'image/jpeg',
        upsert: false,
      });
    if (uploadError) {
      logger.error('Re-align storage upload failed', { error: uploadError.message }, 'PhotoStore');
      throw uploadError;
    }
    console.log('[reAlignPhoto] uploaded', { path: uploadData.path });

    const { data: { publicUrl } } = supabase.storage
      .from('originals')
      .getPublicUrl(uploadData.path);

    // Merge metadata, preserving existing note/emoji.
    const existingMetadata = (photo.metadata && typeof photo.metadata === 'object')
      ? { ...(photo.metadata as Record<string, unknown>) }
      : {};
    existingMetadata.zoom_level = zoomLevel;

    const updatePayload = {
      aligned_url: publicUrl,
      eye_coordinates: {
        leftEye: coords.leftEye,
        rightEye: coords.rightEye,
        confidence: coords.confidence,
        imageWidth: coords.imageWidth,
        imageHeight: coords.imageHeight,
      },
      metadata: existingMetadata,
    };

    // `.select()` returns the rows that were actually updated so we can verify
    // at least one matched. Without this, a zero-row update (e.g. RLS blocks,
    // id not found) looks like success to Supabase's error channel.
    //
    // We intentionally do NOT filter by `user_id` here: share partners can
    // re-align each other's photos (see migration 021), and RLS enforces the
    // own-or-shared check. Adding `.eq('user_id', user.id)` would silently
    // exclude the partner's photos even though RLS would allow the update.
    const { data: updatedRows, error: updateError } = await supabase
      .from('photos')
      .update(updatePayload as never)
      .eq('id', photoId)
      .select();

    if (updateError) {
      logger.error('Re-align DB update failed', { error: updateError.message, photoId }, 'PhotoStore');
      throw updateError;
    }
    if (!updatedRows || updatedRows.length === 0) {
      logger.error('Re-align DB update affected 0 rows', { photoId }, 'PhotoStore');
      throw new Error(
        "Re-align didn't save — the database rejected the update. This usually means the photo belongs to someone else."
      );
    }
    console.log('[reAlignPhoto] db updated', { rowsUpdated: updatedRows.length, newAlignedUrl: publicUrl });

    logger.info('Photo re-aligned', { photoId, zoomLevel }, 'PhotoStore');
    await get().fetchPhotos();
    console.log('[reAlignPhoto] done');
  },

  /**
   * One-shot pass to fix the existing timeline. Re-detects eyes (same pipeline
   * as upload) on every photo that wasn't aligned by the current pipeline —
   * i.e. anything missing `alignment_transform` — and re-renders a properly
   * stacked image. Photos already aligned by the new pipeline are skipped, so
   * this is safe to run repeatedly. Detection failures are left untouched (the
   * user can still fix those by hand via the per-photo adjust sheet).
   */
  reAlignBacklog: async (birthdate, onProgress) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const candidates = get().photos.filter((p) => !p.alignment_transform);
    const total = candidates.length;
    let aligned = 0;
    let failed = 0;

    for (let i = 0; i < candidates.length; i++) {
      const photo = candidates[i];
      try {
        // Prefer the true original (new rows store it separately; on legacy
        // rows original_url === aligned_url, so this is still the right pick).
        const sourceUrl =
          photo.signed_original_url || photo.original_url ||
          photo.signed_aligned_url || photo.aligned_url;
        if (!sourceUrl) { failed++; continue; }

        const response = await fetch(sourceUrl);
        if (!response.ok) { failed++; continue; }
        const blob = await response.blob();
        const sourceFile = new File([blob], `${photo.id}-source.jpg`, {
          type: blob.type || 'image/jpeg',
        });

        const coords = await detectEyesFromImage(sourceFile);
        if (!coords) { failed++; continue; }

        let zoomLevel = 0.40;
        if (birthdate) {
          const ageInMonths = Math.floor(
            (new Date(photo.upload_date).getTime() - new Date(birthdate).getTime()) /
            (1000 * 60 * 60 * 24 * 30.44)
          );
          zoomLevel = calculateZoomLevel(ageInMonths);
        } else {
          const prev = photo.metadata as Record<string, unknown> | null;
          if (prev && typeof prev.zoom_level === 'number') zoomLevel = prev.zoom_level;
        }

        const result = await alignPhoto(sourceFile, coords, zoomLevel);

        const fileName = `${user.id}/${Date.now()}-backfill.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('originals')
          .upload(fileName, result.alignedImage, {
            contentType: result.alignedImage.type || 'image/jpeg',
            upsert: false,
          });
        if (uploadError) { failed++; continue; }

        const { data: { publicUrl } } = supabase.storage
          .from('originals')
          .getPublicUrl(uploadData.path);

        const existingMetadata = (photo.metadata && typeof photo.metadata === 'object')
          ? { ...(photo.metadata as Record<string, unknown>) }
          : {};
        existingMetadata.zoom_level = zoomLevel;

        const updatePayload = {
          aligned_url: publicUrl,
          alignment_transform: result.transform,
          eye_coordinates: {
            leftEye: coords.leftEye,
            rightEye: coords.rightEye,
            confidence: coords.confidence,
            imageWidth: coords.imageWidth,
            imageHeight: coords.imageHeight,
            ...(coords.eyesOpen !== undefined ? { eyesOpen: coords.eyesOpen } : {}),
            ...(coords.faceWidth !== undefined ? { faceWidth: coords.faceWidth } : {}),
            ...(coords.irisAgreement !== undefined ? { irisAgreement: coords.irisAgreement } : {}),
          },
          metadata: existingMetadata,
        };

        const { data: updatedRows, error: updateError } = await supabase
          .from('photos')
          .update(updatePayload as never)
          .eq('id', photo.id)
          .select();

        if (updateError || !updatedRows || updatedRows.length === 0) {
          failed++;
          continue;
        }
        aligned++;
      } catch (err) {
        logger.error('Backlog re-align failed for photo', {
          photoId: photo.id,
          error: err instanceof Error ? err.message : String(err),
        }, 'PhotoStore');
        failed++;
      } finally {
        onProgress?.(i + 1, total);
      }
    }

    if (aligned > 0) await get().fetchPhotos();
    logger.info('Backlog re-align complete', { processed: total, aligned, failed }, 'PhotoStore');
    return { processed: total, aligned, failed };
  },
}));
