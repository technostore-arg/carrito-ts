import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
export default defineConfig({
  plugins: [react()],
  base: "/futurohard/",
  root: __dirname,
  build: { outDir: path.join(__dirname, 'dist') },
  server: { proxy: { '/api': 'http://localhost:3001' } },
})
