import { defineConfig } from 'vite';

export default defineConfig({
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
