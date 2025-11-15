# 🏗️ Visual Test Generator - Technical Architecture

**Deep-dive into implementation details, model choices, and technical decisions**

---

## 📐 System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser Environment                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   User UI    │────────▶│   Recorder   │                 │
│  │  (React/TS)  │         │ (MediaRec API)│                │
│  └──────────────┘         └──────┬───────┘                 │
│                                   │                          │
│                                   ▼                          │
│                          ┌─────────────────┐                │
│                          │  Video Storage  │                │
│                          │     (OPFS)      │                │
│                          └────────┬────────┘                │
│                                   │                          │
│                                   ▼                          │
│                          ┌─────────────────┐                │
│                          │ Frame Extractor │                │
│                          │  (Canvas API)   │                │
│                          └────────┬────────┘                │
│                                   │                          │
│          ┌────────────────────────┼────────────────┐        │
│          ▼                        ▼                ▼        │
│  ┌──────────────┐        ┌──────────────┐  ┌──────────┐   │
│  │  Florence-2  │        │   SmolVLM    │  │ Whisper  │   │
│  │(UI Elements) │        │  (Context)   │  │  (Audio) │   │
│  └──────┬───────┘        └──────┬───────┘  └────┬─────┘   │
│         │                       │                │          │
│         └───────────┬───────────┘                │          │
│                     ▼                            │          │
│            ┌────────────────┐                   │          │
│            │ Action Sequence│◀──────────────────┘          │
│            │   Generator    │                              │
│            └────────┬───────┘                              │
│                     │                                       │
│                     ▼                                       │
│             ┌───────────────┐                              │
│             │    WebLLM     │                              │
│             │(Code Generator)│                             │
│             └───────┬───────┘                              │
│                     │                                       │
│                     ▼                                       │
│             ┌───────────────┐                              │
│             │  Playwright   │                              │
│             │   Test Code   │                              │
│             └───────────────┘                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧠 AI Model Stack

### 1. Florence-2 (Microsoft)

**Purpose**: UI element detection and understanding

**Model Details:**
- **Architecture**: Unified vision-language foundation model
- **Size Options**: Base (232M params), Large (771M params)
- **Input**: Images (frames from video)
- **Output**: Object detections, OCR text, dense captions, region descriptions

**Why Florence-2:**
- Unified model handles multiple vision tasks
- Excellent zero-shot performance (81.5% on TextVQA)
- Optimized for edge deployment
- Native support in Transformers.js v3

**Tasks Used:**
```typescript
// Object detection - find UI components
<OD> → Bounding boxes for buttons, inputs, forms

// OCR - extract all text
<OCR> → Text content from UI elements

// Dense captioning - describe UI state
<CAPTION> → "Login form with email and password fields"

// Region description - understand specific areas
<REGION_TO_DESCRIPTION> → "Submit button in bottom right"
```

**Performance Targets:**
- Inference speed: <5 seconds per frame (WebGPU)
- Accuracy: 85%+ on common UI patterns
- Memory: ~1.5GB VRAM for base model

**Integration:**
```typescript
import { pipeline } from '@xenova/transformers';

const detector = await pipeline(
  'object-detection',
  'Salesforce/blip2-opt-2.7b', // Florence-2 coming soon
  { device: 'webgpu' }
);

const result = await detector(imageFrame);
// result: [{ label: 'button', box: {...}, score: 0.95 }, ...]
```

---

### 2. SmolVLM (Hugging Face)

**Purpose**: Multimodal understanding (vision + language)

**Model Details:**
- **Architecture**: Vision-language model
- **Size Options**: 256M, 500M, 2.2B params
- **Input**: Image + text query
- **Output**: Natural language response

**Why SmolVLM:**
- Runs efficiently in browser (2-3k tokens/sec on M1/M2)
- Multimodal reasoning (combines visual + textual context)
- Tiny size (256M) yet powerful performance
- Video understanding capabilities (new in 2025)

