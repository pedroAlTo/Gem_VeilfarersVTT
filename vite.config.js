import { defineConfig } from 'vite';

export default defineConfig({
  server: { allowedHosts: ['terminal.local'] },
  build: {
    rollupOptions: {
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
