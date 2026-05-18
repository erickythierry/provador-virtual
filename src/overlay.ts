// Tela do provador: a câmera traseira fica num <video> ao fundo e o
// recorte (foto com buraco) num <canvas> por cima. Onde o recorte é
// transparente, enxerga-se a roupa real ao vivo. Gestos: 1 dedo move,
// 2 dedos dão zoom (pinça).

interface Placement {
  scale: number; // px de tela por px da foto
  ox: number; // posição na tela (x) do canto (0,0) da foto
  oy: number;
}

export class FitView {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 3);
  private place: Placement = { scale: 1, ox: 0, oy: 0 };
  private opacity = 1;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchPrev: { dist: number; cx: number; cy: number } | null = null;
  private ro: ResizeObserver;

  constructor(
    private canvas: HTMLCanvasElement,
    private video: HTMLVideoElement,
    private cutout: HTMLCanvasElement,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.bindGestures();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
  }

  destroy(): void {
    this.ro.disconnect();
  }

  /** Largura/altura da viewport em px CSS. */
  private get vw(): number {
    return this.canvas.clientWidth;
  }
  private get vh(): number {
    return this.canvas.clientHeight;
  }

  private resize(): void {
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.reset();
  }

  /** Centraliza a foto na tela (fit "contain"). */
  reset(): void {
    const s = Math.min(
      this.vw / this.cutout.width,
      this.vh / this.cutout.height,
    );
    this.place = {
      scale: s,
      ox: (this.vw - this.cutout.width * s) / 2,
      oy: (this.vh - this.cutout.height * s) / 2,
    };
    this.render();
  }

  setOpacity(v: number): void {
    this.opacity = v;
    this.canvas.style.opacity = String(v);
  }

  private bindGestures(): void {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    c.addEventListener("pointermove", (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const prev = this.pointers.get(e.pointerId)!;
      const cur = { x: e.clientX, y: e.clientY };
      this.pointers.set(e.pointerId, cur);

      const pts = [...this.pointers.values()];
      if (pts.length === 1) {
        this.place.ox += cur.x - prev.x;
        this.place.oy += cur.y - prev.y;
        this.pinchPrev = null;
      } else if (pts.length >= 2) {
        const [a, b] = pts;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        if (this.pinchPrev) {
          const ratio = dist / this.pinchPrev.dist || 1;
          // zoom em torno do ponto médio dos dedos
          this.place.scale *= ratio;
          this.place.ox = cx - (this.pinchPrev.cx - this.place.ox) * ratio;
          this.place.oy = cy - (this.pinchPrev.cy - this.place.oy) * ratio;
        }
        this.pinchPrev = { dist, cx, cy };
      }
      this.render();
    });
    const end = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      this.pinchPrev = null;
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.vw, this.vh);
    ctx.translate(this.place.ox, this.place.oy);
    ctx.scale(this.place.scale, this.place.scale);
    ctx.drawImage(this.cutout, 0, 0);
  }

  /**
   * Compõe câmera + recorte (com o mesmo enquadramento e opacidade) num
   * canvas no tamanho da tela. Usado para salvar a combinação.
   */
  composite(): HTMLCanvasElement {
    const out = document.createElement("canvas");
    out.width = Math.round(this.vw * this.dpr);
    out.height = Math.round(this.vh * this.dpr);
    const ctx = out.getContext("2d")!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Câmera ao fundo, com "object-fit: cover".
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (vw && vh) {
      const cover = Math.max(this.vw / vw, this.vh / vh);
      const dw = vw * cover;
      const dh = vh * cover;
      ctx.drawImage(
        this.video,
        (this.vw - dw) / 2,
        (this.vh - dh) / 2,
        dw,
        dh,
      );
    }

    // Recorte por cima, mesma transformação e opacidade.
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.translate(this.place.ox, this.place.oy);
    ctx.scale(this.place.scale, this.place.scale);
    ctx.drawImage(this.cutout, 0, 0);
    ctx.restore();
    return out;
  }
}
