import fs from 'fs';
import path from 'path';

function deleteTypeScriptFiles(dir) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
      deleteTypeScriptFiles(fullPath);
    } else if (file.isFile() && file.name.endsWith('.ts') && !file.name.endsWith('.d.ts')) {
      try {
        fs.unlinkSync(fullPath);
        console.log(`Deleted: ${fullPath}`);
      } catch (error) {
        console.error(`Failed to delete ${fullPath}:`, error.message);
      }
    }
  }
}

console.log('Cleaning up TypeScript source files...');
const dirs = ['api', 'lib', 'scripts'];
dirs.forEach(deleteTypeScriptFiles);
console.log('✓ Cleanup complete');
