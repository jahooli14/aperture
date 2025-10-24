import type { Database } from '../types/database';

type Photo = Database['public']['Tables']['photos']['Row'];

/**
 * Get the display URL for a photo
 * Storage is protected by RLS, so public URLs are secure for authenticated users
 *
 * @param photo - Photo object from database
 * @returns URL to display (prefers aligned over original)
 */
export function getPhotoDisplayUrl(photo: Photo): string {
  // Prefer aligned photo over original
  // No need for signed URLs - storage bucket RLS handles security
  return photo.aligned_url || photo.original_url;
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
