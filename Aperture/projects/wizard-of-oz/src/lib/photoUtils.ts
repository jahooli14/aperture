import type { Database } from '../types/database';

type Photo = Database['public']['Tables']['photos']['Row'];

/**
 * Get the display URL for a photo, preferring signed URLs for security
 * Falls back to regular URLs if signed URLs are not available
 *
 * @param photo - Photo object from database
 * @returns URL to display (signed if available, otherwise regular)
 */
export function getPhotoDisplayUrl(photo: Photo): string {
  // Prefer aligned photo over original
  const signedUrl = photo.signed_aligned_url || photo.signed_original_url;
  const regularUrl = photo.aligned_url || photo.original_url;

  // Use signed URL if available, otherwise fall back to regular URL
  return signedUrl || regularUrl;
}

/**
 * Check if a photo has been aligned (has eye detection)
 *
 * @param photo - Photo object from database
 * @returns true if photo has been aligned
 */
export function isPhotoAligned(photo: Photo): boolean {
  return !!photo.aligned_url && photo.aligned_url !== photo.original_url;
}
