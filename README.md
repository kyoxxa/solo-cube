# Solo Cube

A minimalist, WebGL-rendered 3D Rubik's cube with face turns, orbit/zoom, keyboard shortcuts, scramble, and solve.

## Run locally
Open `index.html` in a modern browser. Because it uses ES modules from a CDN, serve the folder over HTTP if your browser blocks modules from `file://`:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy on GitHub Pages
1. Create a GitHub repository named `solo-cube`.
2. Upload `index.html`, `README.md`, and the `.github` folder.
3. In repository **Settings → Pages**, choose **GitHub Actions** as the build and deployment source.
4. Push to the default branch. The workflow deploys the static site automatically.

The app uses Three.js from jsDelivr and requires an internet connection to load the library.
