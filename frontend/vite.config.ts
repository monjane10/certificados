import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Porta fixa: tem de coincidir com CLIENT_ORIGIN do backend (CORS). Se a 5173
  // estiver ocupada, o Vite falha em vez de mudar de porta em silêncio.
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
});
