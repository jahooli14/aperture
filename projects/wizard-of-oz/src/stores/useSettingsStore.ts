import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import type { Database } from '../types/database';

type UserSettings = Database['public']['Tables']['user_settings']['Row'];

interface SettingsState {
  settings: UserSettings | null;
  loading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  updateBirthdate: (birthdate: string) => Promise<void>;
  updateReminderSettings: (settings: {
    reminder_email: string;
    reminders_enabled: boolean;
    reminder_time: string;
    timezone: string;
  }) => Promise<void>;
  generateInviteCode: () => Promise<string>;
  joinWithCode: (inviteCode: string) => Promise<void>;
  getSharedUsers: () => Promise<Array<{ user_id: string; email: string | null }>>;
  removeSharedUser: (sharedUserId: string) => Promise<void>;
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
        const { data: newSettings, error: insertError } = await supabase
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
      set({ loading: false, settings: null });
    }
  },

  updateSettings: async (updates) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        } as never)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        logger.error('Error updating settings', { error: error.message }, 'SettingsStore');
        throw error;
      }

      set({ settings: data as UserSettings });
      logger.info('Settings updated', { updates }, 'SettingsStore');
    } catch (error) {
      logger.error('Unexpected error updating settings', {
        error: error instanceof Error ? error.message : String(error)
      }, 'SettingsStore');
      throw error;
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

  updateReminderSettings: async (reminderSettings) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_settings')
        .update({
          reminder_email: reminderSettings.reminder_email,
          reminders_enabled: reminderSettings.reminders_enabled,
          reminder_time: reminderSettings.reminder_time,
          timezone: reminderSettings.timezone,
          updated_at: new Date().toISOString()
        } as never)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        logger.error('Error updating reminder settings', { error: error.message }, 'SettingsStore');
        throw error;
      }

      set({ settings: data as UserSettings });
      logger.info('Reminder settings updated', reminderSettings, 'SettingsStore');
    } catch (error) {
      logger.error('Unexpected error updating reminder settings', {
        error: error instanceof Error ? error.message : String(error)
      }, 'SettingsStore');
      throw error;
    }
  },

  generateInviteCode: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate a 6-digit code
      const inviteCode = Math.floor(100000 + Math.random() * 900000).toString();

      const { data, error } = await supabase
        .from('user_settings')
        .update({
          invite_code: inviteCode,
          updated_at: new Date().toISOString()
        } as never)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        logger.error('Error generating invite code', { error: error.message }, 'SettingsStore');
        throw error;
      }

      set({ settings: data as UserSettings });
      logger.info('Invite code generated', { inviteCode }, 'SettingsStore');
      return inviteCode;
    } catch (error) {
      logger.error('Unexpected error generating invite code', {
        error: error instanceof Error ? error.message : String(error)
      }, 'SettingsStore');
      throw error;
    }
  },

  joinWithCode: async (inviteCode: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      console.log('Looking for invite code:', inviteCode);

      // Find the user with this invite code
      const { data: ownerSettings, error: findError } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('invite_code', inviteCode)
        .single();

      console.log('Query result:', { ownerSettings, error: findError });

      if (findError) {
        console.error('Database error finding invite code:', findError);
        throw new Error(`Database error: ${findError.message}`);
      }

      if (!ownerSettings) {
        throw new Error('Invalid invite code - no matching user found');
      }

      const ownerUserId = (ownerSettings as { user_id: string }).user_id;

      if (ownerUserId === user.id) {
        throw new Error('You cannot join your own account');
      }

      // Create the share relationship
      const { error: shareError } = await supabase
        .from('user_shares')
        .insert({
          owner_user_id: ownerUserId,
          shared_user_id: user.id
        } as never);

      if (shareError) {
        if (shareError.code === '23505') {
          throw new Error('You are already connected to this account');
        }
        logger.error('Error creating share', { error: shareError.message }, 'SettingsStore');
        throw shareError;
      }

      logger.info('Successfully joined account', { ownerUserId }, 'SettingsStore');
    } catch (error) {
      logger.error('Unexpected error joining with code', {
        error: error instanceof Error ? error.message : String(error)
      }, 'SettingsStore');
      throw error;
    }
  },

  getSharedUsers: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get users who have joined this user's account
      const { data: shares, error } = await supabase
        .from('user_shares')
        .select('shared_user_id')
        .eq('owner_user_id', user.id);

      if (error) {
        logger.error('Error fetching shared users', { error: error.message }, 'SettingsStore');
        throw error;
      }

      // Get user details from auth.users (this requires a server-side function in production)
      // For now, just return the user IDs
      return (shares || []).map((share: { shared_user_id: string }) => ({
        user_id: share.shared_user_id,
        email: null // Would need server-side function to get email
      }));
    } catch (error) {
      logger.error('Unexpected error fetching shared users', {
        error: error instanceof Error ? error.message : String(error)
      }, 'SettingsStore');
      throw error;
    }
  },

  removeSharedUser: async (sharedUserId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_shares')
        .delete()
        .eq('owner_user_id', user.id)
        .eq('shared_user_id', sharedUserId);

      if (error) {
        logger.error('Error removing shared user', { error: error.message }, 'SettingsStore');
        throw error;
      }

      logger.info('Shared user removed', { sharedUserId }, 'SettingsStore');
    } catch (error) {
      logger.error('Unexpected error removing shared user', {
        error: error instanceof Error ? error.message : String(error)
      }, 'SettingsStore');
      throw error;
    }
  },
}));
