import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // Swap the SPA's HTTP baseQuery for the webview's postMessage-backed one.
      {
        find: /^@\/features\/graph\/slices\/graphApiBaseQuery$/,
        replacement: path.resolve(__dirname, 'src/webview/webviewBaseQuery.ts'),
      },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
  define: {
    // The webview never reads VITE_API_URL, but its build passes through
    // graphApiSlice.ts which used to reference it. The alias above replaces
    // the file entirely — this define is a belt-and-suspenders stub.
    'import.meta.env.VITE_API_URL': JSON.stringify(''),
  },
  build: {
    outDir: 'dist-webview',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.webview.html'),
    },
  },
});
