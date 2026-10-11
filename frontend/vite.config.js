import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// envDir '..' lets a repo-root .env (copied from .env.example) feed VITE_* vars locally.
// On AWS Amplify, set VITE_API_BASE_URL in the app's environment variables instead.
export default defineConfig({
  plugins: [react()],
  envDir: '..',
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 300,
  },
});