**Use Cases:**
```typescript
// Understand user intent
query: "What is the user trying to do in this frame?"
response: "User is clicking the Create Reward button to open the creation form"

// Validate element detection
query: "Is this a submit button or cancel button?"
response: "This is a submit button based on the text 'Create' and green color"

// Describe workflow step
query: "What changed between frame A and frame B?"
response: "A modal dialog appeared with a form for creating a new reward"
```

**Performance Targets:**
- Inference speed: <2 seconds per frame (500M model)
- Context window: 8k-16k tokens
- Memory: 1.2GB VRAM for 500M model

**Integration:**
```typescript
import { AutoModelForVision2Seq, AutoProcessor } from '@xenova/transformers';

const model = await AutoModelForVision2Seq.from_pretrained(
  'HuggingFaceTB/SmolVLM-500M',
  { device: 'webgpu' }
);

const response = await model.generate({
  image: frame,
  prompt: "What UI element is the user interacting with?"
});
```

---

### 3. WebLLM (MLC AI)

**Purpose**: Code generation (Playwright test code)

**Model Details:**
- **Supported Models**: Llama 3.2 (3B, 8B), Qwen 2.5 (7B, 14B), Phi-3
- **Architecture**: Transformer-based LLM optimized for browser
- **Input**: Action sequence + context
- **Output**: TypeScript/JavaScript code

**Why WebLLM:**
- 100% browser-native (no server required)
- OpenAI API compatibility
- 80% native performance in browser
- Quantization support (4-bit, 8-bit)

**Model Selection:**
```typescript
// Llama 3.2 3B - Best for code generation
- Size: ~2GB quantized
- Speed: ~1 req/sec
- Quality: Excellent for TypeScript/Playwright

// Qwen 2.5 7B - Alternative for complex logic
- Size: ~4GB quantized
- Speed: ~0.5 req/sec
- Quality: Better reasoning, slower
```

**Performance Targets:**
- Code generation: <10 seconds for complete test
- Context: Full action sequence + selectors + narration
- Accuracy: 95%+ syntactically valid code

**Integration:**
```typescript
import { CreateMLCEngine } from '@mlc-ai/web-llm';

const engine = await CreateMLCEngine('Llama-3.2-3B-Instruct-q4f16_1-MLC');

const response = await engine.chat.completions.create({
  messages: [
    { role: 'system', content: 'You are a Playwright test code generator.' },
    { role: 'user', content: prompt }
  ]
});

const generatedCode = response.choices[0].message.content;
```

---

### 4. Whisper.cpp (OpenAI/Browser)

**Purpose**: Audio transcription from narration

**Model Details:**
- **Architecture**: Encoder-decoder transformer for speech recognition
- **Size Options**: tiny.en (31MB), base.en (74MB), small.en (244MB)
- **Input**: Audio from video recording
- **Output**: Timestamped text transcription

**Why Whisper.cpp:**
- WebAssembly port runs in browser
- 2-3x faster than real-time transcription
- Excellent accuracy (>90% word accuracy)
- Timestamp support for frame alignment

**Model Selection:**
```typescript
// tiny.en - Fast, good enough for narration
- Size: 31MB Q5_1 quantized
- Speed: 3x real-time
- Accuracy: 85-90% (sufficient for test intent)

// base.en - Better accuracy if needed
- Size: 74MB
- Speed: 2x real-time
- Accuracy: 90-95%
```

**Performance Targets:**
- Transcription speed: 2-3x faster than video length
- Accuracy: >90% word-level accuracy
- Alignment: Timestamps match video frames within 0.5 seconds

**Integration:**
```typescript
import { WhisperModel } from 'whisper-web';

const model = await WhisperModel.load('tiny.en');
const transcription = await model.transcribe(audioBuffer, {
  timestamps: true,
  language: 'en'
});

// transcription: [
//   { start: 0.0, end: 2.5, text: "Now I click create reward" },
//   { start: 2.5, end: 5.0, text: "I fill in the name field" }
// ]
```

