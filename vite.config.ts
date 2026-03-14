import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/RC_NG/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
