import { readdirSync, rmSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, 'src');
const distDir = resolve(__dirname, 'dist');

// Clean dist
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

// Find all HTML entry points
const htmlFiles = readdirSync(srcDir).filter(f => f.endsWith('.html'));
console.log(`Building ${htmlFiles.length} apps: ${htmlFiles.join(', ')}`);

for (const file of htmlFiles) {
  console.log(`\n--- Building ${file} ---`);
  execSync(`ENTRY=${file} npx vite build`, {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, ENTRY: file },
  });
}

console.log(`\nAll ${htmlFiles.length} apps built successfully.`);
