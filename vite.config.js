import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app lives under /greendays on lab.ryantnance.com. The build lands in
// dist/greendays so the Workers assets binding (directory ./dist) serves it
// at the matching URL path.
export default defineConfig({
  base: '/greendays/',
  plugins: [react()],
  build: {
    outDir: 'dist/greendays',
    emptyOutDir: true,
  },
});
