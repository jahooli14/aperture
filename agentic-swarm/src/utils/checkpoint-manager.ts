/**
 * Checkpoint Manager - State persistence for long-running swarms
 *
 * Enables resume capability if the process crashes or is interrupted.
 * Saves state periodically (every N minutes) and on demand.
 */

import { writeFile, readFile, access } from 'fs/promises';
import { constants } from 'fs';

export interface CheckpointState {
  startTime: number;
  lastCheckpoint: number;
  phase: string;
  phaseNumber: number;
  completedTasks: number;
  totalTasks: number;
  results: any[];
  synthesis: string[];
  costUSD: number;
  metadata: Record<string, any>;
}

export interface CheckpointOptions {
  filePath: string;
  autoSaveIntervalMs?: number; // Auto-save every N ms (default: 30 min)
  enabled?: boolean; // Enable checkpointing (default: true)
}

export class CheckpointManager {
  private options: Required<CheckpointOptions>;
  private state: CheckpointState;
  private autoSaveTimer?: NodeJS.Timeout;
  private isDirty: boolean = false; // Has state changed since last save?

  constructor(options: CheckpointOptions) {
    this.options = {
      filePath: options.filePath,
      autoSaveIntervalMs: options.autoSaveIntervalMs || 30 * 60 * 1000, // 30 min default
      enabled: options.enabled !== undefined ? options.enabled : true,
    };

    this.state = this.getEmptyState();
  }

  /**
   * Initialize checkpoint system
   * Attempts to load existing checkpoint, creates new one if not found
   */
  async initialize(): Promise<{ resumed: boolean; state?: CheckpointState }> {
    if (!this.options.enabled) {
      return { resumed: false };
    }

    const exists = await this.checkpointExists();

    if (exists) {
      const state = await this.load();
      if (state) {
        this.state = state;
        console.log(`✅ Resumed from checkpoint: Phase ${state.phaseNumber} (${state.phase})`);
        console.log(`   Completed: ${state.completedTasks}/${state.totalTasks} tasks`);
        console.log(`   Cost so far: $${state.costUSD.toFixed(3)}`);
        return { resumed: true, state };
      }
    }

    // Start fresh
    this.state = this.getEmptyState();

    // Start auto-save timer
    if (this.options.autoSaveIntervalMs > 0) {
      this.startAutoSave();
    }

    return { resumed: false };
  }

  /**
   * Update checkpoint state
   */
  updateState(updates: Partial<CheckpointState>): void {
    if (!this.options.enabled) return;

    this.state = {
      ...this.state,
      ...updates,
      lastCheckpoint: Date.now(),
    };

    this.isDirty = true;
  }

  /**
   * Add a result to the checkpoint
   */
  addResult(result: any): void {
    if (!this.options.enabled) return;

    this.state.results.push(result);
    this.state.completedTasks++;
    this.state.lastCheckpoint = Date.now();
    this.isDirty = true;
  }

  /**
   * Add synthesis to checkpoint
   */
  addSynthesis(synthesis: string): void {
    if (!this.options.enabled) return;

    this.state.synthesis.push(synthesis);
    this.state.lastCheckpoint = Date.now();
    this.isDirty = true;
  }

  /**
   * Update cost
   */
  updateCost(costUSD: number): void {
    if (!this.options.enabled) return;

    this.state.costUSD = costUSD;
    this.isDirty = true;
  }

  /**
   * Update metadata (any custom data)
   */
  updateMetadata(key: string, value: any): void {
    if (!this.options.enabled) return;

    this.state.metadata[key] = value;
    this.isDirty = true;
  }

  /**
   * Save checkpoint to disk
   */
  async save(): Promise<void> {
    if (!this.options.enabled) return;

    try {
      const json = JSON.stringify(this.state, null, 2);
      await writeFile(this.options.filePath, json, 'utf-8');
      this.isDirty = false;

      const elapsed = ((Date.now() - this.state.startTime) / 1000 / 60).toFixed(1);
      console.log(`💾 Checkpoint saved (${elapsed} min elapsed, $${this.state.costUSD.toFixed(3)})`);
    } catch (error) {
      console.error(`Failed to save checkpoint:`, error);
    }
  }

  /**
   * Load checkpoint from disk
   */
  async load(): Promise<CheckpointState | null> {
    if (!this.options.enabled) return null;

    try {
      const json = await readFile(this.options.filePath, 'utf-8');
      const state = JSON.parse(json) as CheckpointState;

      // Validate the checkpoint
      if (!this.isValidCheckpoint(state)) {
        console.warn(`⚠️  Invalid checkpoint format, starting fresh`);
        return null;
      }

      return state;
    } catch (error) {
      // File doesn't exist or is invalid - not an error, just start fresh
      return null;
    }
  }

  /**
   * Check if checkpoint file exists
   */
  private async checkpointExists(): Promise<boolean> {
    try {
      await access(this.options.filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate checkpoint structure
   */
  private isValidCheckpoint(state: any): boolean {
    return (
      state &&
      typeof state.startTime === 'number' &&
      typeof state.phase === 'string' &&
      Array.isArray(state.results) &&
      Array.isArray(state.synthesis)
    );
  }

  /**
   * Get empty initial state
   */
  private getEmptyState(): CheckpointState {
    return {
      startTime: Date.now(),
      lastCheckpoint: Date.now(),
      phase: 'initialization',
      phaseNumber: 0,
      completedTasks: 0,
      totalTasks: 0,
      results: [],
      synthesis: [],
      costUSD: 0,
      metadata: {},
    };
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      if (this.isDirty) {
        this.save();
      }
    }, this.options.autoSaveIntervalMs);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * Get current state
   */
  getState(): CheckpointState {
    return { ...this.state };
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedSeconds(): number {
    return (Date.now() - this.state.startTime) / 1000;
  }

  /**
   * Get elapsed time formatted as string
   */
  getElapsedFormatted(): string {
    const seconds = this.getElapsedSeconds();
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Finalize checkpoint (save and stop auto-save)
   */
  async finalize(): Promise<void> {
    if (!this.options.enabled) return;

    this.stopAutoSave();

    if (this.isDirty) {
      await this.save();
    }

    console.log(`✅ Checkpoint finalized: ${this.getElapsedFormatted()} elapsed`);
  }

  /**
   * Check if should continue based on runtime and budget
   */
  shouldContinue(params: {
    minRuntimeMs?: number;
    maxCostUSD?: number;
  }): { continue: boolean; reason?: string } {
    const elapsed = Date.now() - this.state.startTime;

    // Check minimum runtime
    if (params.minRuntimeMs && elapsed < params.minRuntimeMs) {
      return { continue: true };
    }

    // Check cost limit
    if (params.maxCostUSD && this.state.costUSD >= params.maxCostUSD) {
      return {
        continue: false,
        reason: `Cost limit reached ($${this.state.costUSD.toFixed(3)} >= $${params.maxCostUSD.toFixed(2)})`,
      };
    }

    // If we've hit minimum runtime and haven't exceeded cost, we can stop
    if (params.minRuntimeMs && elapsed >= params.minRuntimeMs) {
      return {
        continue: false,
        reason: `Minimum runtime reached (${this.getElapsedFormatted()})`,
      };
    }

    return { continue: true };
  }
}
