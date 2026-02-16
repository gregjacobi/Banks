import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readdirSync } from 'fs';
import { resolve } from 'path';

// Auto-discover all .html files in src/
const srcDir = resolve(__dirname, 'src');
const htmlFiles = readdirSync(srcDir)
  .filter(f => f.endsWith('.html'))
  .reduce((entries, file) => {
    entries[file.replace('.html', '')] = resolve(srcDir, file);
    return entries;
  }, {} as Record<string, string>);

export default defineConfig({
  plugins: [viteSingleFile()],
  root: 'src',
  build: {
    outDir: '../dist',
    emptyDirBeforeWrite: true,
    rollupOptions: {
      input: htmlFiles,
    },
  },
});
