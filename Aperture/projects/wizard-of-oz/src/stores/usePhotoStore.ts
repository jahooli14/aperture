import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Photo = Database['public']['Tables']['photos']['Row'];

interface PhotoState {
  photos: Photo[];
  loading: boolean;
  uploading: boolean;
  fetchPhotos: () => Promise<void>;
  uploadPhoto: (file: File) => Promise<string>;
  hasUploadedToday: () => boolean;
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photos: [],
  loading: false,
  uploading: false,

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if already uploaded today
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('photos')
        .select('id')
        .eq('user_id', user.id)
        .eq('upload_date', today)
        .single();

      if (existing) {
        throw new Error('You have already uploaded a photo today');
      }

      // Upload to Supabase Storage
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('originals')
        .upload(fileName, file, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('originals')
        .getPublicUrl(uploadData.path);

      // Insert photo record
      const { data: photoData, error: insertError } = await supabase
        .from('photos')
        .insert({
          user_id: user.id,
          upload_date: today,
          original_url: publicUrl,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Trigger eye detection and alignment via API
      await fetch('/api/detect-eyes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photoData.id }),
      });

      // Refresh photos
      await get().fetchPhotos();

      set({ uploading: false });
      return photoData.id;
    } catch (error) {
      set({ uploading: false });
      throw error;
    }
  },

  hasUploadedToday: () => {
    const today = new Date().toISOString().split('T')[0];
    return get().photos.some(photo => photo.upload_date === today);
  },
}));
