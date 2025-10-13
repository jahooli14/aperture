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
    console.log('📸 Fetching photos...');
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

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      console.log('📸 Fetch result:', {
        photoCount: data?.length || 0,
        error: error?.message || 'none'
      });

      if (error) {
        console.error('❌ Error fetching photos:', error);
        const errorMsg = `Database error: ${error.message}\n\nDetails: ${JSON.stringify(error, null, 2)}`;
        set({ loading: false, fetchError: errorMsg });
        return;
      }

      set({ photos: data || [], loading: false, fetchError: null });
      console.log('✅ Photos loaded successfully:', data?.length || 0);
    } catch (err) {
      console.error('❌ Unexpected error fetching photos:', err);
      const errorMsg = err instanceof Error
        ? `Error: ${err.message}\n\nStack: ${err.stack}`
        : `Unknown error: ${JSON.stringify(err)}`;
      set({ loading: false, photos: [], fetchError: errorMsg });
    }
  },

  uploadPhoto: async (file: File, eyeCoords: EyeCoordinates | null, uploadDate?: string) => {
    set({ uploading: true });

    try {
      console.log('Starting upload process...', {
        fileName: file.name,
        fileSize: file.size,
        uploadDate,
        hasEyeCoords: !!eyeCoords,
        eyeCoords
      });

      const { data: { user } } = await supabase.auth.getUser();
      console.log('User authentication check:', { userId: user?.id, isAuthenticated: !!user });

      if (!user) throw new Error('Not authenticated');

      // Use provided date or default to today
      const targetDate = uploadDate || new Date().toISOString().split('T')[0];
      console.log('Using upload date:', { targetDate, isCustom: !!uploadDate, userId: user.id });

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

      // TEMPORARILY DISABLED FOR TESTING - Allow multiple uploads per day
      // const { data: existing } = await supabase
      //   .from('photos')
      //   .select('id')
      //   .eq('user_id', user.id)
      //   .eq('upload_date', today)
      //   .single();

      // console.log('Existing upload check result:', { existing });

      // if (existing) {
      //   throw new Error('You have already uploaded a photo today');
      // }

      // Upload to Supabase Storage
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExtension}`;
      console.log('Uploading to storage:', { fileName, bucket: 'originals', contentType: file.type });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('originals')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      console.log('Storage upload result:', { uploadData, uploadError });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('originals')
        .getPublicUrl(uploadData.path);

      console.log('Generated public URL:', { publicUrl });

      // Prepare photo record with eye coordinates if available
      const photoRecord: any = {
        user_id: user.id,
        upload_date: targetDate,
        original_url: publicUrl,
      };

      // Add eye coordinates if detected
      if (eyeCoords) {
        photoRecord.left_eye_x = eyeCoords.leftEye.x;
        photoRecord.left_eye_y = eyeCoords.leftEye.y;
        photoRecord.right_eye_x = eyeCoords.rightEye.x;
        photoRecord.right_eye_y = eyeCoords.rightEye.y;
        photoRecord.detection_width = eyeCoords.imageWidth;
        photoRecord.detection_height = eyeCoords.imageHeight;
        photoRecord.status = 'detected'; // Mark as detected
        console.log('Including eye coordinates in photo record');
      } else {
        photoRecord.status = 'pending'; // No detection yet
        console.log('No eye coordinates - marking as pending');
      }

      // Insert photo record
      console.log('Inserting photo record...');
      const { data: photoData, error: insertError } = await (supabase
        .from('photos') as any)
        .insert(photoRecord)
        .select()
        .single();

      console.log('Database insert result:', { photoData, insertError });

      if (insertError || !photoData) {
        console.error('Database insert error:', insertError);
        throw insertError || new Error('Failed to create photo record');
      }

      console.log('Photo record created successfully with status:', photoRecord.status);

      // If we have eye coordinates, trigger alignment
      if (eyeCoords) {
        console.log('Triggering photo alignment...');
        const apiUrl = window.location.origin + '/api/align-photo';

        fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoId: (photoData as Photo).id }),
        })
          .then(res => {
            console.log('Alignment API response status:', res.status);
            return res.json();
          })
          .then(data => console.log('Alignment API response:', data))
          .catch(err => console.error('Photo alignment request failed:', err));
      }

      // Refresh photos
      console.log('Refreshing photos list...');
      await get().fetchPhotos();

      console.log('Upload completed successfully!');
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
      console.log('Deleting photo:', photoId);

      const apiUrl = window.location.origin + '/api/delete-photo';
      console.log('Calling delete API:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId }),
      });

      const result = await response.json();
      console.log('Delete API response:', { status: response.status, result });

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete photo');
      }

      // Remove photo from local state
      const currentPhotos = get().photos;
      const updatedPhotos = currentPhotos.filter(photo => photo.id !== photoId);
      set({ photos: updatedPhotos, deleting: false });

      console.log('✅ Photo deleted successfully from state');
    } catch (error) {
      console.error('❌ Delete photo failed:', error);
      set({ deleting: false });
      throw error;
    }
  },

  hasUploadedToday: () => {
    // TEMPORARILY DISABLED FOR TESTING - Allow multiple uploads per day
    return false;

    // const today = new Date().toISOString().split('T')[0];
    // return get().photos.some(photo => photo.upload_date === today);
  },
}));
