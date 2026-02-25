import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || '')
  },
  build: {
    target: 'esnext',
    outDir: 'dist'
  },
  server: {
    port: 8080
  }
});