import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiPort = process.env.AGENT_TEAM_API_PORT || '5179'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api/agent-team': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
})
