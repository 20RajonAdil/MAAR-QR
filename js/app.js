/* ==========================================================================
   MAAR QR — Application
   Everything below runs entirely in the browser. No fetch(), no backend,
   no analytics, no cookies. localStorage is used only for local history
   and the theme preference, and never leaves this device.
   ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Theme                                                               */
  /* ------------------------------------------------------------------ */
  const root = document.documentElement;
  const savedTheme = localStorage.getItem('maarqr-theme');
  if (savedTheme) {
    root.setAttribute('data-theme', savedTheme);
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    root.setAttribute('data-theme', 'light');
  }
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('maarqr-theme', next);
  });

  /* ------------------------------------------------------------------ */
  /* Mobile nav                                                          */
  /* ------------------------------------------------------------------ */
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  navToggle?.addEventListener('click', () => {
    const open = navLinks.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  navLinks?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('is-open');
  }));

  /* ------------------------------------------------------------------ */
  /* Scroll reveal                                                       */
  /* ------------------------------------------------------------------ */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ------------------------------------------------------------------ */
  /* Toast                                                               */
  /* ------------------------------------------------------------------ */
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.querySelector('span').textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  /* ------------------------------------------------------------------ */
  /* QR Data type builders                                               */
  /* ------------------------------------------------------------------ */
  const typeLabels = {
    url: 'Link', text: 'Text', wifi: 'Wi-Fi', phone: 'Phone', email: 'Email',
    sms: 'SMS', whatsapp: 'WhatsApp', vcard: 'Contact card', maps: 'Location',
    event: 'Calendar event', crypto: 'Crypto address'
  };

  function icalDate(val) {
    if (!val) return '';
    // val is "YYYY-MM-DDTHH:mm" from datetime-local
    return val.replace(/[-:]/g, '') + '00';
  }

  const builders = {
    url: (f) => {
      let v = (f.url.value || '').trim();
      if (v && !/^[a-z]+:\/\//i.test(v)) v = 'https://' + v;
      return v;
    },
    text: (f) => f.text.value || '',
    wifi: (f) => {
      const ssid = (f.ssid.value || '').replace(/([\\;,":])/g, '\\$1');
      const pass = (f.pass.value || '').replace(/([\\;,":])/g, '\\$1');
      const enc = f.enc.value;
      const hidden = f.hidden.checked ? 'true' : 'false';
      if (enc === 'nopass') return `WIFI:T:nopass;S:${ssid};H:${hidden};;`;
      return `WIFI:T:${enc};S:${ssid};P:${pass};H:${hidden};;`;
    },
    phone: (f) => f.phone.value ? `tel:${f.phone.value.trim()}` : '',
    email: (f) => {
      if (!f.to.value) return '';
      const params = new URLSearchParams();
      if (f.subject.value) params.set('subject', f.subject.value);
      if (f.body.value) params.set('body', f.body.value);
      const q = params.toString();
      return `mailto:${f.to.value.trim()}${q ? '?' + q : ''}`;
    },
    sms: (f) => f.number.value ? `SMSTO:${f.number.value.trim()}:${f.message.value || ''}` : '',
    whatsapp: (f) => {
      if (!f.number.value) return '';
      const digits = f.number.value.replace(/[^\d]/g, '');
      const params = f.message.value ? `?text=${encodeURIComponent(f.message.value)}` : '';
      return `https://wa.me/${digits}${params}`;
    },
    vcard: (f) => {
      if (!f.name.value) return '';
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${f.name.value};;;;`, `FN:${f.name.value}`];
      if (f.org.value) lines.push(`ORG:${f.org.value}`);
      if (f.title.value) lines.push(`TITLE:${f.title.value}`);
      if (f.vphone.value) lines.push(`TEL;TYPE=CELL:${f.vphone.value}`);
      if (f.vemail.value) lines.push(`EMAIL:${f.vemail.value}`);
      if (f.website.value) lines.push(`URL:${f.website.value}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    },
    maps: (f) => {
      if (f.lat.value && f.lng.value) return `https://maps.google.com/?q=${f.lat.value},${f.lng.value}`;
      if (f.address.value) return `https://maps.google.com/?q=${encodeURIComponent(f.address.value)}`;
      return '';
    },
    event: (f) => {
      if (!f.title.value || !f.start.value) return '';
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
        `SUMMARY:${f.title.value}`, `DTSTART:${icalDate(f.start.value)}`];
      if (f.end.value) lines.push(`DTEND:${icalDate(f.end.value)}`);
      if (f.location.value) lines.push(`LOCATION:${f.location.value}`);
      if (f.desc.value) lines.push(`DESCRIPTION:${f.desc.value}`);
      lines.push('END:VEVENT', 'END:VCALENDAR');
      return lines.join('\n');
    },
    crypto: (f) => {
      if (!f.address.value) return '';
      const scheme = f.coin.value;
      const params = f.amount.value ? `?amount=${f.amount.value}` : '';
      return `${scheme}:${f.address.value.trim()}${params}`;
    }
  };

  function fieldsFor(type) {
    const form = document.getElementById(`form-${type}`);
    const inputs = form.querySelectorAll('[data-field]');
    const f = {};
    inputs.forEach(inp => { f[inp.dataset.field] = inp; });
    return f;
  }

  let currentType = 'url';
  function currentPayload() {
    const f = fieldsFor(currentType);
    try { return builders[currentType](f) || ''; } catch { return ''; }
  }

  /* ------------------------------------------------------------------ */
  /* Type switcher                                                       */
  /* ------------------------------------------------------------------ */
  const typeButtons = document.querySelectorAll('.type-btn');
  const dataForms = document.querySelectorAll('.data-forms > div');
  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      typeButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      currentType = btn.dataset.type;
      dataForms.forEach(form => form.classList.toggle('active', form.id === `form-${currentType}`));
      scheduleRender();
    });
  });

  /* ------------------------------------------------------------------ */
  /* Customization state                                                 */
  /* ------------------------------------------------------------------ */
  const state = {
    fgColor: '#0b241d',
    bgColor: '#ffffff',
    gradient: false,
    gradientTo: '#c9a24b',
    shape: 'rounded',
    size: 512,
    margin: 2,
    ecLevel: 'M',
    transparent: false,
    logoImage: null,
    logoScale: 0.2
  };

  const el = (id) => document.getElementById(id);

  el('fgColor')?.addEventListener('input', (e) => { state.fgColor = e.target.value; scheduleRender(); });
  el('bgColor')?.addEventListener('input', (e) => { state.bgColor = e.target.value; scheduleRender(); });
  el('gradientToggle')?.addEventListener('change', (e) => {
    state.gradient = e.target.checked;
    el('gradientToRow').style.display = state.gradient ? 'flex' : 'none';
    scheduleRender();
  });
  el('gradientTo')?.addEventListener('input', (e) => { state.gradientTo = e.target.value; scheduleRender(); });
  el('transparentToggle')?.addEventListener('change', (e) => {
    state.transparent = e.target.checked;
    el('bgColor').disabled = state.transparent;
    scheduleRender();
  });

  document.querySelectorAll('[data-shape]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-shape]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      state.shape = btn.dataset.shape;
      scheduleRender();
    });
  });

  function bindRange(id, valueId, stateKey, fmt) {
    const input = el(id);
    if (!input) return;
    input.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      state[stateKey] = v;
      if (valueId) el(valueId).textContent = fmt ? fmt(v) : v;
      scheduleRender();
    });
  }
  bindRange('sizeRange', 'sizeValue', 'size', v => `${v}px`);
  bindRange('marginRange', 'marginValue', 'margin', v => `${v}`);
  bindRange('logoScaleRange', 'logoScaleValue', 'logoScale', v => `${Math.round(v * 100)}%`);

  el('ecLevel')?.addEventListener('change', (e) => { state.ecLevel = e.target.value; scheduleRender(); });

  el('logoInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => { state.logoImage = img; el('logoScaleRow').style.display = 'flex'; el('logoDropLabel').textContent = file.name; scheduleRender(); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
  el('logoClear')?.addEventListener('click', () => {
    state.logoImage = null;
    el('logoInput').value = '';
    el('logoScaleRow').style.display = 'none';
    el('logoDropLabel').textContent = 'Click to upload a logo (PNG, JPG, SVG)';
    scheduleRender();
  });

  /* Accordion */
  document.querySelectorAll('.accordion__trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!isOpen));
      panel.classList.toggle('open', !isOpen);
    });
  });
  // Open first accordion item by default
  document.querySelector('.accordion__trigger')?.click();

  /* Reset settings */
  el('resetSettings')?.addEventListener('click', () => {
    Object.assign(state, {
      fgColor: '#0b241d', bgColor: '#ffffff', gradient: false, gradientTo: '#c9a24b',
      shape: 'rounded', size: 512, margin: 2, ecLevel: 'M', transparent: false,
      logoImage: null, logoScale: 0.2
    });
    el('fgColor').value = state.fgColor;
    el('bgColor').value = state.bgColor; el('bgColor').disabled = false;
    el('gradientToggle').checked = false; el('gradientToRow').style.display = 'none';
    el('gradientTo').value = state.gradientTo;
    el('transparentToggle').checked = false;
    el('sizeRange').value = state.size; el('sizeValue').textContent = `${state.size}px`;
    el('marginRange').value = state.margin; el('marginValue').textContent = `${state.margin}`;
    el('ecLevel').value = state.ecLevel;
    el('logoInput').value = ''; el('logoScaleRow').style.display = 'none';
    el('logoDropLabel').textContent = 'Click to upload a logo (PNG, JPG, SVG)';
    document.querySelectorAll('[data-shape]').forEach(b => b.setAttribute('aria-pressed', b.dataset.shape === 'rounded' ? 'true' : 'false'));
    scheduleRender();
    toast('Settings reset');
  });

  /* Clear data */
  el('clearData')?.addEventListener('click', () => {
    const f = fieldsFor(currentType);
    Object.values(f).forEach(input => {
      if (input.type === 'checkbox') input.checked = false; else input.value = '';
    });
    scheduleRender();
  });

  /* ------------------------------------------------------------------ */
  /* Render pipeline                                                     */
  /* ------------------------------------------------------------------ */
  const mainCanvas = el('qrCanvas');
  const heroCanvas = el('heroCanvas');
  let renderTimer;
  let lastPayload = '';
  let lastRenderOk = false;

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(doRender, 160);
  }

  function doRender() {
    const payload = currentPayload();
    lastPayload = payload;
    const emptyState = el('emptyState');

    if (!payload) {
      lastRenderOk = false;
      if (mainCanvas) { mainCanvas.getContext('2d').clearRect(0, 0, mainCanvas.width, mainCanvas.height); }
      if (emptyState) emptyState.style.display = 'flex';
      updateOutputButtons(false);
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    try {
      if (mainCanvas) QREngine.render(mainCanvas, { ...state, data: payload, size: state.size });
      if (heroCanvas) QREngine.render(heroCanvas, { ...state, data: payload || 'MAAR QR', size: 480, margin: 1.5 });
      lastRenderOk = true;
      updateOutputButtons(true);
    } catch (err) {
      lastRenderOk = false;
      updateOutputButtons(false);
      console.warn('QR render failed:', err.message);
    }
  }

  function updateOutputButtons(enabled) {
    ['downloadPng', 'downloadSvg', 'downloadPdf', 'copyImage', 'printQr', 'saveHistory'].forEach(id => {
      const b = el(id);
      if (b) b.disabled = !enabled;
    });
  }

  // Live update on every keystroke across all forms
  document.querySelectorAll('.data-forms [data-field]').forEach(input => {
    input.addEventListener('input', scheduleRender);
    input.addEventListener('change', scheduleRender);
  });

  // Prefill something in hero on load
  el('form-url') && (fieldsFor('url').url.value = 'maar.app');
  doRender();

  /* ------------------------------------------------------------------ */
  /* Downloads                                                            */
  /* ------------------------------------------------------------------ */
  function filenameBase() {
    return `maar-qr-${Date.now()}`;
  }

  el('downloadPng')?.addEventListener('click', () => {
    if (!lastRenderOk) return;
    mainCanvas.toBlob((blob) => {
      triggerDownload(blob, `${filenameBase()}.png`);
      toast('PNG downloaded');
    }, 'image/png');
  });

  el('downloadSvg')?.addEventListener('click', () => {
    if (!lastRenderOk) return;
    const svg = QREngine.toSVG({ ...state, data: lastPayload });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    triggerDownload(blob, `${filenameBase()}.svg`);
    toast('SVG downloaded');
  });

  el('downloadPdf')?.addEventListener('click', () => {
    if (!lastRenderOk) return;
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'pt', format: [state.size + 80, state.size + 80] });
      const dataUrl = mainCanvas.toDataURL('image/png');
      pdf.addImage(dataUrl, 'PNG', 40, 40, state.size, state.size);
      pdf.save(`${filenameBase()}.pdf`);
      toast('PDF downloaded');
    } catch (err) {
      toast('PDF export unavailable offline');
    }
  });

  el('copyImage')?.addEventListener('click', async () => {
    if (!lastRenderOk) return;
    try {
      mainCanvas.toBlob(async (blob) => {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Copied to clipboard');
      });
    } catch {
      toast('Clipboard copy not supported here');
    }
  });

  el('printQr')?.addEventListener('click', () => {
    if (!lastRenderOk) return;
    const dataUrl = mainCanvas.toDataURL('image/png');
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>MAAR QR — Print</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><img src="${dataUrl}" style="max-width:80%;"/></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  });

  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ------------------------------------------------------------------ */
  /* History (localStorage only)                                         */
  /* ------------------------------------------------------------------ */
  const HISTORY_KEY = 'maarqr-history';
  const historyGrid = el('historyGrid');

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
  }
  function saveHistory(items) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 12)));
  }

  function renderHistory() {
    const items = loadHistory();
    if (!historyGrid) return;
    historyGrid.innerHTML = '';
    if (!items.length) {
      historyGrid.innerHTML = '<div class="history-empty">Codes you save will appear here, stored only in this browser.</div>';
      return;
    }
    items.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'history-item card';
      div.innerHTML = `<canvas width="160" height="160"></canvas><span>${typeLabels[item.type] || 'Code'}</span>`;
      const c = div.querySelector('canvas');
      const img = new Image();
      img.onload = () => { c.getContext('2d').drawImage(img, 0, 0, 160, 160); };
      img.src = item.thumb;
      div.title = 'Click to reload this code';
      div.addEventListener('click', () => reloadFromHistory(item));
      historyGrid.appendChild(div);
    });
  }

  function reloadFromHistory(item) {
    const btn = document.querySelector(`.type-btn[data-type="${item.type}"]`);
    btn?.click();
    const f = fieldsFor(item.type);
    Object.entries(item.fields || {}).forEach(([k, v]) => {
      if (f[k]) { if (f[k].type === 'checkbox') f[k].checked = v; else f[k].value = v; }
    });
    scheduleRender();
    document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Loaded from history');
  }

  el('saveHistory')?.addEventListener('click', () => {
    if (!lastRenderOk) return;
    const f = fieldsFor(currentType);
    const fields = {};
    Object.entries(f).forEach(([k, input]) => { fields[k] = input.type === 'checkbox' ? input.checked : input.value; });
    const items = loadHistory();
    items.unshift({
      type: currentType,
      fields,
      thumb: mainCanvas.toDataURL('image/png'),
      ts: Date.now()
    });
    saveHistory(items);
    renderHistory();
    toast('Saved to local history');
  });

  el('clearHistory')?.addEventListener('click', () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    toast('History cleared');
  });

  renderHistory();

  /* ------------------------------------------------------------------ */
  /* Scanner                                                              */
  /* ------------------------------------------------------------------ */
  const scannerStage = el('scannerStage');
  const scannerVideo = el('scannerVideo');
  const scannerResult = el('scannerResult');
  const startScanBtn = el('startScan');
  const stopScanBtn = el('stopScan');
  let scanStream = null;
  let scanRAF = null;
  const scanCanvas = document.createElement('canvas');
  const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

  async function startScan() {
    if (typeof jsQR === 'undefined') { toast('Scanner library unavailable offline'); return; }
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      scannerVideo.srcObject = scanStream;
      await scannerVideo.play();
      scannerStage.classList.add('live');
      startScanBtn.hidden = true;
      stopScanBtn.hidden = false;
      scannerResult.classList.remove('show');
      tickScan();
    } catch (err) {
      toast('Camera access denied or unavailable');
    }
  }

  function stopScan() {
    if (scanRAF) cancelAnimationFrame(scanRAF);
    if (scanStream) scanStream.getTracks().forEach(t => t.stop());
    scanStream = null;
    scannerStage.classList.remove('live');
    startScanBtn.hidden = false;
    stopScanBtn.hidden = true;
  }

  function tickScan() {
    if (!scanStream) return;
    if (scannerVideo.readyState === scannerVideo.HAVE_ENOUGH_DATA) {
      scanCanvas.width = scannerVideo.videoWidth;
      scanCanvas.height = scannerVideo.videoHeight;
      scanCtx.drawImage(scannerVideo, 0, 0, scanCanvas.width, scanCanvas.height);
      const imageData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        onScanResult(code.data);
        stopScan();
        return;
      }
    }
    scanRAF = requestAnimationFrame(tickScan);
  }

  function onScanResult(text) {
    scannerResult.classList.add('show');
    const isLink = /^https?:\/\//i.test(text);
    scannerResult.innerHTML = `
      <div style="margin-bottom:10px; word-break:break-all;">${escapeHtml(text)}</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn btn--sm btn--primary" id="scanCopyBtn" type="button">Copy result</button>
        ${isLink ? `<a class="btn btn--sm btn--ghost" href="${encodeURI(text)}" target="_blank" rel="noopener noreferrer">Open link</a>` : ''}
      </div>`;
    document.getElementById('scanCopyBtn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard'));
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  startScanBtn?.addEventListener('click', startScan);
  stopScanBtn?.addEventListener('click', stopScan);

  /* ------------------------------------------------------------------ */
  /* Edit an existing QR code — decode an uploaded image, then           */
  /* populate the generator's fields with whatever it contains.         */
  /* ------------------------------------------------------------------ */
  const editFileInput = el('editFileInput');
  const editDropLabel = el('editDropLabel');
  const editResult = el('editResult');
  const editCanvas = el('editCanvas');
  const editCtx = editCanvas ? editCanvas.getContext('2d', { willReadFrequently: true }) : null;

  function unescapeWifiVal(v) {
    return (v || '').replace(/\\([\\;,":])/g, '$1');
  }

  // Reverses the "YYYYMMDDTHHmm00" format produced by icalDate() above.
  function icalToLocal(v) {
    if (!v || v.length < 13) return '';
    const y = v.slice(0, 4), mo = v.slice(4, 6), d = v.slice(6, 8);
    const hh = v.slice(9, 11) || '00', mi = v.slice(11, 13) || '00';
    return `${y}-${mo}-${d}T${hh}:${mi}`;
  }

  // Best-effort reverse of the `builders` above: takes raw decoded QR text
  // and works out which type it is and what its fields should be.
  function parseScannedPayload(text) {
    const t = (text || '').trim();
    const grab = (re) => (t.match(re) || [])[1] || '';

    if (/^WIFI:/i.test(t)) {
      const sMatch = t.match(/S:((?:\\.|[^;])*);/);
      const pMatch = t.match(/P:((?:\\.|[^;])*);/);
      const tMatch = t.match(/T:([^;]*);/);
      const hMatch = t.match(/H:([^;]*);/);
      let enc = (tMatch?.[1] || 'WPA').toUpperCase();
      if (enc === 'NOPASS') enc = 'nopass';
      else if (enc !== 'WEP') enc = 'WPA';
      return { type: 'wifi', fields: {
        ssid: unescapeWifiVal(sMatch?.[1]),
        pass: unescapeWifiVal(pMatch?.[1]),
        enc,
        hidden: /^true$/i.test(hMatch?.[1] || '')
      } };
    }

    if (/^BEGIN:VCARD/i.test(t)) {
      const name = grab(/\nFN:(.*)/i) || grab(/\nN:([^;\n]*)/i);
      return { type: 'vcard', fields: {
        name: name.trim(),
        org: grab(/\nORG:(.*)/i).trim(),
        title: grab(/\nTITLE:(.*)/i).trim(),
        vphone: grab(/\nTEL[^:\n]*:(.*)/i).trim(),
        vemail: grab(/\nEMAIL[^:\n]*:(.*)/i).trim(),
        website: grab(/\nURL:(.*)/i).trim()
      } };
    }

    if (/^BEGIN:VCALENDAR/i.test(t)) {
      return { type: 'event', fields: {
        title: grab(/\nSUMMARY:(.*)/i).trim(),
        start: icalToLocal(grab(/\nDTSTART:(.*)/i).trim()),
        end: icalToLocal(grab(/\nDTEND:(.*)/i).trim()),
        location: grab(/\nLOCATION:(.*)/i).trim(),
        desc: grab(/\nDESCRIPTION:(.*)/i).trim()
      } };
    }

    if (/^tel:/i.test(t)) return { type: 'phone', fields: { phone: t.slice(4) } };

    if (/^mailto:/i.test(t)) {
      const [addr, query] = t.slice(7).split('?');
      const params = new URLSearchParams(query || '');
      return { type: 'email', fields: {
        to: decodeURIComponent(addr || ''),
        subject: params.get('subject') || '',
        body: params.get('body') || ''
      } };
    }

    if (/^SMSTO:/i.test(t)) {
      const rest = t.slice(6);
      const idx = rest.indexOf(':');
      return { type: 'sms', fields: {
        number: idx === -1 ? rest : rest.slice(0, idx),
        message: idx === -1 ? '' : rest.slice(idx + 1)
      } };
    }

    const wa = t.match(/^https?:\/\/(?:api\.)?wa\.me\/(\d+)(?:\?text=(.*))?$/i)
      || t.match(/^https?:\/\/api\.whatsapp\.com\/send\?phone=(\d+)(?:&text=(.*))?$/i);
    if (wa) return { type: 'whatsapp', fields: {
      number: wa[1],
      message: wa[2] ? decodeURIComponent(wa[2].replace(/\+/g, ' ')) : ''
    } };

    const maps = t.match(/^https?:\/\/maps\.google\.com\/\?q=(.+)$/i);
    if (maps) {
      const q = decodeURIComponent(maps[1]);
      const coords = q.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
      return coords
        ? { type: 'maps', fields: { lat: coords[1], lng: coords[2], address: '' } }
        : { type: 'maps', fields: { lat: '', lng: '', address: q } };
    }

    const crypto = t.match(/^(bitcoin|ethereum|litecoin|dogecoin):([^?]+)(?:\?amount=([\d.]+))?/i);
    if (crypto) return { type: 'crypto', fields: {
      coin: crypto[1].toLowerCase(), address: crypto[2], amount: crypto[3] || ''
    } };

    if (/^https?:\/\//i.test(t)) return { type: 'url', fields: { url: t } };

    return { type: 'text', fields: { text: t } };
  }

  function applyScannedPayload(text) {
    const { type, fields } = parseScannedPayload(text);
    const btn = document.querySelector(`.type-btn[data-type="${type}"]`);
    btn?.click();
    const f = fieldsFor(type);
    Object.entries(fields).forEach(([k, v]) => {
      const input = f[k];
      if (!input) return;
      if (input.type === 'checkbox') input.checked = !!v; else input.value = v ?? '';
    });
    scheduleRender();

    if (editResult) {
      editResult.classList.add('show');
      editResult.innerHTML = `<div style="margin-bottom:6px; font-weight:600; color:var(--text-1);">Detected: ${typeLabels[type] || 'Text'}</div><div>${escapeHtml(text)}</div>`;
    }
    toast(`Loaded a ${(typeLabels[type] || 'Text').toLowerCase()} code — edit it below`);
    setTimeout(() => {
      document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  }

  /* -- Verification gate: what/why/use + ownership confirmation -------- */
  const gateBackdrop = el('editGateBackdrop');
  const gateWhat = el('gateWhat');
  const gateWhy = el('gateWhy');
  const gateUse = el('gateUse');
  const gateConfirm = el('gateConfirm');
  const gateContinue = el('gateContinue');
  const gateCancel = el('gateCancel');
  let pendingScan = null; // { type, text }

  function gateReady() {
    return gateWhat.value.trim() && gateWhy.value.trim() && gateUse.value.trim() && gateConfirm.checked;
  }
  function refreshGateButton() {
    gateContinue.disabled = !gateReady();
  }
  [gateWhat, gateWhy, gateUse].forEach(i => i?.addEventListener('input', refreshGateButton));
  gateConfirm?.addEventListener('change', refreshGateButton);

  function openGate(type, text) {
    pendingScan = { type, text };
    gateWhat.value = ''; gateWhy.value = ''; gateUse.value = ''; gateConfirm.checked = false;
    refreshGateButton();
    gateBackdrop.hidden = false;
    setTimeout(() => gateWhat.focus(), 50);
  }
  function closeGate() {
    gateBackdrop.hidden = true;
    pendingScan = null;
  }
  gateCancel?.addEventListener('click', closeGate);
  gateBackdrop?.addEventListener('click', (e) => { if (e.target === gateBackdrop) closeGate(); });
  gateContinue?.addEventListener('click', () => {
    if (!pendingScan || !gateReady()) return;
    const { type, text } = pendingScan;
    const answers = { what: gateWhat.value.trim(), why: gateWhy.value.trim(), use: gateUse.value.trim() };
    logEdit(type, answers);
    closeGate();
    applyScannedPayload(text);
  });

  /* -- Local-only edit log (this device only, like local history) ------ */
  const EDIT_LOG_KEY = 'maarqr-edit-log';
  const editLogList = el('editLogList');

  function loadEditLog() {
    try { return JSON.parse(localStorage.getItem(EDIT_LOG_KEY)) || []; }
    catch { return []; }
  }
  function saveEditLog(items) {
    localStorage.setItem(EDIT_LOG_KEY, JSON.stringify(items.slice(0, 50)));
  }
  function logEdit(type, answers) {
    const items = loadEditLog();
    items.unshift({ ts: Date.now(), type, ...answers });
    saveEditLog(items);
    renderEditLog();
  }
  function renderEditLog() {
    if (!editLogList) return;
    const items = loadEditLog();
    if (!items.length) {
      editLogList.innerHTML = '<div class="edit-log__empty">Edits you confirm will be logged here, stored only in this browser.</div>';
      return;
    }
    editLogList.innerHTML = items.map(item => `
      <div class="edit-log__item">
        <div class="edit-log__row1"><span class="edit-log__type">${escapeHtml(typeLabels[item.type] || 'Code')}</span><span>${new Date(item.ts).toLocaleString()}</span></div>
        <p><span>What: </span>${escapeHtml(item.what || '')}</p>
        <p><span>Why: </span>${escapeHtml(item.why || '')}</p>
        <p><span>Use: </span>${escapeHtml(item.use || '')}</p>
      </div>
    `).join('');
  }
  el('clearEditLog')?.addEventListener('click', () => {
    localStorage.removeItem(EDIT_LOG_KEY);
    renderEditLog();
    toast('Edit log cleared');
  });
  renderEditLog();

  function decodeQrImage(file) {
    if (!file || !editCtx) return;
    if (!file.type || !file.type.startsWith('image/')) { toast('Please upload an image file'); return; }
    if (typeof jsQR === 'undefined') { toast('Scanner library unavailable offline'); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        editCanvas.width = w; editCanvas.height = h;
        editCtx.clearRect(0, 0, w, h);
        editCtx.drawImage(img, 0, 0, w, h);
        const imageData = editCtx.getImageData(0, 0, w, h);
        const code = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
        if (code && code.data) {
          const { type } = parseScannedPayload(code.data);
          openGate(type, code.data);
        } else {
          toast("Couldn't find a QR code in that image");
        }
      };
      img.onerror = () => toast('Could not read that image file');
      img.src = ev.target.result;
    };
    reader.onerror = () => toast('Could not read that image file');
    reader.readAsDataURL(file);
  }

  editFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    decodeQrImage(file);
    editFileInput.value = '';
  });

  ['dragover', 'dragenter'].forEach(evt => editDropLabel?.addEventListener(evt, (e) => {
    e.preventDefault();
    editDropLabel.classList.add('is-dragover');
  }));
  ['dragleave', 'drop'].forEach(evt => editDropLabel?.addEventListener(evt, (e) => {
    e.preventDefault();
    editDropLabel.classList.remove('is-dragover');
  }));
  editDropLabel?.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) decodeQrImage(file);
  });

  /* ------------------------------------------------------------------ */
  /* Footer year                                                         */
  /* ------------------------------------------------------------------ */
  const yearEl = el('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

})();
