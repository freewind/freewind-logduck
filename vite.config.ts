import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = {
  '/api': 'http://127.0.0.1:52743',
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 52742,
    strictPort: true,
    proxy,
  },
  preview: {
    port: 52742,
    strictPort: true,
    proxy,
  },
});
