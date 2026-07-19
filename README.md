# MAAR QR

A premium, privacy-first QR code studio. Generate styled QR codes for links, Wi-Fi, contacts, payments, events and more, scan codes with your camera, and keep a local history — all client-side, with no backend, accounts, or tracking.

## Project structure

```
maar-qr/
├── index.html          Main page (semantic HTML, all sections)
├── css/
│   └── styles.css      Design system: tokens, layout, components, animations
├── js/
│   ├── qr-engine.js    Canvas/SVG rendering (colors, gradients, shapes, logo)
│   └── app.js          UI wiring: forms, customization, history, scanner, theme
├── icons/
│   └── favicon.svg     Custom "M" + QR corner-marker mark
├── assets/              (reserved for future static assets)
└── images/              (reserved for future static images)
```

## How it works

- **QR generation** is done with the [`qrcode-generator`](https://github.com/kazuhikoarase/qrcode-generator) matrix encoder (loaded from cdnjs), which `js/qr-engine.js` renders itself onto `<canvas>` or as raw SVG — giving full control over color, gradients, module shape, margin, error-correction level, and a centered logo. No image is ever generated on a server.
- **Scanning** uses [`jsQR`](https://github.com/cozmo/jsQR) to decode frames pulled from `getUserMedia()` locally in the browser.
- **PDF export** uses [`jsPDF`](https://github.com/parallax/jsPDF) to embed the rendered PNG in a print-ready page.
- **History** is stored in `localStorage` only, capped at 12 entries, and never transmitted anywhere.
- All three libraries are static, client-side rendering/decoding utilities loaded from cdnjs — no data is ever sent to them or anywhere else.

## Running locally

No build step. Serve the folder with any static server, for example:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository (root, or a `/docs` folder).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch".
4. Choose your branch and the folder (`/root` or `/docs`) that contains `index.html`.
5. Save — GitHub will publish the site at `https://<username>.github.io/<repo>/`.

No environment variables, secrets, or server config are required.

## Before you launch

`index.html`, `sitemap.xml`, and `robots.txt` use a placeholder domain (`https://maar-qr.example.com/`) in the canonical link, Open Graph/Twitter tags, JSON-LD, and sitemap. Once you know your real GitHub Pages (or custom) URL, find-and-replace that placeholder with it.

## Notes

- Camera scanning requires HTTPS (GitHub Pages serves over HTTPS by default) and browser permission.
- Colors, fonts, and layout follow the design brief: Space Grotesk for display type, Inter for body text, and a deep emerald / dark teal / charcoal / gold palette, with a dark theme by default and a light theme toggle.
