import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import type { Database } from '../types/database';

type Photo = Database['public']['Tables']['photos']['Row'];

export interface EyeCoordinates {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  confidence: number;
  imageWidth: number;
  imageHeight: number;
}

interface PhotoState {
  photos: Photo[];
  loading: boolean;
  uploading: boolean;
  deleting: boolean;
  fetchError: string | null;
  fetchPhotos: () => Promise<void>;
  uploadPhoto: (file: File, eyeCoords: EyeCoordinates | null, uploadDate?: string, note?: string) => Promise<string>;
  updatePhotoNote: (photoId: string, note: string, emoji?: string) => Promise<void>;
  deletePhoto: (photoId: string) => Promise<void>;
  restorePhoto: (photo: Photo) => void;
  hasUploadedToday: () => boolean;
  hasUploadedForDate: (date: string) => boolean;
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photos: [],
  loading: false,
  uploading: false,
  deleting: false,
  fetchError: null,

  fetchPhotos: async () => {
    set({ loading: true, fetchError: null });

    // Add timeout to prevent infinite loading
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Fetch timeout after 10 seconds')), 10000);
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
        const errorMsg = `Database error: ${error.message}`;
        set({ loading: false, fetchError: errorMsg });
        return;
      }

      set({ photos: data || [], loading: false, fetchError: null });
    } catch (err) {
      logger.error('Unexpected error fetching photos', { error: err instanceof Error ? err.message : String(err) }, 'PhotoStore');
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      set({ loading: false, photos: [], fetchError: errorMsg });
    }
  },

  uploadPhoto: async (file: File, eyeCoords: EyeCoordinates | null, uploadDate?: string, note?: string) => {
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

      // Upload to Supabase Storage
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExtension}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('originals')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        logger.error('Storage upload error', { error: uploadError.message, fileName }, 'PhotoStore');
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('originals')
        .getPublicUrl(uploadData.path);

      // Prepare photo record with eye coordinates if available
      // Note: If eyes were detected, the uploaded file is already aligned client-side
      // Both original_url and aligned_url point to the same aligned image
      type PhotoInsert = Database['public']['Tables']['photos']['Insert'];

      const photoRecord: PhotoInsert = {
        user_id: user.id,
        upload_date: targetDate,
        original_url: publicUrl,
        aligned_url: publicUrl, // Points to aligned image (if eyes were detected)
        eye_coordinates: eyeCoords ? {
          leftEye: eyeCoords.leftEye,
          rightEye: eyeCoords.rightEye,
          confidence: eyeCoords.confidence,
          imageWidth: eyeCoords.imageWidth,
          imageHeight: eyeCoords.imageHeight
        } : null,
        metadata: note ? { note } : null,
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

      // Refresh photos
      await get().fetchPhotos();

      set({ uploading: false });
      return (photoData as Photo).id;
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

      const { error } = await supabase
        .from('photos')
        .update({ metadata } as never)
        .eq('id', photoId)
        .eq('user_id', user.id); // Ensure user can only update their own photos

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
      const apiUrl = window.location.origin + '/api/delete-photo';

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
}));
