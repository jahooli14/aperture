import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase.js';
import { MODELS } from './models.js';
import type { Idea } from './types.js';

/**
 * Deduplication using pgvector similarity search
 * Threshold: 0.88 cosine similarity = ~duplicate
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function getGenAI() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  return new GoogleGenerativeAI(GEMINI_API_KEY);
}

export interface DuplicateCheck {
  isDuplicate: boolean;
  similarIdeas: Array<{
    id: string;
    title: string;
    similarity: number;
  }>;
}

/**
 * Check if an idea is a duplicate using vector similarity
 */
export async function checkDuplicate(
  userId: string,
  embedding: number[],
  similarityThreshold: number = 0.88
): Promise<DuplicateCheck> {
  // Call the match_ie_ideas function (defined in SQL migration)
  const { data, error } = await supabase.rpc('match_ie_ideas', {
    query_embedding: embedding,
    match_threshold: similarityThreshold,
    match_count: 5,
    filter_user_id: userId,
  });

  if (error) {
    console.error('Error checking duplicates:', error);
    return {
      isDuplicate: false,
      similarIdeas: [],
    };
  }

  const matches = data || [];

  return {
    isDuplicate: matches.length > 0 && matches[0].similarity >= similarityThreshold,
    similarIdeas: matches.map((m: any) => ({
      id: m.id,
      title: m.title,
      similarity: m.similarity,
    })),
  };
}

/**
 * Generate embedding using Google's gemini-embedding-001 model
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = getGenAI().getGenerativeModel({ model: MODELS.EMBEDDING });

  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    outputDimensionality: 768,
  });
  return result.embedding.values;
}

/**
 * Generate embedding for idea text
 */
export async function generateIdeaEmbedding(idea: {
  title: string;
  description: string;
  reasoning?: string;
}): Promise<number[]> {
  const text = [idea.title, idea.description, idea.reasoning || '']
    .filter(Boolean)
    .join(' ');

  return generateEmbedding(text);
}

/**
 * Store idea with embedding and check for duplicates
 */
export async function storeIdeaWithDedupe(
  userId: string,
  ideaData: Omit<Idea, 'id' | 'user_id' | 'created_at' | 'embedding'>,
  embedding: number[]
): Promise<{ success: boolean; idea?: Idea; duplicate?: boolean; message?: string }> {
  // Check for duplicates
  const dupeCheck = await checkDuplicate(userId, embedding);

  if (dupeCheck.isDuplicate) {
    console.log(
      `Duplicate detected: ${ideaData.title} similar to ${dupeCheck.similarIdeas[0].title}`
    );
    return {
      success: false,
      duplicate: true,
      message: `Duplicate of: ${dupeCheck.similarIdeas[0].title}`,
    };
  }

  // Store idea
  const { data, error } = await supabase
    .from('ie_ideas')
    .insert({
      user_id: userId,
      ...ideaData,
      embedding,
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing idea:', error);
    return {
      success: false,
      message: error.message,
    };
  }

  return {
    success: true,
    idea: data as Idea,
  };
}
