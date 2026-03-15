import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
   define: {
    global: "globalThis",
    'process.env': {},
  },
  optimizeDeps: {
    include: ['pouchdb'],
  },
  resolve: {
    alias: {
      'pouchdb': 'pouchdb/dist/pouchdb.js'  // force the pre-built bundle
    }
  }
})
