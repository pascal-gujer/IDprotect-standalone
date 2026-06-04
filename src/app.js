(() => {
  "use strict";

  const READ_CONTEXT = { alpha: false, willReadFrequently: false };
  const IMAGE_NAME_RE = /\.(avif|bmp|gif|jpe?g|png|webp)$/i;
  const MIN_CROP_SIDE = 32;
  const MIN_BOX_SIDE = 8;
  const REDACTION_HANDLE_SIZE = 12;

  const DEFAULTS = {
    watermark: {
      text: "",
      fontSize: 48,
      color: "#0f766e",
      opacity: 0.24,
      angle: -28,
      spacingX: 330,
      spacingY: 170,
      offsetX: 0,
      offsetY: 0,
      bold: true
    },
    redactionColor: "#111827",
    jpegQuality: 0.92,
    compareSplit: 50,
    previewMode: "after",
    toolMode: "crop"
  };

  const elements = {
    statusDot: document.getElementById("statusDot"),
    statusText: document.getElementById("statusText"),
    resetButton: document.getElementById("resetButton"),
    exportJpegButton: document.getElementById("exportJpegButton"),
    exportPngButton: document.getElementById("exportPngButton"),
    pickButton: document.getElementById("pickButton"),
    fileInput: document.getElementById("fileInput"),
    dropzone: document.getElementById("dropzone"),
    imageMessage: document.getElementById("imageMessage"),
    canvasFrame: document.getElementById("canvasFrame"),
    canvas: document.getElementById("previewCanvas"),
    emptyPreview: document.getElementById("emptyPreview"),
    editMessage: document.getElementById("editMessage"),
    previewToolbar: document.querySelector(".preview-toolbar"),
    previewMode: document.getElementById("previewMode"),
    compareControl: document.getElementById("compareControl"),
    compareSplit: document.getElementById("compareSplit"),
    modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
    watermarkText: document.getElementById("watermarkText"),
    insertDateButton: document.getElementById("insertDateButton"),
    randomizeButton: document.getElementById("randomizeButton"),
    fontSize: document.getElementById("fontSize"),
    fontSizeValue: document.getElementById("fontSizeValue"),
    watermarkOpacity: document.getElementById("watermarkOpacity"),
    opacityValue: document.getElementById("opacityValue"),
    watermarkAngle: document.getElementById("watermarkAngle"),
    angleValue: document.getElementById("angleValue"),
    spacingX: document.getElementById("spacingX"),
    spacingXValue: document.getElementById("spacingXValue"),
    spacingY: document.getElementById("spacingY"),
    spacingYValue: document.getElementById("spacingYValue"),
    offsetX: document.getElementById("offsetX"),
    offsetXValue: document.getElementById("offsetXValue"),
    offsetY: document.getElementById("offsetY"),
    offsetYValue: document.getElementById("offsetYValue"),
    watermarkColor: document.getElementById("watermarkColor"),
    watermarkBold: document.getElementById("watermarkBold"),
    redactionColor: document.getElementById("redactionColor"),
    redactionMessage: document.getElementById("redactionMessage"),
    removeBoxButton: document.getElementById("removeBoxButton"),
    clearBoxesButton: document.getElementById("clearBoxesButton"),
    jpegQuality: document.getElementById("jpegQuality"),
    jpegQualityValue: document.getElementById("jpegQualityValue")
  };

  const ctx = elements.canvas.getContext("2d", READ_CONTEXT);

  const state = {
    image: null,
    crop: null,
    redactions: [],
    nextBoxId: 1,
    selectedBoxId: null,
    watermark: { ...DEFAULTS.watermark },
    redactionColor: DEFAULTS.redactionColor,
    jpegQuality: DEFAULTS.jpegQuality,
    compareSplit: DEFAULTS.compareSplit,
    previewMode: DEFAULTS.previewMode,
    toolMode: DEFAULTS.toolMode,
    interaction: null,
    renderQueued: false,
    error: false
  };

  let display = null;

  function cloneWatermarkDefaults() {
    return {
      ...DEFAULTS.watermark,
      text: `Only for Hotel XYZ - ${formatDisplayDate(new Date())}`
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatDisplayDate(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    return `${day}.${month}.${year}`;
  }

  function formatFileDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function sanitizeFilePart(value) {
    const cleaned = String(value || "")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return cleaned.slice(0, 48);
  }

  function setStatus(text, kind = "idle") {
    elements.statusText.textContent = text;
    elements.statusDot.classList.toggle("ready", kind === "ready");
    elements.statusDot.classList.toggle("error", kind === "error");
    state.error = kind === "error";
  }

  function setMessage(node, text, kind = "idle") {
    node.textContent = text;
    node.classList.toggle("error", kind === "error");
  }

  function requestRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    window.requestAnimationFrame(() => {
      state.renderQueued = false;
      render();
    });
  }

  function updateReadouts() {
    elements.fontSizeValue.textContent = `${state.watermark.fontSize}px`;
    elements.opacityValue.textContent = `${Math.round(state.watermark.opacity * 100)}%`;
    elements.angleValue.textContent = `${state.watermark.angle}deg`;
    elements.spacingXValue.textContent = `${state.watermark.spacingX}px`;
    elements.spacingYValue.textContent = `${state.watermark.spacingY}px`;
    elements.offsetXValue.textContent = `${state.watermark.offsetX}px`;
    elements.offsetYValue.textContent = `${state.watermark.offsetY}px`;
    elements.jpegQualityValue.textContent = `${Math.round(state.jpegQuality * 100)}%`;
  }

  function syncControls() {
    elements.watermarkText.value = state.watermark.text;
    elements.fontSize.value = String(state.watermark.fontSize);
    elements.watermarkOpacity.value = String(state.watermark.opacity);
    elements.watermarkAngle.value = String(state.watermark.angle);
    elements.spacingX.value = String(state.watermark.spacingX);
    elements.spacingY.value = String(state.watermark.spacingY);
    elements.offsetX.value = String(state.watermark.offsetX);
    elements.offsetY.value = String(state.watermark.offsetY);
    elements.watermarkColor.value = state.watermark.color;
    elements.watermarkBold.checked = state.watermark.bold;
    elements.redactionColor.value = state.redactionColor;
    elements.jpegQuality.value = String(state.jpegQuality);
    elements.previewMode.value = state.previewMode;
    elements.compareSplit.value = String(state.compareSplit);
    updateReadouts();
    updateModeButtons();
    updateButtons();
  }

  function updateButtons() {
    const hasImage = Boolean(state.image);
    const hasSelectedBox = Boolean(getSelectedBox());
    elements.exportPngButton.disabled = !hasImage;
    elements.exportJpegButton.disabled = !hasImage;
    elements.removeBoxButton.disabled = !hasSelectedBox;
    elements.clearBoxesButton.disabled = state.redactions.length === 0;
    elements.previewToolbar.hidden = state.toolMode !== "preview";
    elements.compareControl.hidden = state.previewMode !== "compare";
    elements.redactionMessage.textContent = state.redactions.length
      ? `${state.redactions.length} solid box${state.redactions.length === 1 ? "" : "es"}.`
      : "No boxes.";
  }

  function updateModeButtons() {
    elements.modeButtons.forEach((button) => {
      const active = button.dataset.mode === state.toolMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function setToolMode(mode) {
    if (!["crop", "redact", "preview"].includes(mode)) return;
    state.toolMode = mode;
    state.interaction = null;
    updateModeButtons();
    updateEditMessage();
    requestRender();
  }

  function updateEditMessage() {
    if (!state.image) {
      elements.editMessage.textContent = "Crop first, then draw solid redaction boxes and export.";
      return;
    }
    if (state.toolMode === "crop") {
      elements.editMessage.textContent = "Drag the crop edges, corners, or interior. Drag outside the crop to create a new crop.";
      return;
    }
    if (state.toolMode === "redact") {
      elements.editMessage.textContent = "Draw a rectangle to redact. Drag a selected box to move it, drag corner handles to resize it, or double-click it to remove it.";
      return;
    }
    elements.editMessage.textContent = "Preview shows the cropped export area with watermark and redactions baked in.";
  }

  function resetAll() {
    if (state.image && state.image.bitmap && typeof state.image.bitmap.close === "function") {
      state.image.bitmap.close();
    }
    state.image = null;
    state.crop = null;
    state.redactions = [];
    state.nextBoxId = 1;
    state.selectedBoxId = null;
    state.watermark = cloneWatermarkDefaults();
    state.redactionColor = DEFAULTS.redactionColor;
    state.jpegQuality = DEFAULTS.jpegQuality;
    state.compareSplit = DEFAULTS.compareSplit;
    state.previewMode = DEFAULTS.previewMode;
    state.toolMode = DEFAULTS.toolMode;
    state.interaction = null;
    elements.fileInput.value = "";
    setStatus("Ready. Load an image to begin.");
    setMessage(elements.imageMessage, "No image loaded.");
    syncControls();
    updateEditMessage();
    requestRender();
  }

  async function loadImageFile(file) {
    if (!file) return;
    if (file.type === "image/svg+xml" || /\.svgz?$/i.test(file.name || "")) {
      setStatus("SVG imports are not accepted for this privacy-focused tool.", "error");
      setMessage(elements.imageMessage, "Choose a raster image such as PNG, JPEG, AVIF, GIF, BMP, or WebP.", "error");
      return;
    }
    const looksLikeImage = file.type.startsWith("image/") || IMAGE_NAME_RE.test(file.name || "");
    if (!looksLikeImage) {
      setStatus("The selected file is not a supported image.", "error");
      setMessage(elements.imageMessage, "Choose a browser-supported image file.", "error");
      return;
    }

    setStatus("Loading image...");
    setMessage(elements.imageMessage, "Reading local file...");

    try {
      const bitmap = await decodeImage(file);
      if (state.image && state.image.bitmap && typeof state.image.bitmap.close === "function") {
        state.image.bitmap.close();
      }
      state.image = {
        bitmap,
        name: file.name || "image",
        width: bitmap.width,
        height: bitmap.height
      };
      state.crop = { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
      state.redactions = [];
      state.nextBoxId = 1;
      state.selectedBoxId = null;
      state.toolMode = "crop";
      fitDefaultsToImage();
      syncControls();
      setStatus("Image loaded. Edit locally and export when ready.", "ready");
      setMessage(
        elements.imageMessage,
        `${state.image.name} - ${bitmap.width} x ${bitmap.height}px. Export will strip metadata/EXIF.`
      );
      updateEditMessage();
      requestRender();
    } catch (error) {
      setStatus("Could not decode this image.", "error");
      setMessage(elements.imageMessage, error && error.message ? error.message : "The browser could not open this image.", "error");
    }
  }

  async function decodeImage(file) {
    if ("createImageBitmap" in window) {
      try {
        return await window.createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (_error) {
        return await window.createImageBitmap(file);
      }
    }

    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("The browser could not open this image."));
      };
      img.src = url;
    });
  }

  function fitDefaultsToImage() {
    if (!state.image) return;
    const shortSide = Math.min(state.image.width, state.image.height);
    const longSide = Math.max(state.image.width, state.image.height);
    state.watermark.fontSize = clamp(Math.round(shortSide / 15), 28, 112);
    state.watermark.spacingX = clamp(Math.round(longSide / 4), 180, 720);
    state.watermark.spacingY = clamp(Math.round(shortSide / 5), 90, 420);
    state.watermark.offsetX = 0;
    state.watermark.offsetY = 0;
  }

  function randomUnit() {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] / 0xffffffff;
  }

  function randomBetween(min, max) {
    return min + (max - min) * randomUnit();
  }

  function randomizeWatermark() {
    const baseSize = state.image ? Math.min(state.image.width, state.image.height) / 15 : DEFAULTS.watermark.fontSize;
    state.watermark.angle = Math.round(randomBetween(-38, -18));
    state.watermark.opacity = Number(randomBetween(0.16, 0.34).toFixed(2));
    state.watermark.fontSize = clamp(Math.round(baseSize * randomBetween(0.86, 1.22)), 24, 120);
    state.watermark.spacingX = clamp(Math.round((state.image ? Math.max(state.image.width, state.image.height) : 1100) / randomBetween(3.1, 4.6)), 160, 720);
    state.watermark.spacingY = clamp(Math.round((state.image ? Math.min(state.image.width, state.image.height) : 720) / randomBetween(4.2, 6.2)), 80, 420);
    state.watermark.offsetX = Math.round(randomBetween(-120, 120));
    state.watermark.offsetY = Math.round(randomBetween(-90, 90));
    syncControls();
    requestRender();
  }

  function insertDate() {
    const dateText = formatDisplayDate(new Date());
    const input = elements.watermarkText;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const value = input.value;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const leading = before.length > 0 && !/\s$/.test(before) ? " " : "";
    const trailing = after.length > 0 && !/^\s/.test(after) ? " " : "";
    const next = `${before}${leading}${dateText}${trailing}${after}`;
    state.watermark.text = next;
    input.value = next;
    const caret = start + leading.length + dateText.length;
    input.setSelectionRange(caret, caret);
    input.focus();
    requestRender();
  }

  function getSelectedBox() {
    return state.redactions.find((box) => box.id === state.selectedBoxId) || null;
  }

  function getCrop() {
    return state.crop || (state.image ? { x: 0, y: 0, w: state.image.width, h: state.image.height } : null);
  }

  function getRenderSource() {
    if (!state.image) return null;
    if (state.toolMode === "crop") {
      return { x: 0, y: 0, w: state.image.width, h: state.image.height };
    }
    return getCrop();
  }

  function render() {
    if (!state.image) {
      display = null;
      elements.canvas.classList.add("hidden");
      elements.emptyPreview.classList.remove("hidden");
      updateButtons();
      return;
    }

    const source = getRenderSource();
    const frameWidth = Math.max(280, elements.canvasFrame.clientWidth - 2);
    const maxHeight = clamp(window.innerHeight * 0.62, 300, 720);
    const aspect = source.w / source.h;
    let cssWidth = frameWidth;
    let cssHeight = cssWidth / aspect;
    if (cssHeight > maxHeight) {
      cssHeight = maxHeight;
      cssWidth = cssHeight * aspect;
    }
    cssWidth = Math.max(220, Math.round(cssWidth));
    cssHeight = Math.max(180, Math.round(cssHeight));

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    elements.canvas.width = Math.round(cssWidth * dpr);
    elements.canvas.height = Math.round(cssHeight * dpr);
    elements.canvas.style.width = `${cssWidth}px`;
    elements.canvas.style.height = `${cssHeight}px`;
    elements.canvas.classList.remove("hidden");
    elements.emptyPreview.classList.add("hidden");

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = "#eef2f7";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    display = {
      sourceX: source.x,
      sourceY: source.y,
      sourceW: source.w,
      sourceH: source.h,
      drawX: 0,
      drawY: 0,
      drawW: cssWidth,
      drawH: cssHeight,
      scale: cssWidth / source.w
    };

    if (state.toolMode === "crop") {
      drawCropEditor(cssWidth, cssHeight);
    } else if (state.toolMode === "redact") {
      drawProcessedCrop(ctx, 0, 0, cssWidth, cssHeight, { showSelection: true });
    } else {
      drawPreviewMode(cssWidth, cssHeight);
    }

    updateButtons();
  }

  function drawCropEditor(cssWidth, cssHeight) {
    ctx.drawImage(state.image.bitmap, 0, 0, state.image.width, state.image.height, 0, 0, cssWidth, cssHeight);
    const crop = getCrop();
    const rect = sourceRectToCanvas(crop);

    drawRedactionOutlines();

    ctx.save();
    ctx.fillStyle = "rgba(17, 24, 39, 0.52)";
    ctx.fillRect(0, 0, cssWidth, rect.y);
    ctx.fillRect(0, rect.y + rect.h, cssWidth, cssHeight - rect.y - rect.h);
    ctx.fillRect(0, rect.y, rect.x, rect.h);
    ctx.fillRect(rect.x + rect.w, rect.y, cssWidth - rect.x - rect.w, rect.h);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 3;
    ctx.strokeRect(rect.x + 1.5, rect.y + 1.5, Math.max(0, rect.w - 3), Math.max(0, rect.h - 3));
    drawCropHandles(rect);
    ctx.restore();
  }

  function drawCropHandles(rect) {
    const points = [
      [rect.x, rect.y],
      [rect.x + rect.w / 2, rect.y],
      [rect.x + rect.w, rect.y],
      [rect.x + rect.w, rect.y + rect.h / 2],
      [rect.x + rect.w, rect.y + rect.h],
      [rect.x + rect.w / 2, rect.y + rect.h],
      [rect.x, rect.y + rect.h],
      [rect.x, rect.y + rect.h / 2]
    ];
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 2;
    points.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.rect(x - 5, y - 5, 10, 10);
      ctx.fill();
      ctx.stroke();
    });
  }

  function drawRedactionOutlines() {
    const crop = getCrop();
    ctx.save();
    ctx.lineWidth = 2;
    state.redactions.forEach((box) => {
      const rect = sourceRectToCanvas(box);
      ctx.strokeStyle = box.id === state.selectedBoxId ? "#ffffff" : box.color;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      if (box.id === state.selectedBoxId) {
        ctx.strokeStyle = "#0f766e";
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(rect.x + 2, rect.y + 2, Math.max(0, rect.w - 4), Math.max(0, rect.h - 4));
        ctx.setLineDash([]);
      }
    });
    const cropRect = sourceRectToCanvas(crop);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    ctx.restore();
  }

  function drawPreviewMode(cssWidth, cssHeight) {
    if (state.previewMode === "before") {
      drawOriginalCrop(ctx, 0, 0, cssWidth, cssHeight);
      return;
    }
    if (state.previewMode === "compare") {
      drawOriginalCrop(ctx, 0, 0, cssWidth, cssHeight);
      const splitX = cssWidth * (state.compareSplit / 100);
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, cssWidth - splitX, cssHeight);
      ctx.clip();
      drawProcessedCrop(ctx, 0, 0, cssWidth, cssHeight, { showSelection: false });
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, cssHeight);
      ctx.stroke();
      ctx.strokeStyle = "#0f766e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, cssHeight);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#0f766e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(splitX, cssHeight / 2, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }
    drawProcessedCrop(ctx, 0, 0, cssWidth, cssHeight, { showSelection: false });
  }

  function drawOriginalCrop(targetCtx, destX, destY, destW, destH) {
    const crop = getCrop();
    targetCtx.save();
    targetCtx.fillStyle = "#ffffff";
    targetCtx.fillRect(destX, destY, destW, destH);
    targetCtx.drawImage(
      state.image.bitmap,
      crop.x,
      crop.y,
      crop.w,
      crop.h,
      destX,
      destY,
      destW,
      destH
    );
    targetCtx.restore();
  }

  function drawProcessedCrop(targetCtx, destX, destY, destW, destH, options) {
    const crop = getCrop();
    const scale = destW / crop.w;
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(destX, destY, destW, destH);
    targetCtx.clip();
    targetCtx.translate(destX, destY);
    targetCtx.scale(scale, destH / crop.h);
    targetCtx.fillStyle = "#ffffff";
    targetCtx.fillRect(0, 0, crop.w, crop.h);
    targetCtx.drawImage(state.image.bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    drawWatermark(targetCtx, crop.w, crop.h);
    drawRedactions(targetCtx, crop.x, crop.y, crop.w, crop.h);
    if (options && options.showSelection) {
      drawRedactionSelection(targetCtx, crop.x, crop.y, scale);
    }
    targetCtx.restore();
  }

  function drawWatermark(targetCtx, width, height) {
    const text = state.watermark.text.trim();
    if (!text) return;

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return;

    const fontSize = clamp(Number(state.watermark.fontSize) || 48, 8, 220);
    const spacingX = Math.max(40, Number(state.watermark.spacingX) || 300);
    const spacingY = Math.max(40, Number(state.watermark.spacingY) || 160);
    const angle = (Number(state.watermark.angle) || 0) * Math.PI / 180;
    const diagonal = Math.sqrt(width * width + height * height) * 1.25;
    const offsetX = Number(state.watermark.offsetX) || 0;
    const offsetY = Number(state.watermark.offsetY) || 0;
    const lineHeight = fontSize * 1.12;

    targetCtx.save();
    targetCtx.globalAlpha = clamp(Number(state.watermark.opacity) || 0.24, 0.01, 1);
    targetCtx.fillStyle = state.watermark.color || "#0f766e";
    targetCtx.font = `${state.watermark.bold ? "800" : "500"} ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    targetCtx.textAlign = "center";
    targetCtx.textBaseline = "middle";
    const blockOffset = -((lines.length - 1) * lineHeight) / 2;
    const lineMetrics = lines.map((line, index) => ({
      text: line,
      width: targetCtx.measureText(line).width,
      y: blockOffset + index * lineHeight
    }));
    const blockWidth = lineMetrics.reduce((maxWidth, line) => Math.max(maxWidth, line.width), 0);
    const blockHeight = Math.max(fontSize, (lineMetrics.length - 1) * lineHeight + fontSize);
    const effectiveSpacingX = Math.max(spacingX, blockWidth + fontSize * 0.8);
    const effectiveSpacingY = Math.max(spacingY, blockHeight + fontSize * 0.6);
    targetCtx.translate(width / 2, height / 2);
    targetCtx.rotate(angle);

    for (let y = -diagonal + offsetY; y <= diagonal; y += effectiveSpacingY) {
      for (let x = -diagonal + offsetX; x <= diagonal; x += effectiveSpacingX) {
        if (rotatedTextFitsImage(x, y, blockWidth, blockHeight, angle, width, height)) {
          lineMetrics.forEach((line) => {
            targetCtx.fillText(line.text, x, y + line.y);
          });
        }
      }
    }

    targetCtx.restore();
  }

  function rotatedTextFitsImage(localX, localY, textWidth, textHeight, angle, imageWidth, imageHeight) {
    const halfWidth = textWidth / 2;
    const halfHeight = textHeight / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const centerX = imageWidth / 2;
    const centerY = imageHeight / 2;
    const corners = [
      [localX - halfWidth, localY - halfHeight],
      [localX + halfWidth, localY - halfHeight],
      [localX + halfWidth, localY + halfHeight],
      [localX - halfWidth, localY + halfHeight]
    ];

    return corners.every(([x, y]) => {
      const imageX = centerX + x * cos - y * sin;
      const imageY = centerY + x * sin + y * cos;
      return imageX >= 0 && imageX <= imageWidth && imageY >= 0 && imageY <= imageHeight;
    });
  }

  function drawRedactions(targetCtx, originX, originY, width, height) {
    state.redactions.forEach((box) => {
      const clipped = intersectRects(box, { x: originX, y: originY, w: width, h: height });
      if (!clipped) return;
      targetCtx.fillStyle = box.color || state.redactionColor;
      targetCtx.fillRect(clipped.x - originX, clipped.y - originY, clipped.w, clipped.h);
    });
  }

  function drawRedactionSelection(targetCtx, originX, originY, scale) {
    const selected = getSelectedBox();
    if (!selected) return;
    const clipped = intersectRects(selected, getCrop());
    if (!clipped) return;
    targetCtx.save();
    targetCtx.lineWidth = 2 / Math.max(scale, 0.001);
    targetCtx.strokeStyle = "#ffffff";
    targetCtx.strokeRect(clipped.x - originX, clipped.y - originY, clipped.w, clipped.h);
    targetCtx.setLineDash([6 / Math.max(scale, 0.001), 5 / Math.max(scale, 0.001)]);
    targetCtx.strokeStyle = "#0f766e";
    targetCtx.strokeRect(clipped.x - originX, clipped.y - originY, clipped.w, clipped.h);
    drawRedactionHandles(targetCtx, clipped.x - originX, clipped.y - originY, clipped.w, clipped.h, scale);
    targetCtx.restore();
  }

  function drawRedactionHandles(targetCtx, x, y, width, height, scale) {
    const size = REDACTION_HANDLE_SIZE / Math.max(scale, 0.001);
    const half = size / 2;
    const handles = [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height]
    ];

    targetCtx.save();
    targetCtx.setLineDash([]);
    targetCtx.lineWidth = 2 / Math.max(scale, 0.001);
    targetCtx.fillStyle = "#ffffff";
    targetCtx.strokeStyle = "#0f766e";
    handles.forEach(([handleX, handleY]) => {
      targetCtx.beginPath();
      targetCtx.rect(handleX - half, handleY - half, size, size);
      targetCtx.fill();
      targetCtx.stroke();
    });
    targetCtx.restore();
  }

  function sourceRectToCanvas(rect) {
    if (!display) return { x: 0, y: 0, w: 0, h: 0 };
    return {
      x: (rect.x - display.sourceX) * display.scale + display.drawX,
      y: (rect.y - display.sourceY) * display.scale + display.drawY,
      w: rect.w * display.scale,
      h: rect.h * display.scale
    };
  }

  function pointerToSource(event, allowOutside) {
    if (!display) return null;
    const rect = elements.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    if (!allowOutside) {
      if (
        canvasX < display.drawX ||
        canvasY < display.drawY ||
        canvasX > display.drawX + display.drawW ||
        canvasY > display.drawY + display.drawH
      ) {
        return null;
      }
    }
    return {
      x: display.sourceX + (canvasX - display.drawX) / display.scale,
      y: display.sourceY + (canvasY - display.drawY) / display.scale
    };
  }

  function handlePointerDown(event) {
    if (!state.image || state.toolMode === "preview") return;
    const point = pointerToSource(event, false);
    if (!point) return;
    elements.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();

    if (state.toolMode === "crop") {
      startCropInteraction(point);
      requestRender();
      return;
    }

    startRedactionInteraction(point);
    requestRender();
  }

  function handlePointerMove(event) {
    if (!state.image) return;
    if (!state.interaction) {
      updatePointerCursor(event);
      return;
    }

    const point = pointerToSource(event, true);
    if (!point) return;
    event.preventDefault();

    if (state.interaction.type === "crop") {
      updateCropInteraction(point);
    } else if (state.interaction.type === "box-create") {
      updateBoxCreate(point);
    } else if (state.interaction.type === "box-move") {
      updateBoxMove(point);
    } else if (state.interaction.type === "box-resize") {
      updateBoxResize(point);
    }
    requestRender();
  }

  function handlePointerUp(event) {
    if (!state.interaction) return;
    if (state.interaction.type === "box-create") {
      const box = state.interaction.box;
      if (box.w < MIN_BOX_SIDE || box.h < MIN_BOX_SIDE) {
        state.redactions = state.redactions.filter((item) => item.id !== box.id);
        state.selectedBoxId = null;
      }
    }
    state.interaction = null;
    try {
      elements.canvas.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // Some browsers release automatically.
    }
    updateButtons();
    requestRender();
  }

  function handleCanvasDoubleClick(event) {
    if (!state.image || state.toolMode !== "redact") return;
    const point = pointerToSource(event, false);
    if (!point) return;
    const hit = hitRedaction(point);
    if (!hit) return;
    event.preventDefault();
    state.selectedBoxId = hit.id;
    removeSelectedBox();
  }

  function updatePointerCursor(event) {
    if (!state.image || state.toolMode === "preview") {
      elements.canvas.style.cursor = "default";
      return;
    }
    const point = pointerToSource(event, false);
    if (!point) {
      elements.canvas.style.cursor = "default";
      return;
    }
    if (state.toolMode === "redact") {
      const handle = hitSelectedRedactionHandle(point);
      if (handle) {
        elements.canvas.style.cursor = handleCursor(handle);
      } else {
        elements.canvas.style.cursor = hitRedaction(point) ? "move" : "crosshair";
      }
      return;
    }
    const hit = hitCrop(point);
    const cursors = {
      n: "ns-resize",
      s: "ns-resize",
      e: "ew-resize",
      w: "ew-resize",
      ne: "nesw-resize",
      sw: "nesw-resize",
      nw: "nwse-resize",
      se: "nwse-resize",
      move: "move",
      new: "crosshair"
    };
    elements.canvas.style.cursor = cursors[hit] || "default";
  }

  function startCropInteraction(point) {
    const hit = hitCrop(point);
    state.interaction = {
      type: "crop",
      hit,
      start: point,
      initial: { ...getCrop() }
    };
    if (hit === "new") {
      state.crop = clampCropRect({ x: point.x, y: point.y, w: MIN_CROP_SIDE, h: MIN_CROP_SIDE });
    }
  }

  function updateCropInteraction(point) {
    const action = state.interaction;
    const initial = action.initial;
    const dx = point.x - action.start.x;
    const dy = point.y - action.start.y;

    if (action.hit === "move") {
      state.crop = clampCropRect({ ...initial, x: initial.x + dx, y: initial.y + dy });
      return;
    }

    if (action.hit === "new") {
      state.crop = clampCropRect(rectFromPoints(action.start, point));
      return;
    }

    let left = initial.x;
    let top = initial.y;
    let right = initial.x + initial.w;
    let bottom = initial.y + initial.h;
    if (action.hit.includes("w")) left += dx;
    if (action.hit.includes("e")) right += dx;
    if (action.hit.includes("n")) top += dy;
    if (action.hit.includes("s")) bottom += dy;
    state.crop = clampCropRect({ x: left, y: top, w: right - left, h: bottom - top });
  }

  function hitCrop(point) {
    const crop = getCrop();
    const threshold = 12 / Math.max(display ? display.scale : 1, 0.001);
    const left = Math.abs(point.x - crop.x) <= threshold;
    const right = Math.abs(point.x - crop.x - crop.w) <= threshold;
    const top = Math.abs(point.y - crop.y) <= threshold;
    const bottom = Math.abs(point.y - crop.y - crop.h) <= threshold;
    const insideX = point.x >= crop.x - threshold && point.x <= crop.x + crop.w + threshold;
    const insideY = point.y >= crop.y - threshold && point.y <= crop.y + crop.h + threshold;

    if (top && left) return "nw";
    if (top && right) return "ne";
    if (bottom && left) return "sw";
    if (bottom && right) return "se";
    if (top && insideX) return "n";
    if (bottom && insideX) return "s";
    if (left && insideY) return "w";
    if (right && insideY) return "e";
    if (point.x >= crop.x && point.x <= crop.x + crop.w && point.y >= crop.y && point.y <= crop.y + crop.h) {
      return "move";
    }
    return "new";
  }

  function clampCropRect(rect) {
    if (!state.image) return rect;
    let x = rect.x;
    let y = rect.y;
    let w = rect.w;
    let h = rect.h;
    if (w < 0) {
      x += w;
      w = Math.abs(w);
    }
    if (h < 0) {
      y += h;
      h = Math.abs(h);
    }
    w = clamp(w, MIN_CROP_SIDE, state.image.width);
    h = clamp(h, MIN_CROP_SIDE, state.image.height);
    x = clamp(x, 0, state.image.width - w);
    y = clamp(y, 0, state.image.height - h);
    return {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h)
    };
  }

  function startRedactionInteraction(point) {
    const handle = hitSelectedRedactionHandle(point);
    if (handle) {
      const selected = getSelectedBox();
      state.interaction = {
        type: "box-resize",
        handle,
        start: point,
        box: selected,
        initial: { ...selected }
      };
      return;
    }

    const hit = hitRedaction(point);
    if (hit) {
      state.selectedBoxId = hit.id;
      if (hit.color) {
        state.redactionColor = hit.color;
        elements.redactionColor.value = hit.color;
      }
      state.interaction = {
        type: "box-move",
        start: point,
        box: hit,
        initial: { ...hit }
      };
      return;
    }

    const box = {
      id: state.nextBoxId++,
      x: point.x,
      y: point.y,
      w: 1,
      h: 1,
      color: state.redactionColor
    };
    state.redactions.push(box);
    state.selectedBoxId = box.id;
    state.interaction = {
      type: "box-create",
      start: point,
      box
    };
  }

  function updateBoxCreate(point) {
    const box = state.interaction.box;
    const rect = clampBoxToCrop(rectFromPoints(state.interaction.start, point));
    box.x = rect.x;
    box.y = rect.y;
    box.w = rect.w;
    box.h = rect.h;
  }

  function updateBoxMove(point) {
    const action = state.interaction;
    const dx = point.x - action.start.x;
    const dy = point.y - action.start.y;
    const next = clampBoxToCrop({
      ...action.initial,
      x: action.initial.x + dx,
      y: action.initial.y + dy
    });
    action.box.x = next.x;
    action.box.y = next.y;
    action.box.w = next.w;
    action.box.h = next.h;
  }

  function updateBoxResize(point) {
    const action = state.interaction;
    const initial = action.initial;
    const dx = point.x - action.start.x;
    const dy = point.y - action.start.y;
    let left = initial.x;
    let top = initial.y;
    let right = initial.x + initial.w;
    let bottom = initial.y + initial.h;

    if (action.handle.includes("w")) left += dx;
    if (action.handle.includes("e")) right += dx;
    if (action.handle.includes("n")) top += dy;
    if (action.handle.includes("s")) bottom += dy;

    const next = clampBoxToCrop({
      x: left,
      y: top,
      w: right - left,
      h: bottom - top
    }, MIN_BOX_SIDE);
    action.box.x = next.x;
    action.box.y = next.y;
    action.box.w = next.w;
    action.box.h = next.h;
  }

  function hitSelectedRedactionHandle(point) {
    const selected = getSelectedBox();
    if (!selected) return null;
    const visible = intersectRects(selected, getCrop());
    if (!visible) return null;
    const threshold = REDACTION_HANDLE_SIZE / Math.max(display ? display.scale : 1, 0.001);
    const handles = redactionHandlePoints(visible);
    for (const handle of handles) {
      if (
        Math.abs(point.x - handle.x) <= threshold &&
        Math.abs(point.y - handle.y) <= threshold
      ) {
        return handle.name;
      }
    }
    return null;
  }

  function redactionHandlePoints(rect) {
    return [
      { name: "nw", x: rect.x, y: rect.y },
      { name: "ne", x: rect.x + rect.w, y: rect.y },
      { name: "se", x: rect.x + rect.w, y: rect.y + rect.h },
      { name: "sw", x: rect.x, y: rect.y + rect.h }
    ];
  }

  function handleCursor(handle) {
    return (handle === "ne" || handle === "sw") ? "nesw-resize" : "nwse-resize";
  }

  function hitRedaction(point) {
    for (let index = state.redactions.length - 1; index >= 0; index -= 1) {
      const box = state.redactions[index];
      const visible = intersectRects(box, getCrop());
      if (!visible) continue;
      if (
        point.x >= visible.x &&
        point.x <= visible.x + visible.w &&
        point.y >= visible.y &&
        point.y <= visible.y + visible.h
      ) {
        return box;
      }
    }
    return null;
  }

  function clampBoxToCrop(rect, minSide = 1) {
    const crop = getCrop();
    let x = rect.x;
    let y = rect.y;
    let w = Math.max(1, rect.w);
    let h = Math.max(1, rect.h);
    if (w < 0) {
      x += w;
      w = Math.abs(w);
    }
    if (h < 0) {
      y += h;
      h = Math.abs(h);
    }
    w = clamp(w, minSide, crop.w);
    h = clamp(h, minSide, crop.h);
    x = clamp(x, crop.x, crop.x + crop.w - w);
    y = clamp(y, crop.y, crop.y + crop.h - h);
    return {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h)
    };
  }

  function rectFromPoints(a, b) {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x),
      h: Math.abs(a.y - b.y)
    };
  }

  function intersectRects(a, b) {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.w, b.x + b.w);
    const bottom = Math.min(a.y + a.h, b.y + b.h);
    if (right <= x || bottom <= y) return null;
    return { x, y, w: right - x, h: bottom - y };
  }

  function removeSelectedBox() {
    if (!state.selectedBoxId) return;
    state.redactions = state.redactions.filter((box) => box.id !== state.selectedBoxId);
    state.selectedBoxId = null;
    updateButtons();
    requestRender();
  }

  function clearBoxes() {
    state.redactions = [];
    state.selectedBoxId = null;
    updateButtons();
    requestRender();
  }

  async function exportImage(mimeType) {
    if (!state.image || !state.crop) return;
    const crop = getCrop();
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(crop.w));
    output.height = Math.max(1, Math.round(crop.h));
    const outputCtx = output.getContext("2d", READ_CONTEXT);
    outputCtx.fillStyle = "#ffffff";
    outputCtx.fillRect(0, 0, output.width, output.height);
    outputCtx.drawImage(state.image.bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, output.width, output.height);
    drawWatermark(outputCtx, output.width, output.height);
    drawRedactions(outputCtx, crop.x, crop.y, crop.w, crop.h);

    const quality = mimeType === "image/jpeg" ? state.jpegQuality : undefined;
    const blob = await canvasToBlob(output, mimeType, quality);
    const ext = mimeType === "image/jpeg" ? "jpg" : "png";
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = buildFileName(ext);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`Exported ${ext.toUpperCase()} with metadata/EXIF stripped.`, "ready");
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not create export file."));
        }
      }, mimeType, quality);
    });
  }

  function buildFileName(ext) {
    const base = sanitizeFilePart(state.image ? state.image.name : "");
    const prefix = base ? `${base}-` : "";
    return `${prefix}watermarked-id-${formatFileDate(new Date())}.${ext}`;
  }

  function bindEvents() {
    elements.pickButton.addEventListener("click", () => elements.fileInput.click());
    elements.dropzone.addEventListener("click", () => elements.fileInput.click());
    elements.dropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        elements.fileInput.click();
      }
    });
    elements.fileInput.addEventListener("change", () => {
      loadImageFile(elements.fileInput.files && elements.fileInput.files[0]);
    });

    ["dragenter", "dragover"].forEach((type) => {
      elements.dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        elements.dropzone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((type) => {
      elements.dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        elements.dropzone.classList.remove("dragover");
      });
    });
    elements.dropzone.addEventListener("drop", (event) => {
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      loadImageFile(file);
    });

    window.addEventListener("dragover", (event) => {
      if (event.dataTransfer && Array.from(event.dataTransfer.types || []).includes("Files")) {
        event.preventDefault();
      }
    });
    window.addEventListener("drop", (event) => {
      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
        event.preventDefault();
      }
    });

    elements.modeButtons.forEach((button) => {
      button.addEventListener("click", () => setToolMode(button.dataset.mode));
    });

    elements.previewMode.addEventListener("change", () => {
      state.previewMode = elements.previewMode.value;
      updateButtons();
      requestRender();
    });
    elements.compareSplit.addEventListener("input", () => {
      state.compareSplit = Number(elements.compareSplit.value);
      requestRender();
    });

    elements.watermarkText.addEventListener("input", () => {
      state.watermark.text = elements.watermarkText.value;
      requestRender();
    });
    bindNumericControl(elements.fontSize, "fontSize", Number);
    bindNumericControl(elements.watermarkOpacity, "opacity", Number);
    bindNumericControl(elements.watermarkAngle, "angle", (value) => Math.round(Number(value)));
    bindNumericControl(elements.spacingX, "spacingX", (value) => Math.round(Number(value)));
    bindNumericControl(elements.spacingY, "spacingY", (value) => Math.round(Number(value)));
    bindNumericControl(elements.offsetX, "offsetX", (value) => Math.round(Number(value)));
    bindNumericControl(elements.offsetY, "offsetY", (value) => Math.round(Number(value)));

    elements.watermarkColor.addEventListener("input", () => {
      state.watermark.color = elements.watermarkColor.value;
      requestRender();
    });
    elements.watermarkBold.addEventListener("change", () => {
      state.watermark.bold = elements.watermarkBold.checked;
      requestRender();
    });
    elements.redactionColor.addEventListener("input", () => {
      state.redactionColor = elements.redactionColor.value;
      const selected = getSelectedBox();
      if (selected) selected.color = state.redactionColor;
      requestRender();
    });
    elements.redactionColor.addEventListener("focus", () => {
      const selected = getSelectedBox();
      if (selected) elements.redactionColor.value = selected.color || state.redactionColor;
    });
    elements.jpegQuality.addEventListener("input", () => {
      state.jpegQuality = Number(elements.jpegQuality.value);
      updateReadouts();
    });

    elements.insertDateButton.addEventListener("click", insertDate);
    elements.randomizeButton.addEventListener("click", randomizeWatermark);
    elements.removeBoxButton.addEventListener("click", removeSelectedBox);
    elements.clearBoxesButton.addEventListener("click", clearBoxes);
    elements.resetButton.addEventListener("click", () => {
      if (state.image && !window.confirm("Discard the loaded image, crop, redactions, and watermark settings?")) return;
      resetAll();
    });
    elements.exportPngButton.addEventListener("click", () => exportImage("image/png"));
    elements.exportJpegButton.addEventListener("click", () => exportImage("image/jpeg"));

    elements.canvas.addEventListener("pointerdown", handlePointerDown);
    elements.canvas.addEventListener("pointermove", handlePointerMove);
    elements.canvas.addEventListener("pointerup", handlePointerUp);
    elements.canvas.addEventListener("pointercancel", handlePointerUp);
    elements.canvas.addEventListener("pointerleave", updatePointerCursor);
    elements.canvas.addEventListener("dblclick", handleCanvasDoubleClick);

    window.addEventListener("resize", requestRender);
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (state.toolMode !== "redact" || !getSelectedBox()) return;
      const target = event.target;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      removeSelectedBox();
    });
  }

  function bindNumericControl(input, key, parser) {
    input.addEventListener("input", () => {
      state.watermark[key] = parser(input.value);
      updateReadouts();
      requestRender();
    });
  }

  state.watermark = cloneWatermarkDefaults();
  bindEvents();
  syncControls();
  updateEditMessage();
  requestRender();
})();
