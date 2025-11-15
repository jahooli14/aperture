import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import type { Memory } from '../types/index.js';

/**
 * File-based memory implementation for persistent agent state
 * Follows Anthropic's recommendation for external memory to handle long-running tasks
 */
export class FileMemory implements Memory {
  private basePath: string;

  constructor(basePath: string = './.memory') {
    this.basePath = basePath;
  }

  /**
   * Save data to persistent memory
   */
  async save(key: string, value: any): Promise<void> {
    const filePath = join(this.basePath, `${key}.json`);

    // Ensure directory exists
    await mkdir(dirname(filePath), { recursive: true });

    // Save as JSON
    const data = {
      key,
      value,
      timestamp: new Date().toISOString(),
    };

    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Load data from persistent memory
   */
  async load(key: string): Promise<any> {
    try {
      const filePath = join(this.basePath, `${key}.json`);
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      return data.value;
    } catch (error) {
      // Return null if file doesn't exist
      return null;
    }
  }

  /**
   * Clear specific key from memory
   */
  async clear(key: string): Promise<void> {
    try {
      const filePath = join(this.basePath, `${key}.json`);
      await writeFile(filePath, '', 'utf-8');
    } catch (error) {
      // Ignore errors if file doesn't exist
    }
  }
}

/**
 * In-memory implementation for ephemeral state
 */
export class InMemoryMemory implements Memory {
  private store: Map<string, any>;

  constructor() {
    this.store = new Map();
  }

  async save(key: string, value: any): Promise<void> {
    this.store.set(key, {
      value,
      timestamp: new Date().toISOString(),
    });
  }

  async load(key: string): Promise<any> {
    const data = this.store.get(key);
    return data?.value ?? null;
  }

  async clear(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Clear all memory
   */
  clearAll(): void {
    this.store.clear();
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }
}
