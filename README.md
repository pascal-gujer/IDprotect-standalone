# ID Protect Offline

<p align="center">
  <a href="https://pascal-gujer.github.io/IDprotect-standalone/"><strong>Open the live app</strong></a>
  ·
  <a href="https://github.com/pascal-gujer/IDprotect-standalone/releases/latest">Download the latest release</a>
</p>

<p align="center">
  <sub>No install, build step, account, upload, backend, or localhost server required. The GitHub Pages copy is the same standalone browser app and still processes selected images locally on your device.</sub>
</p>

ID Protect Offline is a standalone browser app for adding purpose-specific
watermarks and solid redaction boxes to ID or passport scans before sharing
them. It runs entirely client-side from a self-contained `index.html`; there is
no server, upload, telemetry, CDN, cloud API, external font, tracking pixel, or
remote asset download.

## Run Offline

Fastest path: open the hosted copy at `https://pascal-gujer.github.io/IDprotect-standalone/`. It runs fully client-side; selected images are not uploaded.

For a fully offline copy:

1. Download `index.html` from the latest release or clone this repository.
2. Open `index.html` directly in a modern browser.
3. Do not start a local server; no `localhost` connection is required or used.
4. Select an ID or passport scan, crop if needed, add watermark/redactions, then export PNG or JPEG.

The app is designed to work from a direct `file://` open. The generated
`index.html` includes the complete HTML, CSS, and JavaScript, so the browser
does not need to load sibling files from the local filesystem or contact the
network.

## Features

- Drag-and-drop or file-picker raster image import.
- Live Canvas preview.
- Simple crop editing before export.
- Repeated diagonal watermark with editable text, date insertion, color,
  opacity, angle, spacing, offset, and bold/normal weight.
- Randomized watermark defaults for angle, opacity, spacing, offset, and size.
- Solid rectangular redaction boxes with movable/removable boxes.
- Before, after, and horizontal split comparison preview.
- PNG and JPEG export with JPEG quality control.
- Export redraws through Canvas, so source metadata and EXIF are not copied.
- English, German, and French interface translations.

## Source Layout

`index.html` is generated. For normal maintenance, edit these inputs instead:

- `src/index.template.html`: HTML shell with inline placeholders.
- `src/locales/*.json`: embedded English, German, and French UI translations.
- `src/styles.css`: application styles.
- `src/app.js`: Canvas editor and export logic.
- `tools/build.py`: standard-library build script.

## Build

The build uses only Python 3.9+ from the standard library. No npm install,
package manager, local web server, or network access is required.

```bash
python3 tools/build.py
```

This writes the generated standalone `index.html`.

To verify that the generated file matches the source inputs:

```bash
python3 tools/build.py --check
```

The build script intentionally rejects generated HTML that reintroduces
external-loading tags such as `<script src>`, `<link>`, `<iframe>`, `<object>`,
or `<embed>`.

## GitHub Automation

`.github/workflows/build-pages-release.yml` keeps the offline build honest in
CI:

- Pull requests and pushes verify `index.html` with `python3 tools/build.py --check`.
- The workflow runs a JavaScript syntax check on the maintained source.
- Pushes to `main` deploy the generated `index.html` and this README as the GitHub Pages site.
- Manual workflow runs can also deploy Pages from the selected ref with `deploy_pages`.
- Pushing a tag named `v*` creates a GitHub Release with `index.html` and `README.md` attached.
- Manual workflow runs can create a release tag by filling `release_tag`, for example `v1.2.3`.

The Pages deployment serves the same self-contained HTML artifact. The app
still processes images in the browser and does not require a server at runtime.
The top-corner GitHub sponsor ribbon is a plain link only; it does not load
external scripts, images, fonts, or tracking pixels.

## Why This Build Is Unusual

The target environment is restricted: it may allow opening one local HTML file
but reject `localhost`, local servers, remote URLs, CDNs, and even sibling
`file://` script loads because file URLs can be treated as unique security
origins. A normal web build that emits separate JavaScript chunks is therefore
less reliable for this deployment.

For that reason, the repository keeps maintainable source files, then compiles
them into one standalone HTML artifact. The final `index.html` is intentionally
self-contained so it can be saved, shared, archived, or opened offline as one
file.

## Privacy Notes

- Selected images stay in the current browser session.
- Exports are rendered through Canvas as new PNG/JPEG files.
- Original metadata and EXIF are not copied into the exported file.
- SVG imports are rejected; use raster images such as PNG, JPEG, AVIF, GIF,
  BMP, or WebP.

## Browser Compatibility

Use a recent Chrome, Edge, Firefox, or Safari with JavaScript, Canvas, Blob,
File API, `URL.createObjectURL`, and `createImageBitmap` or image element
decoding support enabled. Very locked-down enterprise browsers must allow
JavaScript execution in the opened local HTML file.
