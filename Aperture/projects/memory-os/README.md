# 🧠 MemoryOS

> Bidirectional memory augmentation - turn voice notes into a searchable, explorable personal knowledge graph

## What It Is

MemoryOS captures your thoughts via voice (through Audiopen), structures them, and actively surfaces connections you wouldn't otherwise see. It's not just storage - it's an active learning system that strengthens both your digital and biological memory.

## The Core Loop

```
Voice Note → Structure → Find Connections → Surface Insights → Read → Memory Reinforced → Repeat
```

## Project Status

**Current Phase**: Design & Planning
**Next Step**: Build MVP (see implementation plan below)

## Key Concepts

### Memory Types

1. **Foundational Memories** - Deep dives on people, places, topics
   - Example: "Everything I know about James"
   - Rich, contextual, often recorded in one sitting

2. **Event Memories** - Specific moments, conversations, experiences
   - Example: "Coffee with James today"
   - Time-stamped, context-tagged

3. **Insight Memories** - Thoughts sparked by reading or connections
   - Example: "Realized action-oriented thinking connects to James's anxiety"
   - Often generated through the bridging process

### The "Holy Shit" Moment

You record a new thought, and the system shows you:
- A forgotten conversation from 2 years ago that's directly relevant
- A pattern you've been circling around but couldn't see
- An answer to a question you asked yourself months ago

This strengthens your biological memory AND makes the system smarter.

## Technical Stack (Planned)

- **Capture**: Audiopen (voice → structured JSON)
- **Storage**: Supabase (PostgreSQL + pgvector)
- **Search**: OpenAI embeddings + vector similarity
- **Insights**: Claude API (Sonnet 4.5)
- **Delivery**: Resend (daily email digest)
- **Hosting**: Vercel

## Implementation Status

**✅ Phase 1: MVP Complete** (Capture + Bridge-finding)

**Built**:
- Webhook endpoint for Audiopen integration
- Entity extraction with Gemini 2.5 Flash
- Bridge-finding algorithm (entity match, semantic similarity, temporal proximity)
- Vector search with pgvector
- Basic web interface for viewing memories
- Processing pipeline (async)

## Quick Start

1. **Setup**: See `SETUP.md` for detailed instructions
2. **Deploy**: `vercel` (configure env vars in Vercel dashboard)
3. **Configure Audiopen**: Add webhook URL to Audiopen settings
4. **Test**: Record a note, wait 4 minutes, check web interface

## Next Steps (Phase 2)

- [ ] Daily email digest (Resend integration)
- [ ] Real-time updates (Supabase subscriptions)
- [ ] Bridge detail view (see connected memories)
- [ ] Manual tagging/corrections
- [ ] Search interface
- [ ] Mobile-optimized UI

## Documentation

- `SETUP.md` - Step-by-step setup guide
- `schema.sql` - Database schema
- `migrations.sql` - Vector search function
- Audiopen prompt in this README (section above)

---

**Built for**: Personal use (single user)
**Philosophy**: Memory augmentation, not replacement
**Goal**: Help you see patterns, connections, and growth you can't see from inside
