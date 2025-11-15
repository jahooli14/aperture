import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import type { Tool } from '../types/index.js';

/**
 * Read file contents
 */
export const readFileTool: Tool = {
  name: 'read_file',
  description: `Read contents of a file from the filesystem. Use absolute paths for reliability.

Best practices:
- Use absolute paths (e.g., /Users/name/project/file.txt)
- Check file exists before reading large files
- Handle text files only (use appropriate tools for binary files)

Returns file contents as text.`,
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to the file',
      },
    },
    required: ['path'],
  },
  execute: async (input: { path: string }) => {
    try {
      const absolutePath = resolve(input.path);
      const content = await readFile(absolutePath, 'utf-8');

      return {
        path: absolutePath,
        content,
        size: content.length,
      };
    } catch (error) {
      return {
        path: input.path,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

/**
 * Write file contents
 */
export const writeFileTool: Tool = {
  name: 'write_file',
  description: `Write content to a file on the filesystem. Creates file if it doesn't exist, overwrites if it does.

Best practices:
- Use absolute paths for reliability
- Ensure parent directory exists
- Be cautious with overwrites

Warning: This will overwrite existing files without confirmation.`,
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path where to write the file',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['path', 'content'],
  },
  execute: async (input: { path: string; content: string }) => {
    try {
      const absolutePath = resolve(input.path);
      await writeFile(absolutePath, input.content, 'utf-8');

      return {
        path: absolutePath,
        success: true,
        size: input.content.length,
      };
    } catch (error) {
      return {
        path: input.path,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

/**
 * List directory contents
 */
export const listDirectoryTool: Tool = {
  name: 'list_directory',
  description: `List contents of a directory. Returns file and directory names with metadata.

Best practices:
- Use absolute paths
- Handle large directories appropriately
- Check permissions before listing

Returns array of file/directory information.`,
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to the directory',
      },
      include_stats: {
        type: 'boolean',
        description: 'Include file size and modification time. Default: false',
      },
    },
    required: ['path'],
  },
  execute: async (input: { path: string; include_stats?: boolean }) => {
    try {
      const absolutePath = resolve(input.path);
      const entries = await readdir(absolutePath);

      if (input.include_stats) {
        const entriesWithStats = await Promise.all(
          entries.map(async (entry) => {
            const entryPath = join(absolutePath, entry);
            const stats = await stat(entryPath);
            return {
              name: entry,
              type: stats.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              modified: stats.mtime,
            };
          })
        );
        return {
          path: absolutePath,
          entries: entriesWithStats,
        };
      }

      return {
        path: absolutePath,
        entries: entries.map(name => ({ name })),
      };
    } catch (error) {
      return {
        path: input.path,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
