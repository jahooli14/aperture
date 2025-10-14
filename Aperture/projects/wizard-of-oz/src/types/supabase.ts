/**
 * Manual type definitions to avoid Supabase generated type issues
 */

import type { Database } from './database';

// Photo insert type (what we send to Supabase)
export type PhotoInsert = {
  user_id: string;
  upload_date: string;
  original_url: string;
  aligned_url?: string | null;
  eye_coordinates?: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    confidence: number;
    imageWidth: number;
    imageHeight: number;
  } | null;
};

// Photo row type (what we get from Supabase)
export type PhotoRow = Database['public']['Tables']['photos']['Row'];

// Helper type for insert operations
export type InsertResult<T> = {
  data: T | null;
  error: Error | null;
};
