import { defineConfig } from 'vite';
import { adversaryLibraryPlugin } from './scripts/adversary-library.mjs';
import { encounterLibraryPlugin } from './scripts/encounter-library.mjs';
import { lanSessions } from './scripts/lan-sessions.mjs';

export default defineConfig({
  plugins: [lanSessions(), adversaryLibraryPlugin(), encounterLibraryPlugin()],
  server: { allowedHosts: ['terminal.local'] },
  build: {
    rollupOptions: {
      input: { main: 'index.html', fxLab: 'fx-lab.html' },
      output: {
        manualChunks: {
          animation: ['gsap'],
          network: ['peerjs'],
          sanitize: ['dompurify'],
        },
      },
    },
  },
});
