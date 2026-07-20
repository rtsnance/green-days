import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app lives at the root of its own domain, greendays.day. The build lands
// in dist/ so the Workers assets binding (directory ./dist) serves it at the
// matching URL path.
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
