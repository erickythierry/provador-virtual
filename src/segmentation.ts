// Segmentação de roupa no navegador via MediaPipe Tasks Vision.
// Modelo: selfie_multiclass_256x256. Categorias:
// 0 background | 1 hair | 2 body-skin | 3 face-skin | 4 CLOTHES | 5 others
import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from "@mediapipe/tasks-vision";

const CLOTHES_CATEGORY = 4;

let segmenterPromise: Promise<ImageSegmenter> | null = null;

function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      // wasm e modelo são servidos localmente (ver scripts/fetch-assets.mjs),
      // então funcionam offline depois do precache da PWA.
      const vision = await FilesetResolver.forVisionTasks("/wasm");
      return ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/models/selfie_multiclass_256x256.tflite",
        },
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
    })();
  }
  return segmenterPromise;
}

/** Pré-carrega o modelo (útil para esconder a latência da 1ª segmentação). */
export function warmUpSegmenter(): void {
  getSegmenter().catch(() => {
    /* erro tratado quando segmentClothes for chamado */
  });
}

/**
 * Roda a segmentação na foto e devolve uma máscara do tamanho da foto,
 * onde o canal alpha = 255 indica "roupa" (vira buraco) e 0 indica "manter".
 */
export async function segmentClothes(
  photo: HTMLCanvasElement,
): Promise<ImageData> {
  const segmenter = await getSegmenter();
  let result: ImageSegmenterResult | undefined;
  try {
    result = segmenter.segment(photo);
    const cat = result.categoryMask;
    if (!cat) throw new Error("Segmentação não retornou máscara.");

    const mw = cat.width;
    const mh = cat.height;
    const indices = cat.getAsUint8Array(); // 1 byte por pixel = índice da classe

    // Máscara na resolução nativa do modelo.
    const small = new ImageData(mw, mh);
    for (let i = 0; i < indices.length; i++) {
      const isClothes = indices[i] === CLOTHES_CATEGORY ? 255 : 0;
      const o = i * 4;
      small.data[o] = 255;
      small.data[o + 1] = 255;
      small.data[o + 2] = 255;
      small.data[o + 3] = isClothes;
    }

    return scaleMask(small, photo.width, photo.height);
  } finally {
    result?.close();
  }
}

/** Reamostra a máscara para o tamanho da foto preservando o alpha. */
function scaleMask(src: ImageData, w: number, h: number): ImageData {
  const from = document.createElement("canvas");
  from.width = src.width;
  from.height = src.height;
  from.getContext("2d")!.putImageData(src, 0, 0);

  const to = document.createElement("canvas");
  to.width = w;
  to.height = h;
  const ctx = to.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(from, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}
