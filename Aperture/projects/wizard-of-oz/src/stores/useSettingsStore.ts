import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import type { Database } from '../types/database';

type UserSettings = Database['public']['Tables']['user_settings']['Row'];

interface SettingsState {
  settings: UserSettings | null;
  loading: boolean;
  fetchSettings: () => Promise<void>;
  updateBirthdate: (birthdate: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loading: false,

  fetchSettings: async () => {
    set({ loading: true });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        logger.error('Error fetching settings', { error: error.message }, 'SettingsStore');
        throw error;
      }

      if (!data) {
        // Create default settings if they don't exist
        const { data: newSettings, error: insertError} = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            baby_birthdate: null,
          } as never)
          .select()
          .single();

        if (insertError) {
          logger.error('Error creating settings', { error: insertError.message }, 'SettingsStore');
          throw insertError;
        }

        set({ settings: newSettings as UserSettings, loading: false });
      } else {
        set({ settings: data as UserSettings, loading: false });
      }
    } catch (error) {
      logger.error('Unexpected error fetching settings', {
        error: error instanceof Error ? error.message : String(error)
      }, 'SettingsStore');
      set({ loading: false });
    }
  },

  updateBirthdate: async (birthdate: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_settings')
        .update({
          baby_birthdate: birthdate,
          updated_at: new Date().toISOString()
        } as never)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        logger.error('Error updating birthdate', { error: error.message }, 'SettingsStore');
        throw error;
      }

      set({ settings: data as UserSettings });
      logger.info('Birthdate updated', { birthdate }, 'SettingsStore');
    } catch (error) {
      logger.error('Unexpected error updating birthdate', {
        error: error instanceof Error ? error.message : String(error)
      }, 'SettingsStore');
      throw error;
    }
  },
}));
