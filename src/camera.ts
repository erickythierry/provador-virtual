// Acesso à câmera via getUserMedia. Lembre: exige contexto seguro (HTTPS
// ou localhost) — no celular em http://IP a câmera NÃO abre.

export type Facing = "user" | "environment";

export class CameraError extends Error {
  constructor(
    message: string,
    readonly kind: "denied" | "notfound" | "insecure" | "unknown",
  ) {
    super(message);
  }
}

let currentStream: MediaStream | null = null;

export function stopCamera(): void {
  currentStream?.getTracks().forEach((t) => t.stop());
  currentStream = null;
}

export async function startCamera(
  video: HTMLVideoElement,
  facing: Facing,
): Promise<void> {
  if (!window.isSecureContext) {
    throw new CameraError(
      "A câmera só funciona em HTTPS. Veja o README para testar no celular.",
      "insecure",
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError("Câmera não suportada neste navegador.", "unknown");
  }

  stopCamera();
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 1280 },
      },
    });
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new CameraError(
        "Permissão de câmera negada. Libere o acesso e recarregue.",
        "denied",
      );
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      throw new CameraError("Nenhuma câmera disponível.", "notfound");
    }
    throw new CameraError("Não foi possível abrir a câmera.", "unknown");
  }

  video.srcObject = currentStream;
  await video.play().catch(() => {
    /* alguns navegadores exigem gesto; o autoplay+muted cobre a maioria */
  });
  await new Promise<void>((resolve) => {
    if (video.readyState >= 2) resolve();
    else video.onloadeddata = () => resolve();
  });
}

/** Captura o frame atual do vídeo num canvas (resolução nativa do vídeo). */
export function grabFrame(
  video: HTMLVideoElement,
  mirror = false,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  const ctx = c.getContext("2d")!;
  if (mirror) {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0);
  return c;
}
