import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readdirSync } from 'fs';
import { resolve } from 'path';

// Auto-discover all .html files in src/
const srcDir = resolve(__dirname, 'src');
const htmlFiles = readdirSync(srcDir).filter(f => f.endsWith('.html'));

// Determine which single entry to build (set via ENTRY env var)
// If not set, use the first file found (for single-build mode)
const entry = process.env.ENTRY;

const getInput = () => {
  if (entry) {
    return { [entry.replace('.html', '')]: resolve(srcDir, entry) };
  }
  // Single entry mode for vite-plugin-singlefile compatibility
  if (htmlFiles.length === 1) {
    return { [htmlFiles[0].replace('.html', '')]: resolve(srcDir, htmlFiles[0]) };
  }
  // Multi-entry without singlefile
  return htmlFiles.reduce((entries, file) => {
    entries[file.replace('.html', '')] = resolve(srcDir, file);
    return entries;
  }, {} as Record<string, string>);
};

export default defineConfig({
  plugins: entry || htmlFiles.length === 1 ? [viteSingleFile()] : [],
  root: 'src',
  build: {
    outDir: '../dist',
    emptyDirBeforeWrite: !entry, // Only empty on first build
    rollupOptions: {
      input: getInput(),
    },
  },
});
