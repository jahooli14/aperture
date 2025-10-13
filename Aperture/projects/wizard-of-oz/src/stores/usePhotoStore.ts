import { create } from 'zustand';
import { supabase } from '../lib/supabase';
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
  uploadPhoto: (file: File, eyeCoords: EyeCoordinates | null, uploadDate?: string) => Promise<string>;
  deletePhoto: (photoId: string) => Promise<void>;
  hasUploadedToday: () => boolean;
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
        console.error('Error fetching photos:', error);
        const errorMsg = `Database error: ${error.message}`;
        set({ loading: false, fetchError: errorMsg });
        return;
      }

      set({ photos: data || [], loading: false, fetchError: null });
    } catch (err) {
      console.error('Unexpected error fetching photos:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      set({ loading: false, photos: [], fetchError: errorMsg });
    }
  },

  uploadPhoto: async (file: File, eyeCoords: EyeCoordinates | null, uploadDate?: string) => {
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
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('originals')
        .getPublicUrl(uploadData.path);

      // Prepare photo record with eye coordinates if available
      // Since alignment is currently disabled, set aligned_url to original_url immediately
      // to prevent photos from being stuck in "processing" state
      type PhotoInsert = Database['public']['Tables']['photos']['Insert'];

      const photoRecord: PhotoInsert = {
        user_id: user.id,
        upload_date: targetDate,
        original_url: publicUrl,
        aligned_url: publicUrl, // Use original as aligned since alignment disabled
        eye_coordinates: eyeCoords ? {
          leftEye: eyeCoords.leftEye,
          rightEye: eyeCoords.rightEye,
          confidence: eyeCoords.confidence,
          imageWidth: eyeCoords.imageWidth,
          imageHeight: eyeCoords.imageHeight
        } : null,
      };

      // Insert photo record
      // Type assertion needed due to Supabase type generation issues
      const { data: photoData, error: insertError } = await (supabase
        .from('photos')
        .insert(photoRecord as never)
        .select()
        .single());

      if (insertError || !photoData) {
        console.error('Database insert error:', insertError);
        throw insertError || new Error('Failed to create photo record');
      }

      // Refresh photos
      await get().fetchPhotos();

      set({ uploading: false });
      return (photoData as Photo).id;
    } catch (error) {
      console.error('Upload failed:', error);
      set({ uploading: false });
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
      console.error('Delete photo failed:', error);
      set({ deleting: false });
      throw error;
    }
  },

  hasUploadedToday: () => {
    // Allow multiple uploads per day for now
    return false;
  },
}));
