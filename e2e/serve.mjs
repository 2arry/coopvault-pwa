// Serve a built app (default ../dist-stage) with the same headers Firebase sends (firebase.json),
// pointing the CSP at a local API, so browser checks also catch blocked requests.
// usage: node serve.mjs [dist] [port] [apiOrigin]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const [, , distArg = '../dist-stage', port = '5173', apiOrigin = 'http://127.0.0.1:8100'] = process.argv
const dist = path.resolve(here, distArg)
const fb = JSON.parse(fs.readFileSync(path.join(here, '../firebase.json'), 'utf8')).hosting
const headers = Object.fromEntries(fb.headers[0].headers.map((h) => [h.key, h.value]))
headers['Content-Security-Policy'] = headers['Content-Security-Policy']
  .replace('https://api-payment.secureestate.app', apiOrigin)
  .replace('; upgrade-insecure-requests', '')
delete headers['Strict-Transport-Security']
const types = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' }

http.createServer((req, res) => {
  let file = path.join(dist, decodeURIComponent(req.url.split('?')[0]))
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
  res.writeHead(200, { ...headers, 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
}).listen(Number(port), '127.0.0.1', () => console.log(`serving ${dist} on ${port}`))
