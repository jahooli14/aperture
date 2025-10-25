export interface Database {
  public: {
    Tables: {
      photos: {
        Row: {
          id: string;
          user_id: string;
          upload_date: string;
          original_url: string;
          aligned_url: string | null;
          eye_coordinates: {
            leftEye: { x: number; y: number };
            rightEye: { x: number; y: number };
            confidence: number;
            imageWidth: number;
            imageHeight: number;
            eyesOpen?: boolean;
          } | null;
          alignment_transform: {
            translateX: number;
            translateY: number;
            rotation: number;
            scale: number;
          } | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
          // Client-side only: signed URLs (not stored in DB)
          signed_original_url?: string;
          signed_aligned_url?: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          upload_date: string;
          original_url: string;
          aligned_url?: string | null;
          eye_coordinates?: Database['public']['Tables']['photos']['Row']['eye_coordinates'];
          alignment_transform?: Database['public']['Tables']['photos']['Row']['alignment_transform'];
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          upload_date?: string;
          original_url?: string;
          aligned_url?: string | null;
          eye_coordinates?: Database['public']['Tables']['photos']['Row']['eye_coordinates'];
          alignment_transform?: Database['public']['Tables']['photos']['Row']['alignment_transform'];
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
      user_settings: {
        Row: {
          user_id: string;
          target_eye_position: { x: number; y: number };
          reminder_time: string | null;
          timezone: string;
          baby_birthdate: string | null; // YYYY-MM-DD format
          reminder_email: string | null;
          reminders_enabled: boolean;
          push_subscription: Record<string, unknown> | null;
          invite_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          target_eye_position?: { x: number; y: number };
          reminder_time?: string | null;
          timezone?: string;
          baby_birthdate?: string | null;
          reminder_email?: string | null;
          reminders_enabled?: boolean;
          push_subscription?: Record<string, unknown> | null;
          invite_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          target_eye_position?: { x: number; y: number };
          reminder_time?: string | null;
          timezone?: string;
          baby_birthdate?: string | null;
          reminder_email?: string | null;
          reminders_enabled?: boolean;
          push_subscription?: Record<string, unknown> | null;
          invite_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_shares: {
        Row: {
          id: string;
          owner_user_id: string;
          shared_user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          shared_user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          shared_user_id?: string;
          created_at?: string;
        };
      };
      milestone_achievements: {
        Row: {
          id: string;
          user_id: string;
          milestone_id: string; // References milestone.id from data/milestones.ts
          achieved_date: string; // YYYY-MM-DD format
          photo_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          milestone_id: string;
          achieved_date: string;
          photo_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          milestone_id?: string;
          achieved_date?: string;
          photo_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
