/* ==========================================================================
   MAAR QR — Rendering Engine
   Wraps the third-party `qrcode-generator` matrix encoder and renders it
   onto <canvas> or as raw SVG markup, with full styling control:
   colors, gradients, rounded/square modules, margin, and centered logo.
   100% client-side. Nothing here ever talks to a network.
   ========================================================================== */

const QREngine = (() => {

  /** Build the boolean module matrix for the given data + error correction */
  function buildMatrix(data, ecLevel) {
    if (typeof qrcode === 'undefined') {
      throw new Error('QR encoder library failed to load.');
    }
    // typeNumber 0 = auto-detect smallest version that fits
    const qr = qrcode(0, ecLevel || 'M');
    qr.addData(data);
    qr.make();
    const count = qr.getModuleCount();
    const matrix = [];
    for (let r = 0; r < count; r++) {
      const row = [];
      for (let c = 0; c < count; c++) row.push(qr.isDark(r, c));
      matrix.push(row);
    }
    return matrix;
  }

  /**
   * options = {
   *   data, ecLevel, size, margin (modules), fgColor, bgColor,
   *   gradient (bool), gradientTo, shape ('square'|'rounded'|'dots'),
   *   transparent (bool), logoImage (HTMLImageElement|null), logoScale (0..1)
   * }
   */
  function render(canvas, options) {
    const matrix = buildMatrix(options.data, options.ecLevel);
    const count = matrix.length;
    const margin = options.margin ?? 2;
    const size = options.size || 512;
    const totalModules = count + margin * 2;
    const moduleSize = size / totalModules;

    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // Background
    if (!options.transparent) {
      ctx.fillStyle = options.bgColor || '#ffffff';
      ctx.fillRect(0, 0, size, size);
    }

    // Foreground fill style (solid or gradient)
    let fillStyle = options.fgColor || '#000000';
    if (options.gradient) {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, options.fgColor || '#1f6f5c');
      grad.addColorStop(1, options.gradientTo || '#c9a24b');
      fillStyle = grad;
    }
    ctx.fillStyle = fillStyle;

    const shape = options.shape || 'rounded';
    const radius = shape === 'square' ? 0 : moduleSize * (shape === 'dots' ? 0.5 : 0.32);

    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!matrix[r][c]) continue;
        const x = (c + margin) * moduleSize;
        const y = (r + margin) * moduleSize;
        drawModule(ctx, x, y, moduleSize, radius, shape);
      }
    }

    // Center logo
    if (options.logoImage) {
      const logoScale = options.logoScale ?? 0.2;
      const logoSize = size * logoScale;
      const lx = (size - logoSize) / 2;
      const ly = (size - logoSize) / 2;
      const pad = logoSize * 0.14;
      ctx.fillStyle = options.transparent ? 'rgba(255,255,255,0.001)' : (options.bgColor || '#ffffff');
      roundRect(ctx, lx - pad, ly - pad, logoSize + pad * 2, logoSize + pad * 2, 12);
      ctx.fill();
      ctx.drawImage(options.logoImage, lx, ly, logoSize, logoSize);
    }

    return { matrix, moduleSize, margin, size };
  }

  function drawModule(ctx, x, y, s, radius, shape) {
    if (shape === 'square' || radius === 0) {
      ctx.fillRect(x, y, s, s);
      return;
    }
    if (shape === 'dots') {
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2, s / 2 * 0.86, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    roundRect(ctx, x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88, radius);
    ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Generate standalone SVG markup for the current settings */
  function toSVG(options) {
    const matrix = buildMatrix(options.data, options.ecLevel);
    const count = matrix.length;
    const margin = options.margin ?? 2;
    const size = options.size || 512;
    const totalModules = count + margin * 2;
    const moduleSize = size / totalModules;
    const shape = options.shape || 'rounded';
    const radius = shape === 'square' ? 0 : moduleSize * (shape === 'dots' ? 0.5 : 0.32);

    let defs = '';
    let fill = options.fgColor || '#000000';
    if (options.gradient) {
      defs = `<defs><linearGradient id="fg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${options.fgColor || '#1f6f5c'}"/>
        <stop offset="100%" stop-color="${options.gradientTo || '#c9a24b'}"/>
      </linearGradient></defs>`;
      fill = 'url(#fg)';
    }

    let bgRect = options.transparent
      ? ''
      : `<rect width="${size}" height="${size}" fill="${options.bgColor || '#ffffff'}"/>`;

    let modules = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!matrix[r][c]) continue;
        const x = (c + margin) * moduleSize;
        const y = (r + margin) * moduleSize;
        if (shape === 'square' || radius === 0) {
          modules += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${moduleSize.toFixed(2)}" height="${moduleSize.toFixed(2)}" fill="${fill}"/>`;
        } else if (shape === 'dots') {
          const cx = x + moduleSize / 2, cy = y + moduleSize / 2;
          modules += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(moduleSize / 2 * 0.86).toFixed(2)}" fill="${fill}"/>`;
        } else {
          const rx = x + moduleSize * 0.06, ry = y + moduleSize * 0.06;
          const rw = moduleSize * 0.88;
          modules += `<rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${rw.toFixed(2)}" rx="${radius.toFixed(2)}" fill="${fill}"/>`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${defs}${bgRect}${modules}</svg>`;
  }

  return { render, toSVG, buildMatrix };
})();
