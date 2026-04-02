/**
 * BookshelfStep — Onboarding step for picking 3 books
 *
 * Type-to-search via Google Books API, shows cover art.
 * Creates a real "Books" list and adds items with completed status.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Book, ArrowRight, Loader2 } from 'lucide-react'
import { useListStore } from '../../stores/useListStore'
import type { BookSearchResult } from '../../types'

interface BookshelfStepProps {
  onComplete: (books: BookSearchResult[]) => void
  onSkip: () => void
}

export function BookshelfStep({ onComplete, onSkip }: BookshelfStepProps) {
  const [selectedBooks, setSelectedBooks] = useState<BookSearchResult[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [listId, setListId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const { createList, addListItem, lists } = useListStore()

  // Find or create the Books list
  useEffect(() => {
    const existing = lists.find(l => l.type === 'book')
    if (existing) {
      setListId(existing.id)
    }
  }, [lists])

  const searchBooks = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }

    setSearching(true)
    try {
      const res = await fetch(`/api/utilities?resource=book-search&q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setResults(data.results || [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchBooks(value), 300)
  }

  const handleSelectBook = async (book: BookSearchResult) => {
    if (selectedBooks.length >= 3) return
    if (selectedBooks.some(b => b.title === book.title && b.author === book.author)) return

    const updated = [...selectedBooks, book]
    setSelectedBooks(updated)
    setQuery('')
    setResults([])
    inputRef.current?.focus()

    // Persist: create list if needed, then add item
    try {
      let currentListId = listId
      if (!currentListId) {
        currentListId = await createList({ title: 'Books', type: 'book' })
        setListId(currentListId)
      }

      await addListItem({
        list_id: currentListId,
        content: `${book.title} — ${book.author}`,
        status: 'completed',
      })
    } catch (e) {
      console.warn('[BookshelfStep] Failed to persist book, continuing', e)
    }
  }

  const handleRemoveBook = (index: number) => {
    setSelectedBooks(prev => prev.filter((_, i) => i !== index))
  }

  const handleContinue = async () => {
    setSaving(true)
    // Small delay for the animation to feel intentional
    await new Promise(r => setTimeout(r, 300))
    onComplete(selectedBooks)
  }

  const isFull = selectedBooks.length >= 3

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative">
      {/* Skip */}
      <button
        onClick={onSkip}
        className="absolute top-6 right-6 text-xs transition-opacity hover:opacity-80"
        style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}
      >
        Skip
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-xl w-full"
      >
        {/* Counter */}
        {selectedBooks.length > 0 && (
          <p
            className="text-xs font-medium mb-6 uppercase tracking-widest text-center"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
          >
            {selectedBooks.length} picked
          </p>
        )}
        {selectedBooks.length === 0 && <div className="mb-6" />}

        {/* Heading */}
        <h2
          className="text-2xl sm:text-3xl font-semibold leading-snug mb-8 text-center"
          style={{ color: 'var(--brand-text-primary)' }}
        >
          Three books that stuck with you.
        </h2>

        {/* 3 Book Slots */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[0, 1, 2].map((slot) => {
            const book = selectedBooks[slot]
            return (
              <motion.div
                key={slot}
                layout
                className="relative aspect-[2/3] rounded-xl overflow-hidden"
                style={{
                  background: book ? undefined : 'var(--brand-glass-bg)',
                  border: book ? 'none' : '2px dashed rgba(255,255,255,0.1)',
                }}
              >
                {book ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
                    className="w-full h-full relative"
                  >
                    {book.thumbnail ? (
                      <img
                        src={book.thumbnail}
                        alt={book.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: 'rgba(99,179,237,0.12)' }}
                      >
                        <Book className="h-8 w-8" style={{ color: 'var(--brand-primary)', opacity: 0.5 }} />
                      </div>
                    )}
                    {/* Title overlay */}
                    <div
                      className="absolute bottom-0 left-0 right-0 p-2"
                      style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}
                    >
                      <p className="text-xs font-medium leading-tight line-clamp-2" style={{ color: '#fff' }}>
                        {book.title}
                      </p>
                      <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {book.author}
                      </p>
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveBook(slot)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.6)' }}
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </motion.div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Book
                      className="h-6 w-6"
                      style={{ color: 'var(--brand-text-secondary)', opacity: 0.15 }}
                    />
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Search Input */}
        {!isFull && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative mb-4"
          >
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search for a book..."
              autoFocus
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--brand-glass-bg)',
                backdropFilter: 'blur(12px)',
                color: 'var(--brand-text-primary)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />
            {searching && (
              <Loader2
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin"
                style={{ color: 'var(--brand-primary)' }}
              />
            )}
          </motion.div>
        )}

        {/* Search Results Dropdown */}
        <AnimatePresence>
          {results.length > 0 && !isFull && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="rounded-xl overflow-hidden mb-6"
              style={{
                background: 'var(--brand-glass-bg)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {results.map((book, i) => (
                <button
                  key={`${book.title}-${i}`}
                  onClick={() => handleSelectBook(book)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  style={{ borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined }}
                >
                  {book.thumbnail ? (
                    <img
                      src={book.thumbnail}
                      alt=""
                      className="w-8 h-12 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-8 h-12 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(99,179,237,0.12)' }}
                    >
                      <Book className="h-4 w-4" style={{ color: 'var(--brand-primary)', opacity: 0.5 }} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--brand-text-primary)' }}>
                      {book.title}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}>
                      {book.author}
                    </p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Continue button — appears when 3 books selected */}
        <AnimatePresence>
          {isFull && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="text-center"
            >
              <button
                onClick={handleContinue}
                disabled={saving}
                className="btn-primary px-8 py-3.5 text-base font-semibold inline-flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'See what we found'}
                {!saving && <ArrowRight className="h-4 w-4" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
