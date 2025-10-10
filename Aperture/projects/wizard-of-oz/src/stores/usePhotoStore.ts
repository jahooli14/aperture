import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Photo = Database['public']['Tables']['photos']['Row'];

interface PhotoState {
  photos: Photo[];
  loading: boolean;
  uploading: boolean;
  deleting: boolean;
  fetchPhotos: () => Promise<void>;
  uploadPhoto: (file: File) => Promise<string>;
  deletePhoto: (photoId: string) => Promise<void>;
  hasUploadedToday: () => boolean;
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photos: [],
  loading: false,
  uploading: false,
  deleting: false,

  fetchPhotos: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('upload_date', { ascending: false });

    if (error) {
      console.error('Error fetching photos:', error);
      set({ loading: false });
      return;
    }

    set({ photos: data || [], loading: false });
  },

  uploadPhoto: async (file: File) => {
    set({ uploading: true });

    try {
      console.log('Starting upload process...', { fileName: file.name, fileSize: file.size });

      const { data: { user } } = await supabase.auth.getUser();
      console.log('User authentication check:', { userId: user?.id, isAuthenticated: !!user });

      if (!user) throw new Error('Not authenticated');

      // Check if already uploaded today
      const today = new Date().toISOString().split('T')[0];
      console.log('Checking for existing upload today:', { today, userId: user.id });

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

      // Insert photo record
      console.log('Inserting photo record...');
      const { data: photoData, error: insertError } = await (supabase
        .from('photos') as any)
        .insert({
          user_id: user.id,
          upload_date: today,
          original_url: publicUrl,
        })
        .select()
        .single();

      console.log('Database insert result:', { photoData, insertError });

      if (insertError || !photoData) {
        console.error('Database insert error:', insertError);
        throw insertError || new Error('Failed to create photo record');
      }

      console.log('Photo record created successfully, triggering eye detection...');

      // Trigger eye detection and alignment via API (async, don't wait)
      const apiUrl = window.location.origin + '/api/detect-eyes';
      console.log('Calling API:', apiUrl, 'with photoId:', (photoData as Photo).id);

      fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: (photoData as Photo).id }),
      })
        .then(res => {
          console.log('API response status:', res.status);
          return res.json();
        })
        .then(data => console.log('API response:', data))
        .catch(err => console.error('Eye detection request failed:', err));

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
