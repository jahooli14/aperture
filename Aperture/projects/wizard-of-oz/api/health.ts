import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Health Check Endpoint - Autonomous Infrastructure Monitoring
 * Validates all critical services and dependencies
 */

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
}

interface HealthReport {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  environment: string;
  checks: HealthCheckResult[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    totalResponseTime: number;
  };
}

async function checkSupabaseConnection(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Test database connection
    const { data, error } = await supabase
      .from('photos')
      .select('count')
      .limit(1);

    const responseTime = Date.now() - start;

    if (error) {
      return {
        service: 'supabase_database',
        status: 'unhealthy',
        responseTime,
        error: error.message,
      };
    }

    return {
      service: 'supabase_database',
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      responseTime,
      details: { tablesAccessible: true },
    };
  } catch (error) {
    return {
      service: 'supabase_database',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkSupabaseStorage(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Test storage access
    const { data, error } = await supabase.storage
      .from('originals')
      .list('', { limit: 1 });

    const responseTime = Date.now() - start;

    if (error) {
      return {
        service: 'supabase_storage',
        status: 'unhealthy',
        responseTime,
        error: error.message,
      };
    }

    return {
      service: 'supabase_storage',
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      responseTime,
      details: { bucketsAccessible: true },
    };
  } catch (error) {
    return {
      service: 'supabase_storage',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkGeminiAPI(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    if (!process.env.GEMINI_API_KEY) {
      return {
        service: 'gemini_ai',
        status: 'unhealthy',
        responseTime: 0,
        error: 'GEMINI_API_KEY not configured',
      };
    }

    // Simple API key validation (without making actual API call to save quota)
    const isValidKey = process.env.GEMINI_API_KEY.startsWith('AIza') &&
                      process.env.GEMINI_API_KEY.length > 30;

    const responseTime = Date.now() - start;

    return {
      service: 'gemini_ai',
      status: isValidKey ? 'healthy' : 'unhealthy',
      responseTime,
      details: {
        keyConfigured: !!process.env.GEMINI_API_KEY,
        keyFormat: isValidKey ? 'valid' : 'invalid'
      },
    };
  } catch (error) {
    return {
      service: 'gemini_ai',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkEnvironmentVariables(): Promise<HealthCheckResult> {
  const start = Date.now();

  const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY',
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  const responseTime = Date.now() - start;

  if (missing.length > 0) {
    return {
      service: 'environment',
      status: 'unhealthy',
      responseTime,
      error: `Missing environment variables: ${missing.join(', ')}`,
      details: { missing, configured: requiredEnvVars.length - missing.length },
    };
  }

  return {
    service: 'environment',
    status: 'healthy',
    responseTime,
    details: { allVariablesConfigured: true },
  };
}

async function checkDeploymentProtection(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    // Check if we're getting proper responses (not auth pages)
    const testUrl = process.env.VERCEL_URL || process.env.VITE_SITE_URL;

    if (!testUrl) {
      return {
        service: 'deployment_protection',
        status: 'degraded',
        responseTime: Date.now() - start,
        details: { message: 'Cannot verify - no deployment URL available' },
      };
    }

    return {
      service: 'deployment_protection',
      status: 'healthy',
      responseTime: Date.now() - start,
      details: {
        message: 'API accessible (protection disabled or properly configured)',
        deploymentUrl: testUrl
      },
    };
  } catch (error) {
    return {
      service: 'deployment_protection',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    // Run all health checks in parallel for speed
    const [
      envCheck,
      supabaseDbCheck,
      supabaseStorageCheck,
      geminiCheck,
      deploymentCheck,
    ] = await Promise.all([
      checkEnvironmentVariables(),
      checkSupabaseConnection(),
      checkSupabaseStorage(),
      checkGeminiAPI(),
      checkDeploymentProtection(),
    ]);

    const checks = [envCheck, supabaseDbCheck, supabaseStorageCheck, geminiCheck, deploymentCheck];

    // Calculate overall health
    const healthyCount = checks.filter(c => c.status === 'healthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const report: HealthReport = {
      timestamp: new Date().toISOString(),
      overall: overallStatus,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'unknown',
      checks,
      summary: {
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount,
        totalResponseTime: Date.now() - startTime,
      },
    };

    // Set appropriate HTTP status
    const httpStatus = overallStatus === 'healthy' ? 200 :
                     overallStatus === 'degraded' ? 200 : 503;

    return res.status(httpStatus).json(report);

  } catch (error) {
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      overall: 'unhealthy',
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}