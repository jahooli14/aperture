import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Idea } from '../lib/types';

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'approved' | 'spark' | 'pending'>('approved');

  useEffect(() => {
    loadIdeas();
  }, [filter]);

  async function loadIdeas() {
    setLoading(true);

    const userId = import.meta.env.VITE_IDEA_ENGINE_USER_ID || 'default-user';

    let query = supabase
      .from('ie_ideas')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading ideas:', error);
    } else {
      setIdeas(data || []);
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Idea Engine
          </h1>
          <p className="text-gray-600">
            Evolutionary frontier exploration across knowledge domains
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {(['all', 'approved', 'spark', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Ideas List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading ideas...</div>
        ) : ideas.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No {filter !== 'all' ? filter : ''} ideas yet.
          </div>
        ) : (
          <div className="space-y-6">
            {ideas.map((idea) => (
              <div
                key={idea.id}
                className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-xl font-semibold text-gray-900 flex-1">
                    {idea.title}
                  </h2>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      idea.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : idea.status === 'spark'
                        ? 'bg-yellow-100 text-yellow-800'
                        : idea.status === 'pending'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {idea.status}
                  </span>
                </div>

                {/* Metadata */}
                <div className="flex gap-4 text-sm text-gray-600 mb-4">
                  <span>
                    <strong>Domains:</strong> {idea.domain_pair.join(' × ')}
                  </span>
                  <span>
                    <strong>Mode:</strong> {idea.frontier_mode}
                  </span>
                  {idea.prefilter_score && (
                    <span>
                      <strong>Score:</strong> {(idea.prefilter_score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-gray-700 mb-4">{idea.description}</p>

                {/* Reasoning */}
                {idea.reasoning && (
                  <div className="bg-gray-50 rounded p-4 mb-4">
                    <p className="text-sm text-gray-700">
                      <strong>Reasoning:</strong> {idea.reasoning}
                    </p>
                  </div>
                )}

                {/* Opus Verdict (if reviewed) */}
                {idea.opus_verdict && (
                  <div className="bg-blue-50 rounded p-4 mb-4">
                    <p className="text-sm text-blue-900">
                      <strong>Opus Review:</strong> {idea.opus_verdict}
                    </p>
                  </div>
                )}

                {/* Rejection (if rejected) */}
                {idea.status === 'rejected' && idea.rejection_reason && (
                  <div className="bg-red-50 rounded p-4">
                    <p className="text-sm text-red-900">
                      <strong>Rejection:</strong> {idea.rejection_reason}
                    </p>
                    {idea.rejection_category && (
                      <p className="text-xs text-red-700 mt-1">
                        Category: {idea.rejection_category}
                      </p>
                    )}
                  </div>
                )}

                {/* Scores */}
                {(idea.novelty_score || idea.cross_domain_distance || idea.tractability_score) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex gap-6 text-sm text-gray-600">
                      {idea.novelty_score !== null && (
                        <div>
                          <span className="font-medium">Novelty:</span>{' '}
                          <span className="text-gray-900">{idea.novelty_score.toFixed(2)}</span>
                        </div>
                      )}
                      {idea.cross_domain_distance !== null && (
                        <div>
                          <span className="font-medium">Distance:</span>{' '}
                          <span className="text-gray-900">{idea.cross_domain_distance.toFixed(2)}</span>
                        </div>
                      )}
                      {idea.tractability_score !== null && (
                        <div>
                          <span className="font-medium">Tractability:</span>{' '}
                          <span className="text-gray-900">{idea.tractability_score.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <div className="mt-4 text-xs text-gray-500">
                  Created {new Date(idea.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
