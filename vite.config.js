import { defineConfig } from 'vite';
import { adversaryLibraryPlugin } from './scripts/adversary-library.mjs';
import { encounterLibraryPlugin } from './scripts/encounter-library.mjs';
import { lanSessions } from './scripts/lan-sessions.mjs';

export default defineConfig({
  plugins: [lanSessions(), adversaryLibraryPlugin(), encounterLibraryPlugin()],
  resolve: {
    alias: {
      peerjs: 'peerjs/dist/bundler.cjs',
    },
  },
  server: { allowedHosts: ['terminal.local'] },
  build: {
    rollupOptions: {
      input: { main: 'index.html', fxLab: 'fx-lab.html' },
      output: {
        // Vendor code changes far less often than the app, so it is cached separately.
        // Firestore is left out on purpose: it stays in its own on-demand chunk.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('node_modules/gsap/')) return 'animation';
          if (id.includes('node_modules/peerjs/')) return 'network';
          if (id.includes('node_modules/dompurify/')) return 'sanitize';
          if (id.includes('node_modules/@firebase/database/')) return 'firebase-rtdb';
          if (/node_modules\/@firebase\/(app|auth|util|component|logger)\//.test(id)) return 'firebase-core';
        },
      },
    },
  },
});
