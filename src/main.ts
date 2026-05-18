import "./style.css";
import { startCamera, stopCamera, grabFrame, CameraError } from "./camera";
import { segmentClothes, warmUpSegmenter } from "./segmentation";
import { MaskEditor } from "./maskEditor";
import { FitView } from "./overlay";
import { saveCombination } from "./capture";
import { state, showScreen, toast } from "./state";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const MAX_DIM = 1280; // limita resolução da foto p/ desempenho no celular

function imageToCanvas(
  src: CanvasImageSource & { width: number; height: number },
  w: number,
  h: number,
): HTMLCanvasElement {
  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// ---------------- Tela 1: captura / upload ----------------
const captureVideo = $<HTMLVideoElement>("capture-video");
let captureFacing: "user" | "environment" = "user";

async function openCaptureCamera(): Promise<void> {
  try {
    await startCamera(captureVideo, captureFacing);
  } catch (err) {
    if (err instanceof CameraError) {
      toast(err.message, 5000);
      $("capture-hint").textContent =
        err.kind === "insecure"
          ? "Abra o app por HTTPS para usar a câmera (veja o README)."
          : err.message;
    } else {
      toast("Erro ao abrir a câmera.");
    }
  }
}

$("flip-cam-btn").addEventListener("click", () => {
  captureFacing = captureFacing === "user" ? "environment" : "user";
  openCaptureCamera();
});

$("shoot-btn").addEventListener("click", () => {
  if (!captureVideo.videoWidth) {
    toast("Câmera ainda não está pronta.");
    return;
  }
  const frame = grabFrame(captureVideo, captureFacing === "user");
  usePhoto(imageToCanvas(frame, frame.width, frame.height));
});

$<HTMLInputElement>("file-input").addEventListener("change", (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    usePhoto(imageToCanvas(img, img.naturalWidth, img.naturalHeight));
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => toast("Não foi possível ler a imagem.");
  img.src = URL.createObjectURL(file);
});

// ---------------- Tela 2: máscara ----------------
let editor: MaskEditor | null = null;

async function usePhoto(photo: HTMLCanvasElement): Promise<void> {
  state.photo = photo;
  stopCamera();
  showScreen("mask");
  toast("Detectando a roupa…", 4000);
  try {
    const mask = await segmentClothes(photo);
    state.mask = mask;
    editor = new MaskEditor($("mask-canvas"), photo, mask);
    toast("Pronto! Ajuste o recorte se precisar.");
  } catch (err) {
    console.error(err);
    toast("Não consegui detectar automaticamente. Pinte a roupa manualmente.", 5000);
    const empty = new ImageData(photo.width, photo.height);
    state.mask = empty;
    editor = new MaskEditor($("mask-canvas"), photo, empty);
  }
  // Aplica a posição atual do slider de linha de corte à nova foto.
  editor.setCutLine(Number($<HTMLInputElement>("cut-line").value) / 100);
}

function setTool(tool: "add" | "remove"): void {
  editor?.setTool(tool);
  $("tool-add").classList.toggle("active", tool === "add");
  $("tool-remove").classList.toggle("active", tool === "remove");
}
$("tool-add").addEventListener("click", () => setTool("add"));
$("tool-remove").addEventListener("click", () => setTool("remove"));
$<HTMLInputElement>("brush-size").addEventListener("input", (e) =>
  editor?.setBrush(Number((e.target as HTMLInputElement).value)),
);
$<HTMLInputElement>("cut-line").addEventListener("input", (e) =>
  editor?.setCutLine(Number((e.target as HTMLInputElement).value) / 100),
);
$("mask-reset").addEventListener("click", async () => {
  if (!state.photo) return;
  toast("Detectando novamente…");
  try {
    const mask = await segmentClothes(state.photo);
    editor?.resetMask(mask);
  } catch {
    toast("Falha ao detectar. Continue manualmente.");
  }
});
$("mask-back").addEventListener("click", () => {
  showScreen("capture");
  openCaptureCamera();
});
$("mask-confirm").addEventListener("click", () => {
  if (!editor) return;
  state.cutout = editor.bakeCutout();
  goToFit();
});

// ---------------- Tela 3: provador ----------------
const fitVideo = $<HTMLVideoElement>("fit-video");
let fitView: FitView | null = null;

async function goToFit(): Promise<void> {
  showScreen("fit");
  try {
    await startCamera(fitVideo, "environment");
  } catch (err) {
    const msg =
      err instanceof CameraError ? err.message : "Erro ao abrir a câmera.";
    toast(msg, 5000);
  }
  fitView?.destroy();
  fitView = new FitView($("overlay-canvas"), fitVideo, state.cutout!);
  const op = $<HTMLInputElement>("opacity-range");
  fitView.setOpacity(Number(op.value) / 100);
  toast("Aponte para a roupa. 1 dedo move, 2 dedos dão zoom.", 4000);
}

$<HTMLInputElement>("opacity-range").addEventListener("input", (e) =>
  fitView?.setOpacity(Number((e.target as HTMLInputElement).value) / 100),
);
$("reset-transform").addEventListener("click", () => fitView?.reset());
$("capture-btn").addEventListener("click", async () => {
  if (!fitView) return;
  try {
    await saveCombination(fitView.composite());
  } catch {
    toast("Não foi possível salvar a imagem.");
  }
});
$("fit-back").addEventListener("click", () => {
  stopCamera();
  fitView?.destroy();
  fitView = null;
  showScreen("capture");
  openCaptureCamera();
});

// ---------------- Bootstrap ----------------
showScreen("capture");
openCaptureCamera();
warmUpSegmenter();
