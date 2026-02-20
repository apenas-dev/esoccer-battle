import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [
    react(),
    electron([
      {
        entry: resolve(__dirname, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: resolve(__dirname, 'dist-electron/main'),
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: '[name].js'
              }
            }
          }
        }
      },
      {
        entry: resolve(__dirname, 'src/preload/index.ts'),
        vite: {
          build: {
            outDir: resolve(__dirname, 'dist-electron/preload'),
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: '[name].js'
              }
            }
          }
        },
        onstart(options) {
          options.reload()
        }
      }
    ]),
    renderer()
  ],
  build: {
    outDir: resolve(__dirname, 'dist-electron/renderer'),
    emptyOutDir: true
  },
  server: {
    port: 5173
  }
})
