# 📅 Visual Test Generator - 4-6 Week Roadmap

**Goal**: Build production-ready Visual Test Generator MVP
**Timeline**: 4-6 weeks (40 hours/week)
**Target Completion**: ~November 25-December 9, 2025

---

## 🎯 Overall Milestones

| Week | Milestone | Deliverable | Success Criteria |
|------|-----------|-------------|------------------|
| **1** | Video Infrastructure | Recording + Frame Extraction | Can record video, extract keyframes |
| **2** | Vision AI Integration | Florence-2 UI Detection | Identifies buttons, forms, inputs accurately |
| **3** | Multi-modal Understanding | SmolVLM + Audio | Understands intent from video + narration |
| **4** | Code Generation | WebLLM Playwright Output | Generates valid Playwright code |
| **5** | Polish & Validation | End-to-end workflow | Can generate passing test for NUDJ |
| **6** | Documentation & Launch | Production ready | Team can use independently |

---

## 📆 Week-by-Week Breakdown

---

## **Week 1: Video Recording & Frame Extraction**

**Goal**: Capture video recordings and extract meaningful frames

### Day 1 (Monday): Project Setup
- [ ] Initialize npm project with TypeScript
- [ ] Configure build system (Vite + TypeScript)
- [ ] Set up directory structure
- [ ] Install core dependencies
- [ ] Create basic project scaffolding

**Deliverables:**
- `package.json` with all dependencies
- Working `npm run build` command
- TypeScript compilation working

**Dependencies to install:**
```json
{
  "@xenova/transformers": "^2.17.0",
  "@mlc-ai/web-llm": "^0.2.0",
  "playwright": "^1.56.0",
  "dotenv": "^17.0.0"
}
```

---

### Day 2-3 (Tuesday-Wednesday): Video Recording Infrastructure

- [ ] Implement MediaRecorder API integration
- [ ] Build video capture UI component
- [ ] Add recording controls (start/stop/pause)
- [ ] Implement file saving to OPFS
- [ ] Create recording preview functionality

**Deliverables:**
- Working video recorder in browser
- Save recordings as WebM files
- Preview recorded videos

**Key Files:**
- `src/core/video-recorder.ts`
- `src/ui/recording-controls.tsx`

**Technical Challenges:**
- Browser compatibility (Chrome/Edge first, Firefox/Safari later)
- File size management (compression settings)
- Recording quality vs processing speed trade-offs

---

### Day 4-5 (Thursday-Friday): Frame Extraction Pipeline

- [ ] Implement intelligent keyframe detection
- [ ] Build visual diff algorithm for frame comparison
- [ ] Create manual marker system (user presses key to mark important moments)
- [ ] Optimize frame extraction for performance
- [ ] Add frame preview UI

**Deliverables:**
- Extract 1-3 frames per user interaction
- Visual diff identifies UI state changes
- User can manually mark key moments

**Key Files:**
- `src/core/frame-extractor.ts`
- `src/utils/visual-diff.ts`

**Algorithm:**
```typescript
// Intelligent frame extraction
1. Capture video at 30 fps
2. Compare consecutive frames with perceptual hash
3. Extract frames where similarity < 85% (significant change)
4. User manual markers always extracted
5. Result: 5-15 frames per 2-minute video
```

**Week 1 Success Criteria:**
- ✅ Can record 2-minute workflow video
- ✅ Extracts 10-15 meaningful frames automatically
- ✅ User can review extracted frames
- ✅ Frames saved for next processing step

---

## **Week 2: Florence-2 Vision AI Integration**

**Goal**: Understand UI elements from extracted frames

### Day 1 (Monday): Florence-2 Setup

- [ ] Load Florence-2 model in browser via Transformers.js
- [ ] Configure WebGPU acceleration
- [ ] Implement model caching in OPFS
- [ ] Test inference speed on sample images

