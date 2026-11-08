# AI Lab

Five interactive AI tools as a static site. No build step and no backend.

| Route | Tool |
|---|---|
| `/` | Home |
| `/chatbot` | Rule-based assistant (intent matching, safe calculator, name memory) |
| `/tic-tac-toe` | Minimax + alpha-beta AI, 3 difficulty levels |
| `/image-recognition` | ResNet-50 in the browser (Transformers.js), pixel-analysis fallback |
| `/recommendations` | TF-IDF + cosine similarity movie recommender (70 built-in titles) |
| `/face-detection` | MediaPipe BlazeFace -> native FaceDetector -> colour heuristic fallback |

## Deploy on Vercel
1. Push this folder to a GitHub repo, then **Add New > Project** in Vercel and import it.
2. Framework preset: **Other**. Leave Build Command and Output Directory empty.
3. Deploy. `vercel.json` already enables clean URLs (`/chatbot`, not `/chatbot.html`).

Or with the CLI: `npx vercel --prod` from this folder.

## Run locally
`npx serve .` then open http://localhost:3000 (the webcam needs HTTPS or localhost).

## Notes
- The first visit to Image Recognition downloads the model (~25-100 MB) from a CDN, then the browser caches it.
- Face detection models load from jsDelivr / Google Storage. If they are blocked, the pages switch to a basic mode and say so.
- Everything runs on the visitor's device; no images or video are uploaded.
