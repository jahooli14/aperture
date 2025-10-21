/**
 * Suggestions Page
 * Shows AI-generated project suggestions with rating actions
 */

import { useEffect } from 'react'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { SuggestionCard } from '../components/suggestions/SuggestionCard'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Select } from '../components/ui/select'
import { Label } from '../components/ui/label'

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
    // TODO: Open modal or navigate to detail page
    console.log('View detail:', id)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Project Suggestions</h1>
        <p className="text-muted-foreground mt-2">
          AI-generated ideas combining your capabilities and interests
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            New
          </Button>
          <Button
            variant={filter === 'spark' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('spark')}
          >
            ⚡ Sparks
          </Button>
          <Button
            variant={filter === 'saved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('saved')}
          >
            💾 Saved
          </Button>
          <Button
            variant={filter === 'built' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('built')}
          >
            ✅ Built
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="sort" className="text-sm whitespace-nowrap">
            Sort by:
          </Label>
          <Select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-32"
          >
            <option value="points">Points</option>
            <option value="recent">Recent</option>
            <option value="rating">Rating</option>
          </Select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">❌ {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center text-muted-foreground">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] mb-4"></div>
              <p>Loading suggestions...</p>
            </div>
          </CardContent>
        </Card>
      ) : suggestions.length === 0 ? (
        /* Empty State */
        <Card>
          <CardContent className="py-16">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold">No suggestions yet</h3>
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Run the synthesis script to generate project ideas:
                </p>
                <code className="block px-4 py-2 bg-muted rounded-md text-sm font-mono">
                  npx tsx scripts/polymath/synthesis.ts
                </code>
                <p className="text-muted-foreground">Or seed test data:</p>
                <code className="block px-4 py-2 bg-muted rounded-md text-sm font-mono">
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
  )
}
