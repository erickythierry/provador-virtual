import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import basicSsl from "@vitejs/plugin-basic-ssl";

// HTTPS é obrigatório para getUserMedia no celular (fora de localhost).
// `npm run dev:https` define HTTPS=1 e ativa um certificado autoassinado;
// como alternativa use um túnel (cloudflared/ngrok). Veja o README.
const httpsDev = process.env.HTTPS === "1";

export default defineConfig({
  server: {
    host: true,
    // Túneis (cloudflared/ngrok) usam subdomínios aleatórios; libera o
    // bloqueio de host do Vite para conseguir testar no celular via HTTPS.
    allowedHosts: true,
  },
  plugins: [
    ...(httpsDev ? [basicSsl()] : []),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      // O modelo e o wasm do MediaPipe ficam em /models e /wasm.
      // Precache deles permite uso offline depois da 1ª carga.
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,wasm,tflite,task}"],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },
      manifest: {
        name: "Provador Virtual",
        short_name: "Provador",
        description:
          "Veja como uma roupa da loja ficaria em você usando a câmera do celular.",
        theme_color: "#111111",
        background_color: "#111111",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
