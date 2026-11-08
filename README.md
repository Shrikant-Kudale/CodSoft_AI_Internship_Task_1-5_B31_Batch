# AI Lab

A small collection of five beginner-level AI mini-projects, rebuilt as a static website so each one can be tried in the browser. These are playful, small-scale tasks built on simple rules and toy datasets. They are meant for learning and experimentation, not production use.

## Projects

| Page | Description |
|---|---|
| `/chatbot` | A rule-based chatbot. It matches keywords in your message to a fixed set of replies, so it only handles a limited set of topics and will often fall back to a generic answer. |
| `/tic-tac-toe` | Tic-Tac-Toe against an AI using the Minimax algorithm with alpha-beta pruning, with three difficulty levels. |
| `/image-recognition` | Image classification using a pre-trained ResNet-50 model run in the browser. It labels images using ImageNet categories, so results can be wrong or oddly specific, and it does not write real captions. |
| `/recommendations` | A content-based movie recommender using TF-IDF and cosine similarity on a small built-in list of about 70 movies. |
| `/face-detection` | Face detection on images, video files and webcam, using a pre-trained detector. It detects faces only and does not identify who they are. |

## Known limitations

- The chatbot is not a language model. It only understands the patterns written into it.
- Image recognition depends on a model downloaded from a CDN when you first open the page. If the download fails, the page falls back to a very basic description of colours and brightness.
- Face detection falls back to an approximate skin-colour method if the detector cannot load, and this is less accurate.
- The recommendation data is a small hand-written set, so suggestions are limited.

## Tech

- HTML, CSS and vanilla JavaScript (no build step)
- [Transformers.js](https://github.com/xenova/transformers.js) for image classification
- [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) for face detection

## Run locally

```bash
npx serve .
```

Then open `http://localhost:3000`. The webcam needs HTTPS or localhost.

## Deploy

Import the repository in Vercel, set the framework preset to **Other**, leave the build command and output directory empty, and deploy.

## Notes

Everything runs in the browser. No images, video or messages are sent to a server.
