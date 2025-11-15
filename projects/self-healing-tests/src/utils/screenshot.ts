import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';

export class ScreenshotManager {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create screenshots directory:', error);
    }
  }

  async saveScreenshot(screenshot: Buffer, testName: string, timestamp: Date = new Date()): Promise<string> {
    const filename = this.generateFilename(testName, timestamp);
    const filepath = join(this.outputDir, filename);

    try {
      await fs.writeFile(filepath, screenshot);
      logger.debug(`Screenshot saved: ${filepath}`);
      return filepath;
    } catch (error) {
      logger.error('Failed to save screenshot:', error);
      throw error;
    }
  }

  async loadScreenshot(filepath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filepath);
    } catch (error) {
      logger.error(`Failed to load screenshot: ${filepath}`, error);
      throw error;
    }
  }

  private generateFilename(testName: string, timestamp: Date): string {
    const sanitizedTestName = testName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();

    const timestampStr = timestamp
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, -1); // Remove trailing 'Z'

    return `${sanitizedTestName}_${timestampStr}.png`;
  }

  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const files = await fs.readdir(this.outputDir);
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.png')) continue;

        const filepath = join(this.outputDir, file);
        const stats = await fs.stat(filepath);

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filepath);
          logger.debug(`Cleaned up old screenshot: ${file}`);
        }
      }
    } catch (error) {
      logger.warn('Failed to cleanup old screenshots:', error);
    }
  }
}