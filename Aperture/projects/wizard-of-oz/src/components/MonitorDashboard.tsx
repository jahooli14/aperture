import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface PhotoStatus {
  id: string;
  upload_date: string;
  status: 'pending' | 'eyes_detected' | 'aligned' | 'failed';
  processing_time_estimate?: string;
}

interface MonitoringData {
  total_photos: number;
  pending_alignment: number;
  eyes_detected: number;
  fully_aligned: number;
  recent_uploads: PhotoStatus[];
  health_status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  query_time_ms: number;
  timestamp: string;
}

export function MonitorDashboard() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMonitoringData = async () => {
    try {
      const response = await fetch('/api/monitor');
      if (!response.ok) {
        throw new Error('Failed to fetch monitoring data');
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchMonitoringData, 10000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-gray-600">
          <Activity className="w-5 h-5 animate-spin" />
          <span>Loading monitoring data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Monitoring Error</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const healthColor = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    unhealthy: 'bg-red-500',
  }[data.health_status];

  const healthIcon = {
    healthy: <CheckCircle className="w-5 h-5 text-green-600" />,
    degraded: <AlertCircle className="w-5 h-5 text-yellow-600" />,
    unhealthy: <XCircle className="w-5 h-5 text-red-600" />,
  }[data.health_status];

  const statusColors = {
    pending: 'bg-gray-100 text-gray-700',
    eyes_detected: 'bg-blue-100 text-blue-700',
    aligned: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };

  const statusIcons = {
    pending: <Clock className="w-4 h-4" />,
    eyes_detected: <Activity className="w-4 h-4" />,
    aligned: <CheckCircle className="w-4 h-4" />,
    failed: <XCircle className="w-4 h-4" />,
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Wizard of Oz Monitor</h1>
        <p className="text-gray-600">Real-time alignment pipeline status</p>
      </div>

      {/* Health Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {healthIcon}
            <h2 className="text-xl font-semibold text-gray-900">
              System Health: <span className="capitalize">{data.health_status}</span>
            </h2>
          </div>
          <div className={`w-3 h-3 rounded-full ${healthColor} animate-pulse`} />
        </div>

        {data.issues.length > 0 && (
          <div className="space-y-2">
            {data.issues.map((issue, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-gray-700 bg-yellow-50 p-3 rounded">
                <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <span>{issue}</span>
              </div>
            ))}
          </div>
        )}

        {data.issues.length === 0 && (
          <p className="text-sm text-gray-600">All systems operational</p>
        )}
      </motion.div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Photos"
          value={data.total_photos}
          color="bg-blue-500"
        />
        <StatCard
          label="Fully Aligned"
          value={data.fully_aligned}
          color="bg-green-500"
        />
        <StatCard
          label="Eyes Detected"
          value={data.eyes_detected}
          color="bg-yellow-500"
        />
        <StatCard
          label="Pending"
          value={data.pending_alignment}
          color="bg-gray-500"
        />
      </div>

      {/* Recent Uploads */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Uploads</h2>

        {data.recent_uploads.length === 0 && (
          <p className="text-gray-600 text-center py-8">No photos yet</p>
        )}

        <div className="space-y-2">
          {data.recent_uploads.map(photo => (
            <div
              key={photo.id}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${statusColors[photo.status]}`}>
                  {statusIcons[photo.status]}
                  <span className="capitalize">{photo.status.replace('_', ' ')}</span>
                </div>
                <span className="text-sm text-gray-700">{photo.upload_date}</span>
              </div>

              {photo.processing_time_estimate && (
                <span className="text-xs text-red-600 font-medium">
                  ⚠️ {photo.processing_time_estimate}
                </span>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Footer */}
      <div className="mt-4 text-center text-xs text-gray-500">
        Last updated: {new Date(data.timestamp).toLocaleTimeString()} •
        Query time: {data.query_time_ms}ms •
        Auto-refreshes every 10s
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg ${color} opacity-10`} />
      </div>
    </motion.div>
  );
}
