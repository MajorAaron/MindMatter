import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        listing: resolve(__dirname, 'listing.html'),
        listings: resolve(__dirname, 'listings.html'),
        testImageStorage: resolve(__dirname, 'test-image-storage.html'),
        previewSummary: resolve(__dirname, 'preview-summary.html'),
        addItem: resolve(__dirname, 'add-item.html'),
        404: resolve(__dirname, '404.html')
      }
    }
  }
}); 