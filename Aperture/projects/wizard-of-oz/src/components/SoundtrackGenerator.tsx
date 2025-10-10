import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Sparkles, Download, Play, Pause, Volume2 } from 'lucide-react';

interface MusicMood {
  emotion: string;
  energy: number;
  musicStyle: string;
  instruments: string[];
  tempo: string;
  description: string;
}

interface PhotoAnalysis {
  photoId: string;
  timestamp: string;
  mood: MusicMood;
}

interface SoundtrackSegment {
  timestamp: string;
  duration: number;
  musicPrompt: string;
  emotion: string;
  narration?: string;
}

export function SoundtrackGenerator({ photoIds }: { photoIds: string[] }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analyses, setAnalyses] = useState<PhotoAnalysis[]>([]);
  const [soundtrack, setSoundtrack] = useState<{
    segments: SoundtrackSegment[];
    totalDuration: number;
    hasNarration: boolean;
  } | null>(null);
  const [includeNarration, setIncludeNarration] = useState(true);
  const [narratorStyle, setNarratorStyle] = useState('warm parent');

  const analyzeMoods = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch('/api/analyze-music-mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      setAnalyses(data.analyses);
    } catch (error) {
      console.error('Failed to analyze moods:', error);
      alert('Failed to analyze photo moods. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const generateSoundtrack = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/generate-timelapse-soundtrack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds,
          includeNarration,
          narratorStyle,
          segmentDuration: 3,
        }),
      });

      if (!response.ok) throw new Error('Soundtrack generation failed');

      const data = await response.json();
      setSoundtrack(data.soundtrack);
    } catch (error) {
      console.error('Failed to generate soundtrack:', error);
      alert('Failed to generate soundtrack. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const emotionColors: Record<string, string> = {
    peaceful: 'bg-blue-100 text-blue-700',
    joyful: 'bg-yellow-100 text-yellow-700',
    playful: 'bg-pink-100 text-pink-700',
    curious: 'bg-purple-100 text-purple-700',
    sleepy: 'bg-indigo-100 text-indigo-700',
    excited: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Music className="w-8 h-8 text-purple-600" />
          <h2 className="text-3xl font-bold text-gray-900">
            AI Soundtrack Generator
          </h2>
          <Sparkles className="w-6 h-6 text-purple-600" />
        </div>
        <p className="text-gray-600">
          Create emotionally intelligent music for your baby's timelapse ({photoIds.length} photos)
        </p>
      </div>

      {/* Step 1: Analyze Moods */}
      {analyses.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Step 1: Analyze Photo Emotions
          </h3>
          <p className="text-gray-600 mb-4">
            AI will analyze each photo to understand baby's emotional state and determine
            the perfect music mood.
          </p>
          <button
            onClick={analyzeMoods}
            disabled={analyzing}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analyzing emotions...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Analyze Photo Moods
              </>
            )}
          </button>
        </motion.div>
      )}

      {/* Mood Analysis Results */}
      {analyses.length > 0 && !soundtrack && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            ✅ Emotional Analysis Complete
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {analyses.slice(0, 6).map((analysis, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  emotionColors[analysis.mood.emotion] || 'bg-gray-100 text-gray-700'
                }`}
              >
                <div className="font-semibold capitalize">{analysis.mood.emotion}</div>
                <div className="text-sm opacity-75">
                  Energy: {analysis.mood.energy}/10
                </div>
                <div className="text-xs opacity-60 mt-1">{analysis.mood.tempo}</div>
              </div>
            ))}
          </div>

          {analyses.length > 6 && (
            <p className="text-sm text-gray-500 mb-4">
              + {analyses.length - 6} more photos analyzed
            </p>
          )}

          <div className="border-t border-gray-200 pt-4 mt-4">
            <h4 className="font-semibold text-gray-900 mb-3">Step 2: Soundtrack Options</h4>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={includeNarration}
                onChange={(e) => setIncludeNarration(e.target.checked)}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className="text-gray-700">Include AI voice narration</span>
            </label>

            {includeNarration && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Narrator Style
                </label>
                <select
                  value={narratorStyle}
                  onChange={(e) => setNarratorStyle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="warm parent">Warm Parent</option>
                  <option value="gentle grandparent">Gentle Grandparent</option>
                  <option value="cheerful narrator">Cheerful Narrator</option>
                  <option value="soothing lullaby voice">Soothing Lullaby Voice</option>
                  <option value="nature documentary (David Attenborough)">
                    Nature Documentary
                  </option>
                </select>
              </div>
            )}

            <button
              onClick={generateSoundtrack}
              disabled={generating}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating soundtrack...
                </>
              ) : (
                <>
                  <Music className="w-5 h-5" />
                  Generate Soundtrack
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Soundtrack Results */}
      {soundtrack && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            🎵 Your Personalized Soundtrack
          </h3>

          <div className="mb-6 p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-purple-900">
                Total Duration: {soundtrack.totalDuration}s
              </span>
              <span className="text-sm text-purple-700">
                {soundtrack.segments.length} segments
              </span>
            </div>
            {soundtrack.hasNarration && (
              <div className="text-sm text-purple-700">
                ✨ Includes AI-generated voice narration
              </div>
            )}
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {soundtrack.segments.map((segment, idx) => (
              <div
                key={idx}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-gray-900">
                      Segment {idx + 1}
                    </div>
                    <div className="text-sm text-gray-600">{segment.timestamp}</div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      emotionColors[segment.emotion] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {segment.emotion}
                  </span>
                </div>

                <div className="text-sm text-gray-700 mb-2">
                  <strong>Music:</strong> {segment.musicPrompt}
                </div>

                {segment.narration && (
                  <div className="mt-2 p-2 bg-purple-50 rounded text-sm text-purple-900">
                    <Volume2 className="w-4 h-4 inline mr-1" />
                    <strong>Narration:</strong> {segment.narration}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3">Next Steps</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                ✅ <strong>Music Generation:</strong> Use the music prompts above with AI
                music APIs like Suno AI, Beatoven, or Ecrett Music
              </p>
              {soundtrack.hasNarration && (
                <p>
                  🎙️ <strong>Voice Narration:</strong> Generate voice using Gemini 2.5 TTS
                  or ElevenLabs with emotion tags
                </p>
              )}
              <p>
                🎬 <strong>Video Creation:</strong> Layer music + narration over your
                timelapse with 2s crossfade transitions
              </p>
            </div>

            <button className="mt-4 flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Download className="w-5 h-5" />
              Export Soundtrack Plan (JSON)
            </button>
          </div>
        </motion.div>
      )}

      {/* Preview Instructions */}
      {!analyses.length && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2">How It Works</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>AI analyzes each photo's emotional mood and energy level</li>
            <li>Generates music style, tempo, and instrument suggestions</li>
            <li>Creates seamless transitions between emotional moments</li>
            <li>
              Optionally adds AI-generated voice narration with emotion tags
            </li>
            <li>Exports complete soundtrack plan for music generation APIs</li>
          </ol>
        </div>
      )}
    </div>
  );
}
