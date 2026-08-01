import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';

interface Particle {
  x: number;
  y: number;
  depth: number;
  size: number;
  colorPrefix: string;
  alpha: number;
  vx: number;
  vy: number;
}

@Component({
  selector: 'app-space-background',
  templateUrl: './space-background.component.html',
  styleUrl: './space-background.component.scss'
})
export class SpaceBackgroundComponent implements AfterViewInit, OnDestroy {
  @ViewChild('spaceCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private particles: Particle[] = [];
  private animationFrameId = 0;
  private readonly particleCount = 220;
  private readonly redPalette = [
    'rgba(163, 13, 17, ',
    'rgba(225, 29, 72, ',
    'rgba(244, 63, 94, ',
    'rgba(255, 77, 77, ',
    'rgba(180, 20, 30, ',
  ];

  ngAfterViewInit(): void {
    this.initCanvas();
    this.renderParticles();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrameId);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    this.width = canvas.width = window.innerWidth;
    this.height = canvas.height = window.innerHeight;
    this.initParticles();
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.width = canvas.width = window.innerWidth;
    this.height = canvas.height = window.innerHeight;
    this.initParticles();
  }

  private initParticles(): void {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      const depth = Math.random() * 0.85 + 0.15;
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        depth,
        size: (Math.random() * 2.8 + 1.0) * depth,
        colorPrefix: this.redPalette[Math.floor(Math.random() * this.redPalette.length)],
        alpha: Math.random() * 0.45 + 0.35,
        vx: (Math.random() - 0.5) * 0.4 * depth,
        vy: (Math.random() - 0.5) * 0.4 * depth,
      });
    }
  }

  private renderParticles = (): void => {
    this.ctx.clearRect(0, 0, this.width, this.height);

    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      if (p.depth > 0.6) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * 1.8, 0, Math.PI * 2);
        this.ctx.fillStyle = `${p.colorPrefix}${(p.alpha * 0.2).toFixed(2)})`;
        this.ctx.fill();
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = `${p.colorPrefix}${p.alpha.toFixed(2)})`;
      this.ctx.fill();
    });

    this.animationFrameId = requestAnimationFrame(this.renderParticles);
  };
}
