// Editor da máscara: mostra a foto com a área da roupa destacada e deixa
// o usuário corrigir com pincel (adicionar/remover) antes de "assar" o
// recorte final (cutout) usado no provador.

type Tool = "add" | "remove";

export class MaskEditor {
  private view: HTMLCanvasElement;
  private vctx: CanvasRenderingContext2D;
  /** Máscara em resolução da foto: alpha = "é roupa". */
  private mask: HTMLCanvasElement;
  private mctx: CanvasRenderingContext2D;

  private tool: Tool = "add";
  private brush = 28;
  private drawing = false;
  private last: { x: number; y: number } | null = null;
  /** Linha de corte (fração 0..1 da altura). Roupa abaixo dela é descartada
   *  — serve para ignorar a calça e ficar só com a camisa. 1 = sem corte. */
  private cutY = 0.6;

  constructor(
    view: HTMLCanvasElement,
    private photo: HTMLCanvasElement,
    initialMask: ImageData,
  ) {
    this.view = view;
    this.view.width = photo.width;
    this.view.height = photo.height;
    this.vctx = view.getContext("2d")!;

    this.mask = document.createElement("canvas");
    this.mask.width = photo.width;
    this.mask.height = photo.height;
    this.mctx = this.mask.getContext("2d")!;
    this.mctx.putImageData(initialMask, 0, 0);

    this.bindPointer();
    this.render();
  }

  setTool(tool: Tool): void {
    this.tool = tool;
  }
  setBrush(size: number): void {
    this.brush = size;
  }
  /** `frac` 0..1 (0 = topo, 1 = sem corte). */
  setCutLine(frac: number): void {
    this.cutY = Math.max(0, Math.min(1, frac));
    this.render();
  }
  resetMask(mask: ImageData): void {
    this.mctx.clearRect(0, 0, this.mask.width, this.mask.height);
    this.mctx.putImageData(mask, 0, 0);
    this.render();
  }

  private toPhoto(e: PointerEvent): { x: number; y: number } {
    const r = this.view.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * this.view.width,
      y: ((e.clientY - r.top) / r.height) * this.view.height,
    };
  }

  private bindPointer(): void {
    this.view.addEventListener("pointerdown", (e) => {
      this.view.setPointerCapture(e.pointerId);
      this.drawing = true;
      this.last = this.toPhoto(e);
      this.paint(this.last);
    });
    this.view.addEventListener("pointermove", (e) => {
      if (!this.drawing) return;
      const p = this.toPhoto(e);
      this.paint(p);
      this.last = p;
    });
    const end = () => {
      this.drawing = false;
      this.last = null;
    };
    this.view.addEventListener("pointerup", end);
    this.view.addEventListener("pointercancel", end);
  }

  private paint(p: { x: number; y: number }): void {
    const ctx = this.mctx;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = this.brush * 2;
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.globalCompositeOperation =
      this.tool === "add" ? "source-over" : "destination-out";
    ctx.beginPath();
    if (this.last) {
      ctx.moveTo(this.last.x, this.last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, this.brush, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.render();
  }

  private tint = document.createElement("canvas");

  private render(): void {
    const { width: w, height: h } = this.view;
    this.vctx.clearRect(0, 0, w, h);
    this.vctx.drawImage(this.photo, 0, 0);

    // Destaque azul translúcido com o mesmo recorte da máscara.
    this.tint.width = w;
    this.tint.height = h;
    const t = this.tint.getContext("2d")!;
    t.clearRect(0, 0, w, h);
    t.drawImage(this.mask, 0, 0);
    t.globalCompositeOperation = "source-in";
    t.fillStyle = "#4f8cff";
    t.fillRect(0, 0, w, h);
    // Descarta visualmente a roupa abaixo da linha de corte (calça).
    const lineY = Math.round(this.cutY * h);
    t.globalCompositeOperation = "destination-out";
    t.fillRect(0, lineY, w, h - lineY);

    this.vctx.save();
    this.vctx.globalAlpha = 0.5;
    this.vctx.drawImage(this.tint, 0, 0);
    this.vctx.restore();

    // Guia da linha de corte.
    if (this.cutY < 1) {
      this.vctx.save();
      this.vctx.strokeStyle = "#ffcc00";
      this.vctx.lineWidth = Math.max(2, Math.round(h * 0.004));
      this.vctx.setLineDash([12, 10]);
      this.vctx.beginPath();
      this.vctx.moveTo(0, lineY);
      this.vctx.lineTo(w, lineY);
      this.vctx.stroke();
      this.vctx.restore();
    }
  }

  /**
   * Produz o overlay final: a foto com a região da roupa transparente
   * (com borda suavizada/feather para o efeito ficar natural).
   */
  bakeCutout(): HTMLCanvasElement {
    const w = this.photo.width;
    const h = this.photo.height;

    // Máscara suavizada para feather das bordas.
    const blurred = document.createElement("canvas");
    blurred.width = w;
    blurred.height = h;
    const bctx = blurred.getContext("2d")!;
    bctx.filter = `blur(${Math.max(2, Math.round(w * 0.004))}px)`;
    bctx.drawImage(this.mask, 0, 0);
    // Aplica a linha de corte: zera a roupa abaixo dela (descarta a calça).
    const lineY = Math.round(this.cutY * h);
    if (lineY < h) {
      bctx.filter = "none";
      bctx.globalCompositeOperation = "destination-out";
      bctx.fillRect(0, lineY, w, h - lineY);
    }
    const maskData = bctx.getImageData(0, 0, w, h).data;

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const octx = out.getContext("2d")!;
    octx.drawImage(this.photo, 0, 0);
    const img = octx.getImageData(0, 0, w, h);
    const px = img.data;
    for (let i = 0; i < maskData.length; i += 4) {
      // alpha do recorte = 255 - alpha da máscara (roupa vira buraco)
      const cut = maskData[i + 3];
      px[i + 3] = Math.min(px[i + 3], 255 - cut);
    }
    octx.putImageData(img, 0, 0);
    return out;
  }
}
