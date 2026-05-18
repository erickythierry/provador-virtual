// Estado compartilhado entre as telas. Mantido simples de propósito:
// o app tem pouquíssimo estado global e nenhum framework.

export type Screen = "capture" | "mask" | "fit";

export interface AppState {
  /** Foto do usuário capturada/enviada (resolução original). */
  photo: HTMLCanvasElement | null;
  /**
   * Máscara da roupa, mesmo tamanho da foto, 1 canal em alpha.
   * 255 = é roupa (vira buraco transparente); 0 = mantém a foto.
   */
  mask: ImageData | null;
  /** Overlay final "assado": foto com o buraco já recortado (RGBA). */
  cutout: HTMLCanvasElement | null;
}

export const state: AppState = {
  photo: null,
  mask: null,
  cutout: null,
};

export function showScreen(screen: Screen): void {
  for (const el of document.querySelectorAll<HTMLElement>(".screen")) {
    el.classList.toggle("active", el.id === `screen-${screen}`);
  }
}

let toastTimer: number | undefined;
export function toast(message: string, ms = 2600): void {
  const el = document.getElementById("toast")!;
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), ms);
}