---

## 🔧 Core Components

### Video Recording System

**Technology**: MediaRecorder API + MediaStream API

**Capabilities:**
- Screen + audio capture
- Adjustable quality settings
- Pause/resume support
- Real-time preview

**Implementation:**
```typescript
class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  async startRecording(options: RecordingOptions) {
    // Request screen capture
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: true // Capture microphone for narration
    });

    // Create recorder
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 2500000 // 2.5 Mbps
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.start(1000); // Collect data every 1 second
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'video/webm' });
        resolve(blob);
      };
      this.mediaRecorder!.stop();
    });
  }
}
```

---

### Frame Extraction Pipeline

**Technology**: Canvas API + Perceptual Hashing

**Algorithm:**
```typescript
class FrameExtractor {
  async extractKeyframes(
    videoBlob: Blob,
    options: ExtractionOptions
  ): Promise<Frame[]> {
    const video = await this.loadVideo(videoBlob);
    const frames: Frame[] = [];

    let previousHash: string | null = null;
    const frameInterval = 1 / 30; // 30 fps

    for (let time = 0; time < video.duration; time += frameInterval) {
      video.currentTime = time;
      await this.waitForSeek(video);

      // Capture frame to canvas
      const canvas = this.captureFrame(video);
      const currentHash = this.perceptualHash(canvas);

      // Compare with previous frame
      if (!previousHash || this.similarity(previousHash, currentHash) < 0.85) {
        // Significant change detected - this is a keyframe
        frames.push({
          timestamp: time,
          image: canvas.toDataURL(),
          hash: currentHash
        });
        previousHash = currentHash;
      }
    }

    return frames;
  }

  private perceptualHash(canvas: HTMLCanvasElement): string {
    // Simplified perceptual hash algorithm
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, 8, 8); // Downscale to 8x8

    // Calculate average color
    let sum = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      sum += (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
    }
    const avg = sum / 64;

    // Generate hash based on above/below average
    let hash = '';
    for (let i = 0; i < imageData.data.length; i += 4) {
      const value = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
      hash += value > avg ? '1' : '0';
    }

    return hash;
  }
}
```

---

### Vision Analysis Engine

**Combines**: Florence-2 + SmolVLM + Custom Logic

**Pipeline:**
```typescript
class VisionAnalyzer {
  private florence2: Florence2Model;
  private smolvlm: SmolVLMModel;

  async analyzeFrame(frame: Frame, context: AnalysisContext): Promise<FrameAnalysis> {
    // Step 1: Object detection with Florence-2
    const objects = await this.florence2.detectObjects(frame.image);

    // Step 2: OCR for text extraction
    const text = await this.florence2.extractText(frame.image);

    // Step 3: Classify UI elements
    const elements = this.classifyElements(objects, text);

    // Step 4: Contextual understanding with SmolVLM
    const intent = await this.smolvlm.analyzeIntent(
      frame.image,
      context.narration,
      context.previousFrames
    );

    // Step 5: Generate selectors
    const selectors = this.generateSelectors(elements);

    return {
      elements,
      selectors,
      intent,
      confidence: this.calculateConfidence(elements, intent)
    };
  }

  private classifyElements(objects: Detection[], text: OCRResult[]): UIElement[] {
    const elements: UIElement[] = [];

    for (const obj of objects) {
      const type = this.inferElementType(obj, text);
      const selector = this.buildSelector(obj, text);

      elements.push({
        type,
        boundingBox: obj.box,
        text: this.findTextNear(obj.box, text),
        selector,
        confidence: obj.score
      });
    }

    return elements;
  }

  private inferElementType(obj: Detection, text: OCRResult[]): ElementType {
    // Heuristics for element type classification
    const nearbyText = this.findTextNear(obj.box, text);

    if (nearbyText.some(t => /submit|send|save|create/i.test(t.text))) {
      return 'button';
    }
    if (obj.box.width > 200 && obj.box.height < 50) {
      return 'input';
    }
    if (obj.label === 'text-field') {
      return 'input';
    }
    // ... more heuristics

    return 'unknown';
  }
}
```

