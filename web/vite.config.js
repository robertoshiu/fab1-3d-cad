export default {
  base: './',
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  build: {
    target: 'es2022', chunkSizeWarningLimit: 900,
    rolldownOptions: { output: { manualChunks(id) {
      if (id.includes('/node_modules/three/')) return 'three';
      if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
    } } }
  }
};
