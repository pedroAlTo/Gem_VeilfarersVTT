import { defineConfig } from 'vite';
import { lanSessions } from './scripts/lan-sessions.mjs';

export default defineConfig({
  plugins: [lanSessions()],
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
