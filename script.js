// 状態
let eventsData = [];
let selectedEvent = null;
let selectedVariant = null;
let currentStream = null;
let facingMode = "environment";
let isLandscape = false;

// 背景合成モード用
let isBackgroundMode = false;
let segmentation = null;
let bgImage = null;
let compositeLoop = null;
let segmentationReady = false;

// 要素
const screens = {
  top:    document.getElementById("screen-top"),
  event:  document.getElementById("screen-event"),
  design: document.getElementById("screen-design"),
  camera: document.getElementById("screen-camera"),
  save:   document.getElementById("screen-save"),
};

const video           = document.getElementById("video");
const frameOverlay    = document.getElementById("frame-overlay");
const cameraContainer = document.getElementById("camera-container");
const compositeCanvas = document.getElementById("composite-canvas");
const canvasResult    = document.getElementById("canvas-result");
const imgResult       = document.getElementById("img-result");
const btnSave         = document.getElementById("btn-save");
const eventList       = document.getElementById("event-list");
const designList      = document.getElementById("design-list");
const loadingOverlay  = document.getElementById("loading-overlay");

// 画面切替
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// frames.json 読み込み
async function loadFrames() {
  const res = await fetch("frames.json");
  eventsData = await res.json();
}

// イベント一覧を描画
function renderEventList() {
  eventList.innerHTML = "";
  eventsData.forEach((ev) => {
    const div = document.createElement("div");
    div.className = "event-item";
    div.innerHTML = `<span class="event-emoji">${ev.emoji}</span><span class="event-label">${ev.label}</span>`;
    div.addEventListener("click", () => {
      selectedEvent = ev;
      renderDesignList(ev);
      document.getElementById("design-event-title").textContent = ev.label + " のデザイン";
      document.getElementById("btn-to-camera").disabled = true;
      showScreen("design");
    });
    eventList.appendChild(div);
  });
}

// デザイン一覧を描画
function renderDesignList(ev) {
  designList.innerHTML = "";
  selectedVariant = null;
  ev.variants.forEach((v) => {
    const isBackground = v.type === "background";
    const thumbSrc = isBackground ? v.src : v.tate;
    const div = document.createElement("div");
    div.className = "frame-item";
    div.innerHTML = `
      <img src="${thumbSrc}" alt="${v.label}">
      <span class="frame-label">${v.label}</span>
      ${isBackground ? '<span class="badge-bg">背景合成</span>' : ""}
    `;
    div.addEventListener("click", () => {
      document.querySelectorAll(".frame-item").forEach((el) => el.classList.remove("selected"));
      div.classList.add("selected");
      selectedVariant = v;
      document.getElementById("btn-to-camera").disabled = false;
    });
    designList.appendChild(div);
  });
}

// 縦横判定
function checkOrientation() {
  isLandscape = window.innerWidth > window.innerHeight;
  cameraContainer.classList.toggle("landscape", isLandscape);
  if (selectedVariant && selectedVariant.type !== "background") {
    frameOverlay.src = isLandscape ? selectedVariant.yoko : selectedVariant.tate;
  }
}

// カメラ起動
async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
  }
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    video.srcObject = currentStream;
    await video.play();
    video.style.transform = facingMode === "user" ? "scaleX(-1)" : "";
  } catch {
    alert("カメラを起動できませんでした。\nカメラの使用を許可してください。");
  }
}

// カメラ停止
function stopCamera() {
  stopCompositeLoop();
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
}

// =====================
// 背景合成モード
// =====================

