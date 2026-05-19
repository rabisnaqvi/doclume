import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const DEV_HMR_CONNECT_SRC =
  "'self' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*";

/** Widen connect-src for Vite HMR in dev; production build keeps index.html strict. */
function cspDevHmr(): Plugin {
  return {
    name: 'doclume-csp-dev-hmr',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!ctx.server) return html;
        return html.replace(
          /connect-src\s+[^;]+;/,
          `connect-src ${DEV_HMR_CONNECT_SRC};`,
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), cspDevHmr()],
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