---

### Selector Generation Strategy

**Priority Hierarchy:**
```typescript
class SelectorBuilder {
  buildSelector(element: UIElement): SelectorChain {
    const selectors: Selector[] = [];

    // Priority 1: data-testid (if we can infer it)
    if (element.suggestedTestId) {
      selectors.push({
        type: 'data-testid',
        value: `[data-testid="${element.suggestedTestId}"]`,
        confidence: 0.95
      });
    }

    // Priority 2: aria-label
    if (element.ariaLabel) {
      selectors.push({
        type: 'aria',
        value: `[aria-label="${element.ariaLabel}"]`,
        confidence: 0.90
      });
    }

    // Priority 3: Text content
    if (element.text) {
      selectors.push({
        type: 'text',
        value: `text="${element.text}"`,
        confidence: 0.85
      });
    }

    // Priority 4: CSS selector (if unique)
    const cssSelector = this.generateCSSSelector(element);
    if (this.isUnique(cssSelector)) {
      selectors.push({
        type: 'css',
        value: cssSelector,
        confidence: 0.70
      });
    }

    return {
      primary: selectors[0],
      fallbacks: selectors.slice(1),
      combined: this.combineSelectors(selectors)
    };
  }

  private combineSelectors(selectors: Selector[]): string {
    // Generate Playwright locator chain with fallbacks
    return selectors
      .map((s, i) => i === 0
        ? `page.locator('${s.value}')`
        : `.or(page.locator('${s.value}'))`
      )
      .join('\n  ');
  }
}
```

---

### Code Generation Engine

**Prompt Engineering:**
```typescript
class CodeGenerator {
  private llm: WebLLM;

  async generateTest(
    actionSequence: Action[],
    context: GenerationContext
  ): Promise<string> {
    const prompt = this.buildPrompt(actionSequence, context);

    const response = await this.llm.generate({
      prompt,
      temperature: 0.2, // Lower = more deterministic
      maxTokens: 2000,
      stopSequences: ['```']
    });

    return this.postProcess(response);
  }

  private buildPrompt(actions: Action[], context: GenerationContext): string {
    return `
You are an expert Playwright test code generator.

Generate a complete TypeScript Playwright test file for this workflow:

## Workflow Context
- Page: ${context.url}
- Description: ${context.description}
- Framework: Playwright with TypeScript

## Action Sequence
${actions.map((a, i) => `
${i + 1}. ${a.type}: ${a.description}
   - Selector: ${a.selector}
   - Value: ${a.value || 'N/A'}
   - Confidence: ${a.confidence}
`).join('\n')}

## Requirements
1. Generate complete test file with imports
2. Use async/await for all Playwright actions
3. Include proper error handling
4. Add descriptive test name and comments
5. Use the selectors provided (with fallbacks where confidence < 0.8)
6. Add assertions where appropriate
7. Follow Playwright best practices

Generate the code now:
\`\`\`typescript
`;
  }

  private postProcess(code: string): string {
    // Extract code from markdown
    let processed = code.replace(/^```typescript\\n/, '').replace(/\\n```$/, '');

    // Format with Prettier
    processed = this.format(processed);

    // Validate TypeScript syntax
    this.validateTypeScript(processed);

    return processed;
  }
}
```

---

## 💾 Data Flow

### Complete Pipeline Flow

```
1. VIDEO RECORDING
   Input: User interaction with app
   Output: WebM video file + audio track
   Storage: OPFS (up to 4GB)

2. FRAME EXTRACTION
   Input: Video file
   Output: 10-15 PNG frames (keyframes only)
   Storage: Memory (ArrayBuffer)

