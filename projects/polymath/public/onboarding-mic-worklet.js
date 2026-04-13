/**
 * Onboarding mic AudioWorklet
 *
 * Captures Float32 audio from the microphone and converts it to 16-bit PCM
 * mono at 16 kHz, the format the Gemini Live API expects. The worklet posts
 * Int16 PCM frames to the main thread roughly every 100ms (~3200 samples).
 *
 * The worklet runs at the AudioContext's sampleRate (typically 48000 in
 * browsers); we resample down to 16000 inline using linear interpolation.
 */
class OnboardingMicProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.targetSampleRate = 16000
    this.frameMs = 100
    this.targetFrameSamples = (this.targetSampleRate * this.frameMs) / 1000 // 1600
    this.outBuffer = new Int16Array(this.targetFrameSamples)
    this.outIndex = 0

    // Resampling state — we keep a fractional read pointer into the input.
    this.inputBuffer = new Float32Array(0)
    this.readPos = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const ch = input[0]
    if (!ch || ch.length === 0) return true

    // Append incoming samples to our input buffer.
    const merged = new Float32Array(this.inputBuffer.length + ch.length)
    merged.set(this.inputBuffer, 0)
    merged.set(ch, this.inputBuffer.length)
    this.inputBuffer = merged

    const ratio = sampleRate / this.targetSampleRate

    while (true) {
      const nextSampleIdx = Math.ceil(this.readPos)
      // Need at least nextSampleIdx + 1 samples to interpolate
      if (nextSampleIdx + 1 >= this.inputBuffer.length) break

      // Linear interpolation
      const i0 = Math.floor(this.readPos)
      const i1 = i0 + 1
      const t = this.readPos - i0
      const sample = this.inputBuffer[i0] * (1 - t) + this.inputBuffer[i1] * t

      // Clamp to [-1, 1] then convert to int16
      const clamped = Math.max(-1, Math.min(1, sample))
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff

      this.outBuffer[this.outIndex++] = int16

      if (this.outIndex >= this.targetFrameSamples) {
        // Post a copy of the buffer so we can keep mutating outBuffer.
        const copy = new Int16Array(this.targetFrameSamples)
        copy.set(this.outBuffer)
        this.port.postMessage(copy.buffer, [copy.buffer])
        this.outIndex = 0
      }

      this.readPos += ratio
    }

    // Trim the input buffer to drop already-consumed samples.
    const consumed = Math.floor(this.readPos)
    if (consumed > 0) {
      this.inputBuffer = this.inputBuffer.slice(consumed)
      this.readPos -= consumed
    }

    return true
  }
}

registerProcessor('onboarding-mic-processor', OnboardingMicProcessor)
