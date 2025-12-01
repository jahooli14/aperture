import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const compiled = [];

function compileFile(filePath) {
  const jsPath = filePath.replace(/\.ts$/, '.js');
  const relativePath = path.relative(process.cwd(), filePath);

  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const result = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX
      }
    });

    // Add .js extensions to imports after compilation
    let jsCode = result.outputText;
    // Replace imports like: from './path' with from './path.js'
    jsCode = jsCode.replace(/from\s+['"](\.[^'"]+)['"]/g, (match) => {
      if (match.includes('.js\'') || match.includes('.js"') || match.includes('.json')) {
        return match; // Already has extension
      }
      // Insert .js before the closing quote
      return match.slice(0, -1) + '.js' + match.slice(-1);
    });

    fs.writeFileSync(jsPath, jsCode, 'utf8');
    compiled.push(relativePath + ' → ' + path.relative(process.cwd(), jsPath));

    // Remove the original .ts file to avoid conflicts with Vercel
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error(`Failed to compile ${relativePath}:`, error.message);
    process.exit(1);
  }
}

function compileDirectory(dir) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
      compileDirectory(fullPath);
    } else if (file.isFile() && file.name.endsWith('.ts') && !file.name.endsWith('.d.ts')) {
      compileFile(fullPath);
    }
  }
}

console.log('Compiling TypeScript API and lib files...');
const dirs = ['api', 'lib', 'scripts'];
dirs.forEach(compileDirectory);
console.log(`✓ Compiled ${compiled.length} files:`);
compiled.forEach(f => console.log(`  ${f}`));