3. AUDIO TRANSCRIPTION
   Input: Audio track
   Output: Timestamped text
   Processing: Whisper.cpp (2-3x real-time)

4. VISUAL ANALYSIS (Florence-2)
   Input: Frame images
   Output: UI element detections with bounding boxes
   Processing: <5 sec/frame on WebGPU

5. CONTEXTUAL UNDERSTANDING (SmolVLM)
   Input: Frames + narration + previous context
   Output: User intent, action descriptions
   Processing: <2 sec/frame

6. SELECTOR GENERATION
   Input: UI element detections
   Output: Playwright selector chains with confidence
   Processing: <1 sec (local logic)

7. ACTION SEQUENCE
   Input: All analysis results + timestamps
   Output: Ordered list of test actions
   Processing: <1 sec (local logic)

8. CODE GENERATION (WebLLM)
   Input: Action sequence + context
   Output: Complete Playwright TypeScript test
   Processing: <10 sec

9. CODE REVIEW & SAVE
   Input: Generated code
   Output: Test file saved to disk
   User: Manual review and edit if needed
```

---

## 🚀 Performance Optimization

### Model Loading Strategy

```typescript
class ModelLoader {
  private modelCache = new Map<string, Model>();

  async loadModel(modelId: string): Promise<Model> {
    // Check memory cache
    if (this.modelCache.has(modelId)) {
      return this.modelCache.get(modelId)!;
    }

    // Check OPFS cache
    const cached = await this.loadFromOPFS(modelId);
    if (cached) {
      this.modelCache.set(modelId, cached);
      return cached;
    }

    // Download and cache
    const model = await this.downloadModel(modelId);
    await this.saveToOPFS(modelId, model);
    this.modelCache.set(modelId, model);

    return model;
  }

  async preloadModels() {
    // Preload in parallel during idle time
    const models = ['florence-2-base', 'smolvlm-500m', 'llama-3.2-3b'];

    await Promise.all(
      models.map(m => this.loadModel(m))
    );
  }
}
```

### WebGPU Acceleration

```typescript
class GPUManager {
  private device: GPUDevice | null = null;

  async initialize() {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported');
    }

    const adapter = await navigator.gpu.requestAdapter();
    this.device = await adapter!.requestDevice();
  }

  async runInference(model: Model, input: Tensor): Promise<Tensor> {
    // Use WebGPU for matrix operations
    const commandEncoder = this.device!.createCommandEncoder();

    // Encode GPU operations
    // ... (model-specific GPU code)

    const gpuCommands = commandEncoder.finish();
    this.device!.queue.submit([gpuCommands]);

    // Read results
    return await this.readResults();
  }
}
```

---

## 🔒 Storage Management

### OPFS (Origin Private File System)

```typescript
class StorageManager {
  private root: FileSystemDirectoryHandle | null = null;

  async initialize() {
    this.root = await navigator.storage.getDirectory();
  }

  async saveVideo(blob: Blob, filename: string) {
    const fileHandle = await this.root!.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  async saveModel(modelId: string, data: ArrayBuffer) {
    const modelDir = await this.root!.getDirectoryHandle('models', { create: true });
    const fileHandle = await modelDir.getFileHandle(`${modelId}.bin`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  }

  async listVideos(): Promise<string[]> {
    const entries = [];
    for await (const entry of this.root!.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.webm')) {
        entries.push(entry.name);
      }
    }
    return entries;
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests
- Frame extraction accuracy
- Selector generation logic
- Code formatting/validation
- Timestamp alignment

### Integration Tests
- Florence-2 model loading
- SmolVLM inference
- WebLLM code generation
- End-to-end pipeline

### E2E Tests
- Record sample workflows
- Validate generated tests
- Measure accuracy rates
- Performance benchmarks

---

**Last Updated**: 2025-10-20
**Status**: Architecture finalized
**Next**: Begin implementation Week 1