**Deliverables:**
- Florence-2 running in browser
- Sub-5 second inference per image
- Model cached locally (don't re-download)

**Key Files:**
- `src/models/florence2.ts`
- `src/models/model-loader.ts`

**Model Selection:**
- Use Florence-2-base (232M params) for speed
- Upgrade to Florence-2-large (771M params) if accuracy insufficient

---

### Day 2-3 (Tuesday-Wednesday): UI Element Detection

- [ ] Implement object detection for UI elements
- [ ] Build OCR for text extraction
- [ ] Create bounding box visualization
- [ ] Map detected elements to semantic categories (button, input, form, etc.)

**Deliverables:**
- Detect buttons, inputs, forms, navigation elements
- Extract text from UI elements
- Show bounding boxes overlaid on frames

**Key Files:**
- `src/core/vision-analyzer.ts`
- `src/utils/element-classifier.ts`

**Detection Tasks:**
```typescript
// Florence-2 tasks to run
- Object detection: Identify UI components
- OCR: Extract all visible text
- Dense captioning: Describe what's happening in frame
- Region description: Understand specific UI areas
```

---

### Day 4-5 (Thursday-Friday): Selector Generation

- [ ] Build intelligent selector generator
- [ ] Implement selector priority hierarchy
- [ ] Create fallback selector chains
- [ ] Validate generated selectors against DOM

**Deliverables:**
- Generate data-testid, aria-label, text-based selectors
- Fallback chains for resilience
- Confidence scoring for selector quality

**Key Files:**
- `src/utils/selector-builder.ts`
- `src/utils/confidence-scorer.ts`

**Selector Strategy:**
```typescript
// Priority order
1. data-testid (most stable)
2. aria-label (accessible + stable)
3. Text content (user-facing)
4. CSS selectors (if unique)
5. XPath (last resort)

// Generate with fallbacks
page.locator('[data-testid="submit-btn"]')
  .or(page.locator('button:has-text("Submit")'))
  .or(page.locator('[aria-label="Submit form"]'))
```

**Week 2 Success Criteria:**
- ✅ Florence-2 identifies 85%+ of UI elements correctly
- ✅ Generates valid selectors for detected elements
- ✅ Processing time <15 seconds for 10 frames
- ✅ Confidence scores accurate (validated manually)

---

## **Week 3: Multi-modal Understanding (SmolVLM + Audio)**

**Goal**: Understand user intent from video context + narration

### Day 1 (Monday): SmolVLM Integration

- [ ] Load SmolVLM-256M or SmolVLM-500M via Transformers.js
- [ ] Configure for vision-language tasks
- [ ] Test multimodal inference (image + text)
- [ ] Optimize for browser performance

**Deliverables:**
- SmolVLM running in browser
- Answers questions about frames
- Sub-2 second per-frame inference

**Key Files:**
- `src/models/smolvlm.ts`

---

### Day 2-3 (Tuesday-Wednesday): Whisper Audio Transcription

- [ ] Integrate Whisper.cpp in browser (WebAssembly)
- [ ] Extract audio from video recordings
- [ ] Transcribe narration with timestamps
- [ ] Align transcription with video frames

**Deliverables:**
- Audio transcribed 2-3x faster than real-time
- Timestamped transcription aligned to frames
- Text output for each narrated action

**Key Files:**
- `src/core/audio-transcriber.ts`
- `src/utils/timestamp-aligner.ts`

**Whisper Model:**
- Use `tiny.en` (31MB) for speed
- Upgrade to `base` if accuracy insufficient

---

### Day 4-5 (Thursday-Friday): Contextual Understanding

- [ ] Combine visual understanding + narration
- [ ] Build action sequence detector
- [ ] Implement intent recognition
- [ ] Create action-to-code mapper

**Deliverables:**
- Understand what user intended from combined inputs
- Map visual actions + narration to test steps
- Generate action sequence with confidence

**Key Files:**
- `src/core/intent-recognizer.ts`
- `src/core/action-sequencer.ts`

**Example Flow:**
```
Frame 23: Florence-2 detects button "Create Reward"
Audio: "Now I click create reward"
SmolVLM: Confirms button click intent
→ Action: click('[data-testid="create-reward-button"]')
```

**Week 3 Success Criteria:**
- ✅ Transcribes narration accurately (>90% word accuracy)
- ✅ Aligns audio to correct video frames
- ✅ Understands intent from video + audio combination
- ✅ Generates action sequence with >80% accuracy

---

## **Week 4: Playwright Code Generation (WebLLM)**

**Goal**: Transform action sequence into valid Playwright test code

### Day 1 (Monday): WebLLM Setup

- [ ] Initialize WebLLM with Llama 3.2 or Qwen 2.5
- [ ] Configure for code generation tasks
- [ ] Test basic Playwright code generation
- [ ] Optimize model size vs quality

**Deliverables:**
- WebLLM running in browser
- Generates syntactically valid TypeScript
- ~1 req/sec inference speed

**Key Files:**
- `src/models/webllm.ts`
- `src/core/code-generator.ts`

**Model Selection:**
- Llama 3.2 3B (code-focused)
- Qwen 2.5 7B (if more context needed)

---

### Day 2-3 (Tuesday-Wednesday): Code Generation Pipeline

- [ ] Build prompt templates for Playwright generation
- [ ] Implement action → code translation
- [ ] Add assertion generation
- [ ] Create error handling code

**Deliverables:**
- Generates complete Playwright test files
- Includes imports, setup, actions, assertions
- Proper async/await handling

**Key Files:**
- `src/core/code-generator.ts`
- `src/templates/playwright-template.ts`

**Prompt Template:**
```typescript
const prompt = `
Generate Playwright test code for this workflow:

Actions:
1. Navigate to /admin/rewards
2. Click button with selector [data-testid="create-reward-button"]
3. Fill input [data-testid="reward-name"] with "Premium Badge"
4. Fill input [data-testid="reward-points"] with "500"
5. Click button [data-testid="submit-button"]
6. Verify success message appears

Generate complete TypeScript test file with:
- Proper imports
- Test description
- All actions with await
- Assertions
- Error handling
`;
```

---

### Day 4-5 (Thursday-Friday): Code Quality & Validation

- [ ] Implement code formatting (Prettier)
- [ ] Add TypeScript type validation
- [ ] Generate test documentation comments
- [ ] Build code review UI

**Deliverables:**
- Generated code is formatted and valid
- Passes TypeScript compilation
- Includes helpful comments
- User can review before saving

**Key Files:**
- `src/utils/code-formatter.ts`
- `src/utils/code-validator.ts`
- `src/ui/code-review.tsx`

**Week 4 Success Criteria:**
- ✅ Generates syntactically valid Playwright tests
- ✅ Code passes TypeScript compilation
- ✅ Includes proper imports, types, async handling
- ✅ Generated tests are readable and well-commented

---

## **Week 5: End-to-End Integration & Validation**

**Goal**: Complete working system, validated with NUDJ workflows

### Day 1-2 (Monday-Tuesday): End-to-End Pipeline

- [ ] Connect all components (video → frames → AI → code)
- [ ] Implement error handling throughout pipeline
- [ ] Add progress indicators and status updates
- [ ] Build complete user workflow

**Deliverables:**
- Full pipeline: record video → generate test
- Progress updates at each stage
- Error recovery and retry logic

**Key Files:**
- `src/core/pipeline-orchestrator.ts`
- `src/ui/progress-tracker.tsx`

---

### Day 3-4 (Wednesday-Thursday): NUDJ Workflow Validation

- [ ] Test with NUDJ "Create Reward" workflow
- [ ] Test with NUDJ "Edit Challenge" workflow
- [ ] Test with NUDJ "Configure Community" workflow
- [ ] Measure accuracy and time savings

**Deliverables:**
- 3+ NUDJ workflows successfully tested
- Generated tests run and pass
- Documented accuracy rates and issues

**Validation Checklist:**
```
For each workflow:
- [ ] Record 2-minute video
- [ ] AI generates test in <30 seconds
- [ ] Generated test runs without errors
- [ ] Test passes on first run OR requires minor fixes
- [ ] Measure: actual time vs expected time
```

---

### Day 5 (Friday): Performance Optimization

- [ ] Profile pipeline bottlenecks
- [ ] Optimize model loading times
- [ ] Reduce memory usage
- [ ] Improve UI responsiveness

**Deliverables:**
- Processing time reduced by 20%+
- Memory usage optimized
- Smooth UI experience

**Week 5 Success Criteria:**
- ✅ Can record NUDJ workflow and generate passing test
- ✅ Total time <5 minutes (record + generate + review)
- ✅ Generated test accuracy >80%
- ✅ Team validates: "This is faster than manual"

---

## **Week 6: Polish, Documentation & Launch**

**Goal**: Production-ready tool, documented, ready for team use

### Day 1-2 (Monday-Tuesday): UI/UX Polish

- [ ] Refine recording interface
- [ ] Improve code review/edit experience
- [ ] Add keyboard shortcuts
- [ ] Create onboarding flow
- [ ] Build example gallery

**Deliverables:**
- Professional, polished UI
- Intuitive user experience
- Onboarding tutorial
- Example recordings + tests

---

### Day 3 (Wednesday): Documentation

- [ ] Complete user guide with screenshots
- [ ] Write API reference documentation
- [ ] Create troubleshooting guide
- [ ] Record demo video
- [ ] Write blog post announcement

**Deliverables:**
- Comprehensive documentation
- Demo video showing full workflow
- Internal team training materials

**Documentation Structure:**
```
docs/
├── USER_GUIDE.md          # How to use the tool
├── API_REFERENCE.md       # Developer API docs
├── TROUBLESHOOTING.md     # Common issues & fixes
├── EXAMPLES.md            # Example workflows
└── ARCHITECTURE.md        # Technical deep-dive
```

---

### Day 4 (Thursday): Team Validation & Feedback

- [ ] Demo to NUDJ team
- [ ] Collect feedback
- [ ] Identify pain points
- [ ] Make priority fixes

**Deliverables:**
- Team feedback collected
- Priority issues identified
- Fixes implemented

---

### Day 5 (Friday): Launch Preparation

- [ ] Final bug fixes
- [ ] Performance verification
- [ ] Documentation review
- [ ] Create release notes
- [ ] Prepare launch announcement

**Deliverables:**
- Version 1.0.0 ready
- All documentation complete
- Team trained and ready to use

**Week 6 Success Criteria:**
- ✅ Team can use tool independently
- ✅ Documentation is complete and clear
- ✅ No critical bugs remaining
- ✅ Performance meets targets (see below)

---

## 🎯 Final Success Metrics

### Technical Performance
- **Test Generation Accuracy**: >85% on NUDJ workflows
- **Processing Speed**: <15 seconds per minute of video
- **Selector Resilience**: 70%+ survive minor UI changes
- **Code Quality**: 100% pass TypeScript compilation

### Business Outcomes
- **Time Savings**: 80%+ vs manual test writing (13+ hours for 20 tests)
- **User Adoption**: 100% of NUDJ team uses for new tests
- **Quality**: Generated tests catch same bugs as manual tests
- **ROI**: Break-even within 18 weeks (validated)

### User Experience
- **Ease of Use**: Team can use without training after onboarding
- **Satisfaction**: 70%+ prefer this over manual test writing
- **Reliability**: <10% of generated tests require manual fixes

---

## ⚠️ Risk Management

### Technical Risks

**Risk 1: Model Performance on Consumer Hardware**
- **Mitigation**: Start with smallest models, optimize aggressively
- **Fallback**: Cloud processing option for users without capable machines

**Risk 2: Test Accuracy Below 85%**
- **Mitigation**: Extensive validation in Week 5, iterate on prompts
- **Fallback**: Human-in-loop review process, confidence scoring

**Risk 3: Processing Too Slow (>30 seconds)**
- **Mitigation**: Optimize frame extraction, use smaller models
- **Fallback**: Background processing, user can continue working

### Schedule Risks

**Risk 1: Week Runs Over Budget**
- **Mitigation**: Fixed time boxes, ruthlessly cut scope if needed
- **Fallback**: Extend to 7-8 weeks if necessary

**Risk 2: Blocked by Technical Issue**
- **Mitigation**: Research phase validated feasibility
- **Fallback**: Community support, pivot approach if fundamental blocker

---

## 📅 Milestones & Gates

### Week 1 Gate
**Criteria**: Can record video and extract meaningful frames
**Decision**: Proceed to Week 2 or revise approach

### Week 3 Gate
**Criteria**: Can understand UI elements and user intent with 70%+ accuracy
**Decision**: Proceed to code generation or improve vision pipeline

### Week 5 Gate (CRITICAL)
**Criteria**: Can generate passing test for at least one NUDJ workflow
**Decision**: Go/No-Go for Week 6 polish

---

## 🚀 Post-Launch (Week 7+)

### Immediate Next Steps
- Expand to 10+ NUDJ workflows
- Gather usage data and success rates
- Iterate based on team feedback

### Medium Term (Weeks 8-12)
- Add Cypress/Vitest support
- Improve selector generation
- Build VS Code extension
- CI/CD integration

### Long Term (Months 3-6)
- Visual regression testing
- API test generation
- Cross-browser validation
- Team collaboration features

---

## 📊 Progress Tracking

### Weekly Status Template

```markdown
## Week X Status

**Completed:**
- [ ] Task 1
- [ ] Task 2

**In Progress:**
- [ ] Task 3

**Blocked:**
- [ ] Issue 1 (dependency: X)

**Metrics:**
- Time spent: X hours
- Lines of code: X
- Tests passing: X/X

**Next Week Focus:**
- Priority 1
- Priority 2
```

---

## 🎓 Learning Opportunities

### Technical Skills
- WebGPU programming
- Vision-language AI models
- Browser-based ML deployment
- Video/audio processing
- Test automation frameworks

### Product Skills
- User research and validation
- Technical documentation
- Product launch planning
- Performance optimization

---

**Last Updated**: 2025-10-20
**Status**: Ready to execute
**Next**: Start Week 1 - Day 1 tomorrow
