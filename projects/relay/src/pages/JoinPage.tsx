import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { PageHeader } from '../components/PageHeader'

export default function JoinPage() {
  const { code: codeFromUrl } = useParams()
  const navigate = useNavigate()
  const [code, setCode] = useState((codeFromUrl ?? '').toUpperCase())
  const [preview, setPreview] = useState<{ title: string; writers: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // A shared link should show what you're walking into before you commit.
  useEffect(() => {
    if (!codeFromUrl) return
    api
      .previewInvite(codeFromUrl)
      .then(({ story, writers }) => setPreview({ title: story.title, writers }))
      .catch((e) => setError(e instanceof Error ? e.message : 'That code is not valid'))
  }, [codeFromUrl])

  async function join(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { story_id } = await api.joinStory(code)
      navigate(`/story/${story_id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join that story')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh">
      <PageHeader title="Join a story" back="/" />
      <main className="mx-auto max-w-reading px-4 py-5">
        {preview && (
          <div className="surface mb-4 p-5">
            <h2 className="font-story text-xl">{preview.title}</h2>
            <p className="mt-1 text-sm text-muted">
              Written by {preview.writers.join(', ')}.
            </p>
          </div>
        )}

        <form onSubmit={join} className="surface p-5">
          <label className="label" htmlFor="code">
            Invite code
          </label>
          <input
            id="code"
            className="field text-center font-mono text-lg tracking-[0.3em]"
            required
            maxLength={12}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="XXXXXXXX"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s/g, ''))}
          />
          {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
          <button type="submit" className="btn-primary mt-4 w-full" disabled={busy || code.length < 6}>
            {busy ? 'Joining…' : 'Join'}
          </button>
        </form>
      </main>
    </div>
  )
}
