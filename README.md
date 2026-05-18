# Provador Virtual

Webapp mobile que recria, de forma digital, o "provador em RA analógico": você
tira uma foto sua, o app **recorta a região da roupa** (deixa transparente) e usa
a **câmera traseira** do celular para preencher esse buraco com a roupa real da
loja. Apontando o celular para uma arara, você vê na hora como aquela cor/estampa
ficaria em você — sem ir ao provador.

Tudo roda **no navegador**: nenhuma foto sai do aparelho. Funciona como PWA
instalável e offline depois da primeira carga.

> Conceito original em [`ideia.md`](./ideia.md) e [`especificacao.md`](./especificacao.md).

## Stack

- **Vite + TypeScript** (sem framework)
- **[@mediapipe/tasks-vision](https://ai.google.dev/edge/mediapipe)** — segmentação
  de roupa no próprio dispositivo (modelo `selfie_multiclass_256x256`)
- **vite-plugin-pwa** — manifest + service worker (precache do app e do modelo)

## Como funciona

1. **Foto** — selfie pela câmera frontal ou upload de uma imagem.
2. **Máscara** — a IA detecta a roupa (classe *clothes* do modelo). Como o modelo
   não separa camisa de calça, há uma **linha de corte ajustável** (slider) para
   descartar a calça e ficar só com a parte de cima. Pincel *adicionar/remover*
   para acertos finos.
3. **Provador** — câmera traseira ao fundo, sua foto recortada por cima. **1 dedo
   move, 2 dedos dão zoom** (pinça); slider ajusta a opacidade.
4. **Salvar** — gera um PNG da combinação (Web Share API ou download).

## Rodando localmente

```bash
npm install     # baixa o modelo (~16 MB) e copia o wasm p/ public/ (postinstall)
npm run dev      # http://localhost:5173  — a câmera funciona em localhost
```

Se o modelo/wasm não baixarem no install, rode `npm run fetch-assets`.

## ⚠️ Testando no celular (precisa de HTTPS)

`getUserMedia` (câmera) **só funciona em contexto seguro**. No desktop,
`localhost` já é seguro; mas abrir `http://192.168.x.x:5173` no celular **não
abre a câmera**. Use uma das opções:

**A) HTTPS local (certificado autoassinado):**

```bash
npm run dev:https
```

Acesse `https://192.168.x.x:5173` no celular e aceite o aviso de certificado
(é autoassinado — normal em desenvolvimento).

**B) Túnel público HTTPS (sem aviso de certificado):**

```bash
npm run dev
# em outro terminal:
npx cloudflared tunnel --url http://localhost:5173
# ou: npx ngrok http 5173
```

Abra a URL `https://…` gerada no navegador do celular. (O dev server já libera
hosts de túnel via `server.allowedHosts`.)

## Build de produção

```bash
npm run build    # gera dist/ com service worker e manifest
npm run preview   # serve o build (use HTTPS/túnel p/ testar no celular)
```

Publique o conteúdo de `dist/` em qualquer hosting estático **com HTTPS**
(Netlify, Vercel, Cloudflare Pages, GitHub Pages…).

## Estrutura

```
src/
  main.ts          # roteamento das telas e fiação da UI
  camera.ts        # getUserMedia (frontal/traseira), permissões
  segmentation.ts  # MediaPipe ImageSegmenter -> máscara da roupa
  maskEditor.ts    # ajuste manual + linha de corte; "assa" o recorte (cutout)
  overlay.ts       # provador: vídeo + recorte, gestos, composição p/ captura
  capture.ts       # salvar/compartilhar PNG
  state.ts         # estado compartilhado + troca de tela + toast
scripts/
  fetch-assets.mjs # baixa modelo, copia wasm, gera ícones (roda no postinstall)
```

O modelo, o runtime wasm e os ícones **não são versionados** (ver `.gitignore`):
são regenerados pelo `postinstall`. Um `npm install` após o clone basta.

## Limitações conhecidas

- O modelo tem uma única classe "roupa" — não distingue camisa de calça; daí a
  linha de corte + ajuste manual fazerem parte do fluxo.
- A precisão da detecção varia com luz e pose.
- iOS Safari: exige HTTPS e gesto do usuário para a câmera; compartilhar arquivo
  tem suporte parcial (cai para download).
- Primeira carga baixa ~16 MB do modelo (depois fica em cache pela PWA).

## Publicando no GitHub

```bash
git init
git add .
git commit -m "Provador Virtual: webapp de provador virtual com câmera"
git branch -M main
git remote add origin git@github.com:SEU_USUARIO/provador-virtual.git
git push -u origin main
```

## Licença

[MIT](./LICENSE).
