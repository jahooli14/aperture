/**
 * Made-up data so every page renders with no login and no database.
 * Keyed by the API path (`projects`, `memories`) or `utilities?resource=today`.
 * Anything not listed answers `{}`; add a fixture when a page looks empty
 * for the wrong reason.
 */
const now = new Date().toISOString()
const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString()

const projects = [
  {
    id: 'p-book', user_id: 'u1', title: 'Going Analogue', type: 'creative', status: 'active', state: 'live',
    description: 'A novel about an insomniac who drops off the internet to finally sleep.',
    created_at: daysAgo(200), updated_at: now, last_active: daysAgo(3),
    metadata: {
      shape: 'big', tags: ['writing'],
      themes: [{ text: 'Every chapter in the new voice', at: daysAgo(3) }, { text: 'Keep the town small', at: daysAgo(3) }],
      parts: [{ id: 'c1', label: 'Chapter 1', done: true }, { id: 'c2', label: 'Chapter 2', done: false }, { id: 'c3', label: 'Chapter 3', done: false }],
      summary: 'He leaves the city for a town with no signal. The twist is that he is the unnamed man.',
      last_closeout_text: 'Finished chapter 1, chapter 2 next.',
    },
  },
  {
    id: 'p-toy', user_id: 'u1', title: "Oscar's wooden train", type: 'creative', status: 'active', state: 'warm',
    description: 'A push-along train from offcuts.', created_at: daysAgo(60), updated_at: now, last_active: daysAgo(10),
    metadata: { shape: 'quick', tags: ['woodwork'], next_move: { text: 'Cut the base to 30cm.\nDone when the base is cut.', kind: 'move', at: daysAgo(10) } },
  },
  {
    id: 'p-mixes', user_id: 'u1', title: 'DJ mixes', type: 'creative', status: 'active', state: 'warm',
    description: 'One mix a month.', created_at: daysAgo(400), updated_at: now, last_active: daysAgo(25),
    metadata: { shape: 'keep', tags: ['music'], cycle: { unit: 'mix', done: 4, history: [] } },
  },
]

const memories = [
  { id: 'm1', user_id: 'u1', title: 'Dazzle ships and zebras', body: 'Zebra stripes are like dazzle camouflage on ships. They might confuse where it is heading.', tags: [], memory_type: 'insight', created_at: daysAgo(2), audiopen_created_at: daysAgo(2), processed: true },
  { id: 'm2', user_id: 'u1', title: 'The unnamed man', body: 'What if the narrator never gets a name until the last page.', tags: [], memory_type: 'quick-note', created_at: daysAgo(5), audiopen_created_at: daysAgo(5), processed: true },
]

const spark = {
  id: 's1', type: 'mull', project_id: null, projects: null,
  text: 'You noted zebras are like dazzle ships. Dazzle never hid ships, it distorted their heading. Do stripes hide where a zebra is, or where it is going?',
  score: 84, sources: [{ kind: 'note', title: 'Dazzle ships and zebras' }],
}

const lists = [
  { id: 'l1', user_id: 'u1', title: 'Films', type: 'film', created_at: daysAgo(100), updated_at: now, item_count: 2 },
  { id: 'l2', user_id: 'u1', title: 'Books', type: 'book', created_at: daysAgo(90), updated_at: now, item_count: 1 },
]

const routes = {
  lists,
  projects,
  memories: { memories },
  'utilities?resource=today': { spark },
  'utilities?resource=season': {
    season: { main: { id: 'p-book', title: 'Going Analogue' }, also: [{ id: 'p-toy', title: "Oscar's wooden train", size: 'weekend' }], until: '2026-12-25', label: 'Christmas', active: true },
    projects: projects.map(p => ({ id: p.id, title: p.title })),
  },
}

// Supabase REST tables the app reads directly (by table name).
const tables = { memories }

module.exports = { routes, projects, memories, tables }
