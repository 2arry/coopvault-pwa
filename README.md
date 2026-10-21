# CoopVault PWA

Mobile-first Progressive Web App for cooperative members and admins, with a public landing page at `/`.
Members install it to their home screen (no app store needed) to see where they stand, save, borrow and repay.
Admins see who has paid this period, send WhatsApp reminders, confirm transfers and approve loans.

Built with Vue 3, Vite, Tailwind CSS, `vite-plugin-pwa` and Paystack InlineJS v2 (`@paystack/inline-js`), with
self-hosted Fraunces and Plus Jakarta Sans fonts so it works offline. Light and dark themes follow the phone's
setting, with a manual switch under Me → Appearance. It talks to the CoopVault Frappe app (separate repo).

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
```

The API URL is set in `.env.development` / `.env.production` (`VITE_API_URL`). The backend must list the
frontend origin in its `allow_cors` site config.

## Build & deploy to Firebase Hosting

```bash
npm run build
firebase login            # once
npm run deploy            # builds and deploys to the "pay-frappe" site of project app-cb28a
```

`firebase.json` targets the `pay-frappe` hosting site, rewrites all routes to `index.html` (SPA),
and serves the service worker uncached so updates roll out right away.

## Install on a phone

- **Android / Chrome:** open the site and tap **Install app** on the home screen card, or use the browser menu → *Install app*.
- **iPhone / Safari:** tap **Share** → **Add to Home Screen**.

## Icons

Icons are generated from `public/logo.svg`:

```bash
npm run icons
```
