import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type MilestoneAchievement = Database['public']['Tables']['milestone_achievements']['Row'];
type MilestoneAchievementUpdate = Database['public']['Tables']['milestone_achievements']['Update'];

// Input type for adding achievements (user_id is added automatically)
type AddAchievementInput = {
  milestone_id: string;
  achieved_date: string;
  photo_id?: string | null;
  notes?: string | null;
};

interface MilestoneStore {
  achievements: MilestoneAchievement[];
  loading: boolean;
  error: string | null;
  fetchAchievements: () => Promise<void>;
  addAchievement: (achievement: AddAchievementInput) => Promise<MilestoneAchievement>;
  updateAchievement: (id: string, updates: MilestoneAchievementUpdate) => Promise<void>;
  deleteAchievement: (id: string) => Promise<void>;
  isAchieved: (milestoneId: string) => boolean;
  getAchievement: (milestoneId: string) => MilestoneAchievement | undefined;
  getAchievementsByPhoto: (photoId: string) => MilestoneAchievement[];
}

export const useMilestoneStore = create<MilestoneStore>((set, get) => ({
  achievements: [],
  loading: false,
  error: null,

  fetchAchievements: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('milestone_achievements')
        .select('*')
        .order('achieved_date', { ascending: false });

      if (error) {
        console.error('Supabase error fetching achievements:', error);

        // Check if it's a missing table error
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          const helpfulError = 'The milestone_achievements table has not been created yet. Please run the migration in your Supabase SQL Editor. See the console for details.';
          console.error('❌ MIGRATION NEEDED:');
          console.error('Go to: https://supabase.com/dashboard/project/_/sql/new');
          console.error('Copy and run: supabase/migrations/006_add_milestone_tracking.sql');
          throw new Error(helpfulError);
        }

        throw error;
      }

      set({ achievements: (data || []) as MilestoneAchievement[], loading: false });
    } catch (error) {
      console.error('Error fetching milestone achievements:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch achievements',
        loading: false,
      });
    }
  },

  addAchievement: async (achievement: AddAchievementInput) => {
    set({ error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      console.log('Adding milestone achievement:', { achievement, user_id: user.id });

      const insertData: Database['public']['Tables']['milestone_achievements']['Insert'] = {
        ...achievement,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('milestone_achievements')
        .insert(insertData as any)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);

        // Check if it's a missing table error
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          const helpfulError = 'The milestone_achievements table has not been created yet. Please run the migration in your Supabase SQL Editor. See the console for details.';
          console.error('❌ MIGRATION NEEDED:');
          console.error('Go to: https://supabase.com/dashboard/project/_/sql/new');
          console.error('Copy and run: supabase/migrations/006_add_milestone_tracking.sql');
          throw new Error(helpfulError);
        }

        throw error;
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('Milestone achievement added successfully:', data);

      set((state) => ({
        achievements: [data as MilestoneAchievement, ...state.achievements],
      }));

      return data as MilestoneAchievement;
    } catch (error) {
      console.error('Error adding milestone achievement:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add achievement';
      set({ error: errorMessage });
      throw error;
    }
  },

  updateAchievement: async (id: string, updates: MilestoneAchievementUpdate) => {
    set({ error: null });
    try {
      const { error } = await (supabase as any)
        .from('milestone_achievements')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('Supabase error updating achievement:', error);
        throw error;
      }

      set((state) => ({
        achievements: state.achievements.map((achievement) =>
          achievement.id === id ? { ...achievement, ...updates } : achievement
        ),
      }));
    } catch (error) {
      console.error('Error updating milestone achievement:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update achievement';
      set({ error: errorMessage });
      throw error;
    }
  },

  deleteAchievement: async (id: string) => {
    set({ error: null });
    try {
      const { error } = await supabase
        .from('milestone_achievements')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase error deleting achievement:', error);
        throw error;
      }

      set((state) => ({
        achievements: state.achievements.filter((achievement) => achievement.id !== id),
      }));
    } catch (error) {
      console.error('Error deleting milestone achievement:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete achievement';
      set({ error: errorMessage });
      throw error;
    }
  },

  isAchieved: (milestoneId: string) => {
    return get().achievements.some((achievement) => achievement.milestone_id === milestoneId);
  },

  getAchievement: (milestoneId: string) => {
    return get().achievements.find((achievement) => achievement.milestone_id === milestoneId);
  },

  getAchievementsByPhoto: (photoId: string) => {
    return get().achievements.filter((achievement) => achievement.photo_id === photoId);
  },
}));
