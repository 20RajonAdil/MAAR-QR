/* ==========================================================================
   FloatingLines — ambient animated background of wavy, layered lines.

   A dependency-free Canvas2D re-implementation of a "FloatingLines" React
   component API (this project has no React/build step, so the original
   component can't be imported directly). Same configuration surface:

     new FloatingLines(canvasEl, {
       enabledWaves: ['top', 'middle', 'bottom'],
       lineCount:    [10, 15, 20],   // per wave, or a single number for all
       lineDistance: [8, 6, 4],      // px spacing between lines in a wave
       bendRadius: 5.0,              // cursor influence radius (world units)
       bendStrength: -0.5,           // negative = lines part away from the
                                      // cursor, positive = drawn toward it
       interactive: true,            // react to pointer movement
       parallax: true,               // depth drift on pointer + scroll
       gradientStart: '#264808'      // base line color; a lighter tint is
                                      // derived automatically for the glow
     });
   ========================================================================== */
(function () {
  'use strict';

  const PX_PER_RADIUS_UNIT = 42;
  const PX_PER_STRENGTH_UNIT = 70;
  const SEGMENTS = 48;

  function toArray(value, length) {
    if (Array.isArray(value)) return value;
    return new Array(length).fill(value);
  }

  function hexToRgb(hex) {
    const c = String(hex).replace('#', '');
    const full = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c;
    const num = parseInt(full, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function lighten({ r, g, b }, amount) {
    return {
      r: Math.min(255, r + amount),
      g: Math.min(255, g + amount),
      b: Math.min(255, b + amount)
    };
  }

  function rgba({ r, g, b }, a) {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  class FloatingLines {
    constructor(canvas, options) {
      options = options || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.container = canvas.parentElement;

      const waveNames = options.enabledWaves || ['top', 'middle', 'bottom'];
      const counts = toArray(options.lineCount != null ? options.lineCount : 12, waveNames.length);
      const distances = toArray(options.lineDistance != null ? options.lineDistance : 6, waveNames.length);

      this.waves = waveNames.map((name, i) => ({
        name,
        count: Math.max(0, counts[i] != null ? counts[i] : counts[counts.length - 1]),
        distance: distances[i] != null ? distances[i] : distances[distances.length - 1]
      }));

      this.bendRadius = (options.bendRadius != null ? options.bendRadius : 5) * PX_PER_RADIUS_UNIT;
      this.bendStrength = (options.bendStrength != null ? options.bendStrength : -0.5) * PX_PER_STRENGTH_UNIT;
      this.interactive = options.interactive !== false;
      this.parallax = options.parallax !== false;

      const startRgb = hexToRgb(options.gradientStart || '#3fd8a8');
      this.colorCore = startRgb;
      this.colorGlow = lighten(startRgb, 90);

      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.pointer = { x: -9999, y: -9999, active: false };
      this.scrollY = window.scrollY || 0;
      this.running = false;
      this.isCompact = false;

      this._buildLineData();
      this._bindEvents();
      this._resize();
      this._observeVisibility();

      if (this.reduceMotion) this._render(0);
      else this.start();
    }

    _buildLineData() {
      this.waveLines = this.waves.map((wave) => {
        const lines = [];
        for (let i = 0; i < wave.count; i++) {
          lines.push({
            seed: Math.random() * 1000,
            speed: 0.14 + Math.random() * 0.16,
            ampA: 9 + Math.random() * 12,
            ampB: 3 + Math.random() * 7,
            freqA: 0.85 + Math.random() * 0.5,
            freqB: 1.7 + Math.random() * 1.0
          });
        }
        return lines;
      });
    }

    _bindEvents() {
      this._onResize = () => this._resize();
      window.addEventListener('resize', this._onResize);

      if (this.interactive) {
        this._onMove = (e) => {
          const rect = this.canvas.getBoundingClientRect();
          this.pointer.x = e.clientX - rect.left;
          this.pointer.y = e.clientY - rect.top;
          this.pointer.active = true;
        };
        this._onLeave = () => { this.pointer.active = false; };
        this.container.addEventListener('pointermove', this._onMove);
        this.container.addEventListener('pointerleave', this._onLeave);
      }

      if (this.parallax) {
        this._onScroll = () => { this.scrollY = window.scrollY || 0; };
        window.addEventListener('scroll', this._onScroll, { passive: true });
      }
    }

    _observeVisibility() {
      this._onVisibility = () => {
        if (document.hidden) this.stop();
        else if (!this.reduceMotion) this.start();
      };
      document.addEventListener('visibilitychange', this._onVisibility);

      if ('IntersectionObserver' in window) {
        this._io = new IntersectionObserver((entries) => {
          const visible = entries[0] && entries[0].isIntersecting;
          if (visible && !document.hidden && !this.reduceMotion) this.start();
          else this.stop();
        }, { threshold: 0.01 });
        this._io.observe(this.canvas);
      }
    }

    _resize() {
      const rect = this.container.getBoundingClientRect();
      this.width = Math.max(1, rect.width);
      this.height = Math.max(1, rect.height);
      this.isCompact = this.width < 720;
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.canvas.style.width = this.width + 'px';
      this.canvas.style.height = this.height + 'px';
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (!this.running) this._render(this._lastT || 0);
    }

    start() {
      if (this.running) return;
      this.running = true;
      const loop = (tMs) => {
        if (!this.running) return;
        this._lastT = tMs / 1000;
        this._render(this._lastT);
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    stop() {
      this.running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
    }

    destroy() {
      this.stop();
      window.removeEventListener('resize', this._onResize);
      if (this._onScroll) window.removeEventListener('scroll', this._onScroll);
      if (this._onMove) this.container.removeEventListener('pointermove', this._onMove);
      if (this._onLeave) this.container.removeEventListener('pointerleave', this._onLeave);
      document.removeEventListener('visibilitychange', this._onVisibility);
      if (this._io) this._io.disconnect();
    }

    _render(t) {
      const ctx = this.ctx;
      const w = this.width, h = this.height;
      ctx.clearRect(0, 0, w, h);
      if (!w || !h) return;

      const n = this.waves.length || 1;
      const bandH = h / n;
      const distanceScale = this.isCompact ? 0.68 : 1;

      for (let wi = 0; wi < this.waves.length; wi++) {
        const wave = this.waves[wi];
        const lines = this.waveLines[wi];
        if (!lines || !lines.length) continue;

        const bandCenter = bandH * wi + bandH / 2;
        const spacing = wave.distance * distanceScale;
        const depthFactor = (wi + 1) / n;

        const pointerDrift = this.parallax && this.pointer.active
          ? ((this.pointer.x - w / 2) / w) * (10 + wi * 12)
          : 0;
        const scrollDrift = this.parallax ? Math.sin(this.scrollY * 0.002 + wi) * 6 * depthFactor : 0;

        for (let li = 0; li < lines.length; li++) {
          const line = lines[li];
          const centerOffset = (li - (lines.length - 1) / 2) * spacing;
          const baseY = bandCenter + centerOffset;
          const lineDepth = 0.45 + 0.55 * (li / Math.max(1, lines.length - 1));

          ctx.beginPath();
          for (let s = 0; s <= SEGMENTS; s++) {
            const px = (s / SEGMENTS) * w;
            const wobble =
              Math.sin(px * 0.0055 * line.freqA + t * line.speed + line.seed) * line.ampA +
              Math.sin(px * 0.013 * line.freqB - t * line.speed * 0.7 + line.seed * 1.7) * line.ampB;

            let py = baseY + wobble + pointerDrift * (li / lines.length) + scrollDrift;

            if (this.interactive && this.pointer.active) {
              const dx = px - this.pointer.x;
              const dy = py - this.pointer.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < this.bendRadius) {
                const falloff = 1 - dist / this.bendRadius;
                const push = -this.bendStrength * falloff * falloff;
                py += (dy / (dist || 1)) * push;
              }
            }

            if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }

          const grad = ctx.createLinearGradient(0, 0, w, 0);
          grad.addColorStop(0, rgba(this.colorCore, 0.08 * lineDepth));
          grad.addColorStop(0.5, rgba(this.colorGlow, 0.62 * lineDepth));
          grad.addColorStop(1, rgba(this.colorCore, 0.12 * lineDepth));

          ctx.strokeStyle = grad;
          ctx.lineWidth = 1 + lineDepth * 0.7;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }
    }
  }

  window.FloatingLines = FloatingLines;
})();