// MediaPipe 読み込み
function loadMediaPipe() {
  return new Promise((resolve, reject) => {
    if (window.SelfieSegmentation) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js";
    s.crossOrigin = "anonymous";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// 背景合成の初期化
async function initBackgroundMode(bgSrc) {
  loadingOverlay.style.display = "flex";
  try {
    await loadMediaPipe();

    // 背景画像を読み込む
    bgImage = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = bgSrc;
    });

    // セグメンテーション初期化
    segmentation = new SelfieSegmentation({
      locateFile: (f) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`,
    });
    segmentation.setOptions({ modelSelection: 1, selfieMode: facingMode === "user" });
    segmentation.onResults(onSegmentationResults);

    // 最初のフレームを送って初期化
    await segmentation.initialize();

    segmentationReady = true;
    startCompositeLoop();
  } catch (e) {
    alert("背景合成の読み込みに失敗しました。\nインターネット接続を確認してください。");
    console.error(e);
  } finally {
    loadingOverlay.style.display = "none";
  }
}

// 合成ループ
function startCompositeLoop() {
  compositeCanvas.style.display = "block";
  frameOverlay.style.display = "none";

  // キャンバスサイズをビデオに合わせる
  video.addEventListener("loadedmetadata", syncCanvasSize, { once: true });
  if (video.videoWidth) syncCanvasSize();

  async function loop() {
    if (!segmentationReady || !currentStream) return;
    try {
      await segmentation.send({ image: video });
    } catch (_) {}
    compositeLoop = requestAnimationFrame(loop);
  }
  compositeLoop = requestAnimationFrame(loop);
}

function syncCanvasSize() {
  compositeCanvas.width  = video.videoWidth  || 1080;
  compositeCanvas.height = video.videoHeight || 1920;
}

function stopCompositeLoop() {
  if (compositeLoop) {
    cancelAnimationFrame(compositeLoop);
    compositeLoop = null;
  }
  compositeCanvas.style.display = "none";
  frameOverlay.style.display = "";
  segmentationReady = false;
  segmentation = null;
  bgImage = null;
}

// セグメンテーション結果の処理
function onSegmentationResults(results) {
  const ctx = compositeCanvas.getContext("2d");
  const w = compositeCanvas.width;
  const h = compositeCanvas.height;

  ctx.clearRect(0, 0, w, h);

  // 背景を描画
  ctx.drawImage(bgImage, 0, 0, w, h);

  // 人物部分だけを切り抜いて重ねる
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tCtx = tmp.getContext("2d");

  // ビデオフレームを描画（前面カメラは反転）
  if (facingMode === "user") {
    tCtx.save();
    tCtx.translate(w, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(results.image, 0, 0, w, h);
    tCtx.restore();
  } else {
    tCtx.drawImage(results.image, 0, 0, w, h);
  }

  // マスクで人物だけ残す
  tCtx.globalCompositeOperation = "destination-in";
  tCtx.drawImage(results.segmentationMask, 0, 0, w, h);

  // 背景の上に合成
  ctx.drawImage(tmp, 0, 0);
}

// =====================
// 撮影（フレーム・背景両対応）
// =====================
function capture() {
  const flash = document.createElement("div");
  flash.className = "flash";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 400);

  if (isBackgroundMode) {
    // 背景合成モード：compositeCanvasをそのまま保存
    const dataUrl = compositeCanvas.toDataURL("image/png");
    imgResult.src = dataUrl;
    btnSave.href = dataUrl;
    showScreen("save");
    stopCamera();
    return;
  }

  // フレームモード
  const frameImg = new Image();
  frameImg.crossOrigin = "anonymous";
  frameImg.src = isLandscape ? selectedVariant.yoko : selectedVariant.tate;

  frameImg.onload = () => {
    const w = frameImg.naturalWidth;
    const h = frameImg.naturalHeight;
    canvasResult.width = w;
    canvasResult.height = h;
    const ctx = canvasResult.getContext("2d");

    const va = video.videoWidth / video.videoHeight;
    const ca = w / h;
    let sx, sy, sw, sh;
    if (va > ca) {
      sh = video.videoHeight; sw = sh * ca;
      sx = (video.videoWidth - sw) / 2; sy = 0;
    } else {
      sw = video.videoWidth; sh = sw / ca;
      sx = 0; sy = (video.videoHeight - sh) / 2;
    }

    if (facingMode === "user") {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    }

    ctx.drawImage(frameImg, 0, 0, w, h);
    const dataUrl = canvasResult.toDataURL("image/png");
    imgResult.src = dataUrl;
    btnSave.href = dataUrl;
    showScreen("save");
    stopCamera();
  };

  frameImg.onerror = () => alert("フレーム画像の読み込みに失敗しました。");
}

// =====================
// イベント登録
// =====================
document.getElementById("btn-start").addEventListener("click", () => {
  renderEventList();
  showScreen("event");
});

document.getElementById("btn-back-event").addEventListener("click", () => {
  showScreen("event");
});

document.getElementById("btn-to-camera").addEventListener("click", async () => {
  isBackgroundMode = selectedVariant.type === "background";
  checkOrientation();

  if (isBackgroundMode) {
    frameOverlay.src = "";
    showScreen("camera");
    await startCamera();
    await initBackgroundMode(selectedVariant.src);
  } else {
    frameOverlay.src = isLandscape ? selectedVariant.yoko : selectedVariant.tate;
    showScreen("camera");
    await startCamera();
  }
});

document.getElementById("btn-capture").addEventListener("click", capture);

document.getElementById("btn-switch-camera").addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  if (isBackgroundMode && segmentation) {
    segmentation.setOptions({ selfieMode: facingMode === "user" });
  }
  await startCamera();
});

document.getElementById("btn-change-frame").addEventListener("click", () => {
  stopCamera();
  showScreen("design");
});

document.getElementById("btn-retake").addEventListener("click", async () => {
  isBackgroundMode = selectedVariant.type === "background";
  checkOrientation();
  showScreen("camera");
  await startCamera();
  if (isBackgroundMode) {
    await initBackgroundMode(selectedVariant.src);
  }
});

document.getElementById("btn-new-frame").addEventListener("click", () => {
  selectedVariant = null;
  document.getElementById("btn-to-camera").disabled = true;
  renderDesignList(selectedEvent);
  showScreen("design");
});

window.addEventListener("resize", checkOrientation);

// 起動時にframes.json読み込み
loadFrames();
