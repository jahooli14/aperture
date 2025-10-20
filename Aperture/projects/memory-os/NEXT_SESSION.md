# Next Session - MemoryOS

**Last Updated**: 2025-10-20
**Status**: 🔵 Design Phase

---

## 📋 Project Overview

**MemoryOS** - Voice-to-memory personal knowledge graph

**Vision**: Capture thoughts via voice (like Audiopen), automatically convert to structured memories, build interconnected knowledge graph over time.

---

## 🎯 Current Status

**Phase**: Design & Architecture
**Next Step**: Define core data model and user flows

---

## 🚀 Next Steps

### Phase 1: Core Architecture (~2-3 hours)

**Define the data model**:
- [ ] What is a "memory"? (text, audio, metadata)
- [ ] How do memories connect? (tags, references, embeddings?)
- [ ] Storage strategy (Supabase, local-first, hybrid?)

**User flows**:
- [ ] Record voice → transcription → memory creation
- [ ] Browse memories (timeline, graph, search?)
- [ ] Connect related memories

### Phase 2: Technology Decisions

**Transcription**:
- Option A: Whisper.cpp (client-side, privacy-first)
- Option B: Cloud API (OpenAI, Deepgram)

**Storage**:
- Option A: Supabase (like Wizard of Oz)
- Option B: Local-first (SQLite + sync)

**Knowledge Graph**:
- Option A: Simple tag-based connections
- Option B: Embedding-based similarity
- Option C: Manual link creation

---

## 💡 Ideas & Inspiration

- Audiopen integration for voice input
- Obsidian-style graph visualization
- Daily reflection prompts
- Automatic memory clustering by theme
- Export to markdown/Obsidian vault

---

## 🔗 Resources

- **Project folder**: `projects/memory-os/`
- **Reference**: Audiopen.ai for UX patterns
- **Tech stack**: TBD (likely React + Supabase + Whisper)

---

**Status**: Waiting for architecture decisions before implementation
