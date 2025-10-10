import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PhotoStatus {
  id: string;
  upload_date: string;
  status: 'pending' | 'eyes_detected' | 'aligned' | 'failed';
  eye_coordinates: any;
  aligned_url: string | null;
  created_at: string;
  processing_time_estimate?: string;
}

interface MonitoringStats {
  total_photos: number;
  pending_alignment: number;
  eyes_detected: number;
  fully_aligned: number;
  recent_uploads: PhotoStatus[];
  health_status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
}

/**
 * Monitoring endpoint for Wizard of Oz alignment pipeline
 *
 * GET /api/monitor
 *
 * Returns real-time statistics about photo processing:
 * - Total photos in database
 * - How many are waiting for alignment
 * - Recent photo statuses
 * - Health check warnings
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();

    // Fetch all photos (limit to recent 100)
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchError) {
      throw fetchError;
    }

    if (!photos || photos.length === 0) {
      return res.status(200).json({
        total_photos: 0,
        pending_alignment: 0,
        eyes_detected: 0,
        fully_aligned: 0,
        recent_uploads: [],
        health_status: 'healthy',
        issues: [],
        query_time_ms: Date.now() - startTime,
      });
    }

    // Categorize photos by status
    const photoStatuses: PhotoStatus[] = photos.map(photo => {
      let status: PhotoStatus['status'] = 'pending';

      if (photo.aligned_url) {
        status = 'aligned';
      } else if (photo.eye_coordinates) {
        status = 'eyes_detected';
      }

      // Estimate processing time for stuck photos
      const createdAt = new Date(photo.created_at);
      const ageMinutes = (Date.now() - createdAt.getTime()) / 1000 / 60;
      let processingTimeEstimate: string | undefined;

      if (status === 'eyes_detected' && ageMinutes > 2) {
        processingTimeEstimate = `stuck for ${Math.floor(ageMinutes)} minutes`;
      }

      return {
        id: photo.id,
        upload_date: photo.upload_date,
        status,
        eye_coordinates: photo.eye_coordinates,
        aligned_url: photo.aligned_url,
        created_at: photo.created_at,
        processing_time_estimate: processingTimeEstimate,
      };
    });

    // Calculate statistics
    const stats: MonitoringStats = {
      total_photos: photos.length,
      pending_alignment: photoStatuses.filter(p => p.status === 'pending' || p.status === 'eyes_detected').length,
      eyes_detected: photoStatuses.filter(p => p.status === 'eyes_detected').length,
      fully_aligned: photoStatuses.filter(p => p.status === 'aligned').length,
      recent_uploads: photoStatuses.slice(0, 10),
      health_status: 'healthy',
      issues: [],
    };

    // Health checks
    const stuckPhotos = photoStatuses.filter(p => p.processing_time_estimate);
    if (stuckPhotos.length > 0) {
      stats.health_status = 'degraded';
      stats.issues.push(`${stuckPhotos.length} photo(s) stuck in processing`);
    }

    const highPendingRate = (stats.pending_alignment / stats.total_photos) > 0.5;
    if (highPendingRate && stats.total_photos > 5) {
      stats.health_status = 'unhealthy';
      stats.issues.push(`High failure rate: ${((stats.pending_alignment / stats.total_photos) * 100).toFixed(1)}% photos not aligned`);
    }

    // Check for recent failures (photos older than 5 minutes without alignment)
    const recentFailures = photoStatuses.filter(p => {
      const ageMinutes = (Date.now() - new Date(p.created_at).getTime()) / 1000 / 60;
      return p.status === 'eyes_detected' && ageMinutes > 5;
    });

    if (recentFailures.length > 0) {
      stats.health_status = 'unhealthy';
      stats.issues.push(`${recentFailures.length} recent photo(s) failed alignment (>5min old)`);
    }

    // Check environment variables
    const missingVars: string[] = [];
    if (!process.env.VITE_SUPABASE_URL) missingVars.push('VITE_SUPABASE_URL');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!process.env.GEMINI_API_KEY) missingVars.push('GEMINI_API_KEY');

    if (missingVars.length > 0) {
      stats.health_status = 'unhealthy';
      stats.issues.push(`Missing environment variables: ${missingVars.join(', ')}`);
    }

    // Check Deployment Protection bypass
    if (!process.env.VERCEL_AUTOMATION_BYPASS_SECRET && process.env.VERCEL_ENV !== 'development') {
      stats.issues.push('⚠️ VERCEL_AUTOMATION_BYPASS_SECRET not set - internal API calls may be blocked by Deployment Protection');
      if (stats.health_status === 'healthy') {
        stats.health_status = 'degraded';
      }
    }

    return res.status(200).json({
      ...stats,
      query_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Monitor endpoint error:', error);
    return res.status(500).json({
      error: 'Failed to fetch monitoring data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
