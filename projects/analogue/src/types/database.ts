// Supabase database types
export interface Database {
  public: {
    Tables: {
      manuscripts: {
        Row: {
          id: string
          user_id: string
          title: string
          protagonist_real_name: string
          mask_mode_enabled: boolean
          current_section: string
          total_word_count: number
          reveal_audit_unlocked: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          protagonist_real_name?: string
          mask_mode_enabled?: boolean
          current_section?: string
          total_word_count?: number
          reveal_audit_unlocked?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          protagonist_real_name?: string
          mask_mode_enabled?: boolean
          current_section?: string
          total_word_count?: number
          reveal_audit_unlocked?: boolean
          updated_at?: string
        }
      }
      scene_nodes: {
        Row: {
          id: string
          manuscript_id: string
          order_index: number
          title: string
          section: string
          prose: string
          footnotes: string
          word_count: number
          identity_type: string | null
          sensory_focus: string | null
          awareness_level: string | null
          footnote_tone: string | null
          status: string
          validation_status: string
          checklist: string // JSON
          senses_activated: string[]
          pulse_check_completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          manuscript_id: string
          order_index: number
          title: string
          section?: string
          prose?: string
          footnotes?: string
          word_count?: number
          identity_type?: string | null
          sensory_focus?: string | null
          awareness_level?: string | null
          footnote_tone?: string | null
          status?: string
          validation_status?: string
          checklist?: string
          senses_activated?: string[]
          pulse_check_completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          order_index?: number
          title?: string
          section?: string
          prose?: string
          footnotes?: string
          word_count?: number
          identity_type?: string | null
          sensory_focus?: string | null
          awareness_level?: string | null
          footnote_tone?: string | null
          status?: string
          validation_status?: string
          checklist?: string
          senses_activated?: string[]
          pulse_check_completed_at?: string | null
          updated_at?: string
        }
      }
      reverberations: {
        Row: {
          id: string
          manuscript_id: string
          scene_id: string
          text: string
          speaker: string
          villager_name: string | null
          linked_reveal_scene_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          manuscript_id: string
          scene_id: string
          text: string
          speaker: string
          villager_name?: string | null
          linked_reveal_scene_id?: string | null
          created_at?: string
        }
        Update: {
          text?: string
          speaker?: string
          villager_name?: string | null
          linked_reveal_scene_id?: string | null
        }
      }
      glasses_mentions: {
        Row: {
          id: string
          manuscript_id: string
          scene_id: string
          text: string
          is_valid_draw: boolean
          flagged: boolean
          created_at: string
        }
        Insert: {
          id?: string
          manuscript_id: string
          scene_id: string
          text: string
          is_valid_draw?: boolean
          flagged?: boolean
          created_at?: string
        }
        Update: {
          text?: string
          is_valid_draw?: boolean
          flagged?: boolean
        }
      }
      speech_patterns: {
        Row: {
          id: string
          manuscript_id: string
          phrase: string
          character_source: string
          occurrences: string // JSON
          created_at: string
        }
        Insert: {
          id?: string
          manuscript_id: string
          phrase: string
          character_source: string
          occurrences?: string
          created_at?: string
        }
        Update: {
          phrase?: string
          character_source?: string
          occurrences?: string
        }
      }
    }
  }
}
