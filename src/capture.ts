// Salva/compartilha a combinação. Web Share API (com arquivo) quando
// disponível; senão, download do PNG.
import { toast } from "./state";

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem."))),
      "image/png",
    );
  });
}

export async function saveCombination(canvas: HTMLCanvasElement): Promise<void> {
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], `provador-${Date.now()}.png`, {
    type: "image/png",
  });

  if (
    navigator.canShare?.({ files: [file] }) &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({ files: [file], title: "Provador Virtual" });
      return;
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      // qualquer outra falha cai no download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  toast("Imagem salva.");
}
