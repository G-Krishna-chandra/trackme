import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env (prefix '') so we can read HEVY_API_KEY, which deliberately has
  // NO `VITE_` prefix and is therefore never bundled into client code.
  const env = loadEnv(mode, process.cwd(), '')
  const hevyKey = env.HEVY_API_KEY

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        // The browser only ever calls same-origin /api/hevy/* — the Hevy key
        // is injected here, server-side, and never reaches the client bundle.
        '/api/hevy': {
          target: 'https://api.hevyapp.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/hevy/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Hevy auth is a literal `api-key` header (not a bearer token).
              if (hevyKey) proxyReq.setHeader('api-key', hevyKey)
            })
          },
        },
      },
    },
  }
})
