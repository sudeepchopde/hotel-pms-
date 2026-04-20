import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const keyPath = path.resolve(__dirname, 'certs/key.pem');
  const certPath = path.resolve(__dirname, 'certs/cert.pem');
  const hasHttpsCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);
  return {
    plugins: [react()],
    server: {
      port: 3001,
      host: '0.0.0.0',
      strictPort: true,
      https: hasHttpsCerts
        ? {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
          }
        : false,
      proxy: {
        // Only match /api/ paths, not /api.ts
        '^/api/': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1000, // Increase limit to 1000kb to suppress warnings
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities', '@dnd-kit/modifiers'],
          }
        }
      }
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
