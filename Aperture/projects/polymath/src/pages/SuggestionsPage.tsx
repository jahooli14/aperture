/**
 * Suggestions Page - Stunning Visual Design
 */

import { useEffect } from 'react'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { SuggestionCard } from '../components/suggestions/SuggestionCard'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Select } from '../components/ui/select'
import { Label } from '../components/ui/label'
import { Sparkles } from 'lucide-react'

export function SuggestionsPage() {
  const {
    suggestions,
    loading,
    error,
    filter,
    sortBy,
    fetchSuggestions,
    rateSuggestion,
    buildSuggestion,
    setFilter,
    setSortBy
  } = useSuggestionStore()

  useEffect(() => {
    fetchSuggestions()
  }, [])

  const handleRate = async (id: string, rating: number) => {
    await rateSuggestion(id, rating)
  }

  const handleBuild = async (id: string) => {
    if (confirm('Build this project? This will create a new project and boost related capabilities.')) {
      await buildSuggestion(id)
    }
  }

  const handleViewDetail = (id: string) => {
    console.log('View detail:', id)
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stunning Header */}
        <div className="text-center mb-12 relative">
          <div className="inline-block mb-4">
            <div className="relative">
              <Sparkles className="h-16 w-16 text-purple-600 mx-auto mb-4 float-animation" />
              <div className="absolute inset-0 bg-purple-600/20 blur-2xl" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 gradient-text">
            Project Suggestions
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-generated ideas combining your capabilities and interests
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 backdrop-blur-xl bg-white/60 rounded-2xl p-6 border border-white/20 shadow-xl">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'pending', label: 'New' },
              { key: 'spark', label: '⚡ Sparks' },
              { key: 'saved', label: '💾 Saved' },
              { key: 'built', label: '✅ Built' },
              { key: 'all', label: 'All' }
            ].map(({ key, label }) => (
              <Button
                key={key}
                variant={filter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(key as typeof filter)}
                className={filter === key ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg' : 'hover:scale-105 transition-transform'}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-white/80 rounded-xl px-4 py-2 border border-white/40 shadow-sm">
            <Label htmlFor="sort" className="text-sm font-semibold whitespace-nowrap text-gray-700">
              Sort by:
            </Label>
            <Select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
            >
              <option value="points">Points</option>
              <option value="recent">Recent</option>
              <option value="rating">Rating</option>
            </Select>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <Card className="mb-6 border-red-300 bg-gradient-to-r from-red-50 to-pink-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-600 font-semibold">❌ {error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading ? (
          <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl">
            <CardContent className="py-24">
              <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent mb-4"></div>
                <p className="text-lg text-gray-600">Loading suggestions...</p>
              </div>
            </CardContent>
          </Card>
        ) : suggestions.length === 0 ? (
          /* Empty State */
          <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl">
            <CardContent className="py-24">
              <div className="text-center space-y-6">
                <div className="relative inline-block">
                  <Sparkles className="h-20 w-20 text-purple-600 mx-auto float-animation" />
                  <div className="absolute inset-0 bg-purple-600/20 blur-2xl" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">No suggestions yet</h3>
                <div className="space-y-4 max-w-lg mx-auto">
                  <p className="text-gray-600">
                    Run the synthesis script to generate project ideas:
                  </p>
                  <code className="block px-6 py-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl text-sm font-mono text-purple-800 border border-purple-200 shadow-sm">
                    npx tsx scripts/polymath/synthesis.ts
                  </code>
                  <p className="text-gray-600">Or seed test data:</p>
                  <code className="block px-6 py-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl text-sm font-mono text-purple-800 border border-purple-200 shadow-sm">
                    npx tsx scripts/polymath/seed-test-data.ts
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Suggestions Grid */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onRate={handleRate}
                onBuild={handleBuild}
                onViewDetail={handleViewDetail}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
