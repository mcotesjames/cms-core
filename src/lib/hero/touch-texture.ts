import { CanvasTexture } from "three";

type Point = { x: number; y: number; age: number; force: number; vx: number; vy: number };

/** Theme's 64px velocity trail, with age normalized to 60fps. */
export class TouchTexture {
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private trail: Point[] = [];
  private last: { x: number; y: number } | null = null;
  private readonly size = 64;
  private readonly maxAge = 64;
  private readonly radius = 16;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = this.size;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to create gradient interaction texture");
    this.ctx = ctx;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, this.size, this.size);
    this.texture = new CanvasTexture(this.canvas);
  }

  addTouch(point: { x: number; y: number }) {
    let force = 0,
      vx = 0,
      vy = 0;
    if (this.last) {
      const dx = point.x - this.last.x,
        dy = point.y - this.last.y;
      const dd = dx * dx + dy * dy;
      if (!dd) return;
      const d = Math.sqrt(dd);
      vx = dx / d;
      vy = dy / d;
      force = Math.min(dd * 10000, 1);
    }
    this.last = { ...point };
    this.trail.push({ ...point, age: 0, force, vx, vy });
  }

  update(delta: number) {
    const frames = Math.min(delta, 0.1) * 60;
    this.ctx.shadowColor = "transparent";
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.size, this.size);
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const point = this.trail[i];
      if (!point) continue;
      const f = (point.force / this.maxAge) * (1 - point.age / this.maxAge);
      point.x += point.vx * f * frames;
      point.y += point.vy * f * frames;
      point.age += frames;
      if (point.age > this.maxAge) this.trail.splice(i, 1);
      else this.drawPoint(point);
    }
    this.texture.needsUpdate = true;
  }

  private drawPoint(point: Point) {
    const pos = { x: point.x * this.size, y: (1 - point.y) * this.size };
    const fade = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
    let intensity =
      point.age < this.maxAge * 0.3
        ? Math.sin(((point.age / (this.maxAge * 0.3)) * Math.PI) / 2)
        : -fade * (fade - 2);
    intensity *= point.force;
    const color = `${((point.vx + 1) / 2) * 255}, ${((point.vy + 1) / 2) * 255}, ${intensity * 255}`;
    const offset = this.size * 5;
    this.ctx.shadowOffsetX = this.ctx.shadowOffsetY = offset;
    this.ctx.shadowBlur = this.radius;
    this.ctx.shadowColor = `rgba(${color}, ${0.2 * intensity})`;
    this.ctx.beginPath();
    // RGB values here encode velocity/intensity data, not display colors.
    this.ctx.fillStyle = "rgba(255,0,0,1)";
    this.ctx.arc(pos.x - offset, pos.y - offset, this.radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  dispose() {
    this.texture.dispose();
  }
}
