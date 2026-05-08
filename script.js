// 状態
let eventsData = [];
let selectedEvent = null;
let selectedFrame = null; // { id, label, src }
let currentStream = null;
let facingMode = "environment";

// キャッシュ対策（起動ごとに新しい値）
const cacheBust = Date.now();
const bust = (url) => url + (url.includes("?") ? "&" : "?") + "v=" + cacheBust;

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
const canvasResult    = document.getElementById("canvas-result");
const imgResult       = document.getElementById("img-result");
const btnSave         = document.getElementById("btn-save");
const eventList       = document.getElementById("event-list");
const designList      = document.getElementById("design-list");
const countdownEl     = document.getElementById("countdown");
const zoomLabel       = document.getElementById("zoom-label");

// ズーム
let zoomLevel = 1.0;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.2;

function applyZoom() {
  const mirror = facingMode === "user" ? "scaleX(-1) " : "";
  video.style.transform = mirror + "scale(" + zoomLevel + ")";
  zoomLabel.textContent = zoomLevel.toFixed(1) + "倍";
}

function setZoom(z) {
  zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  applyZoom();
}

// 画面切替
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// frames.json 読み込み
async function loadFrames() {
  const res = await fetch(bust("frames.json"), { cache: "no-store" });
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

// デザイン一覧を描画（縦・横を別アイテムとして表示）
function renderDesignList(ev) {
  designList.innerHTML = "";
  selectedFrame = null;

  const frames = [];
  ev.variants.forEach((v) => {
    if (v.tate) frames.push({ id: v.id, label: v.label, src: v.tate });
  });

  frames.forEach((f) => {
    const div = document.createElement("div");
    div.className = "frame-item";
    div.innerHTML = `<img src="${bust(f.src)}" alt="${f.label}"><span class="frame-label">${f.label}</span>`;
    div.addEventListener("click", () => {
      document.querySelectorAll(".frame-item").forEach((el) => el.classList.remove("selected"));
      div.classList.add("selected");
      selectedFrame = f;
      document.getElementById("btn-to-camera").disabled = false;
    });
    designList.appendChild(div);
  });
}

// フレーム表示更新
function updateFrameOverlay() {
  if (selectedFrame) {
    frameOverlay.src = bust(selectedFrame.src);
  }
}

// カメラ表示エリアは CSS で 100% 固定

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
    applyZoom();
  } catch {
    alert("カメラを起動できませんでした。\nカメラの使用を許可してください。");
  }
}

// カメラ停止
function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
}

// フラッシュ演出
function flashEffect() {
  const flash = document.createElement("div");
  flash.className = "flash";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 400);
}

// 即撮影（1枚）
function captureSingle() {
  flashEffect();
  const frameImg = new Image();
  frameImg.crossOrigin = "anonymous";
  frameImg.src = bust(selectedFrame.src);
  frameImg.onload = () => {
    const shot = composeOne(frameImg);
    showBurstResults([shot]);
    stopCamera();
  };
  frameImg.onerror = () => alert("フレーム画像の読み込みに失敗しました。");
}

// カウントダウン → 連写
let countingDown = false;
async function captureWithCountdown() {
  if (countingDown) return;
  countingDown = true;
  countdownEl.classList.add("active");
  for (let i = 5; i > 0; i--) {
    countdownEl.textContent = i;
    await new Promise((r) => setTimeout(r, 1000));
  }
  countdownEl.classList.remove("active");
  countingDown = false;
  capture();
}

// 1枚合成して dataURL を返す
function composeOne(frameImg) {
  const w = frameImg.naturalWidth;
  const h = frameImg.naturalHeight;
  canvasResult.width = w;
  canvasResult.height = h;
  const ctx = canvasResult.getContext("2d");

  const va = video.videoWidth / video.videoHeight;
  const ca = w / h;
  let sw, sh;
  const cropZoom = Math.max(zoomLevel, 1);
  if (va > ca) {
    sh = video.videoHeight / cropZoom;
    sw = sh * ca;
  } else {
    sw = video.videoWidth / cropZoom;
    sh = sw / ca;
  }
  const sx = (video.videoWidth - sw) / 2;
  const sy = (video.videoHeight - sh) / 2;

  // 1.0倍未満は中央に縮小描画
  const dw = zoomLevel < 1 ? w * zoomLevel : w;
  const dh = zoomLevel < 1 ? h * zoomLevel : h;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  if (facingMode === "user") {
    ctx.save();
    ctx.translate(w - dx, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  ctx.drawImage(frameImg, 0, 0, w, h);
  return canvasResult.toDataURL("image/png");
}

// 連写撮影（3枚 0.3秒間隔）
function capture() {
  flashEffect();

  const frameImg = new Image();
  frameImg.crossOrigin = "anonymous";
  frameImg.src = bust(selectedFrame.src);

  frameImg.onload = async () => {
    const shots = [];
    for (let i = 0; i < 3; i++) {
      shots.push(composeOne(frameImg));
      if (i < 2) await new Promise((r) => setTimeout(r, 300));
    }
    showBurstResults(shots);
    stopCamera();
  };

  frameImg.onerror = () => alert("フレーム画像の読み込みに失敗しました。");
}

// 撮影結果を表示（1枚なら通常表示、3枚なら選択UI）
function showBurstResults(shots) {
  const thumbs = document.getElementById("burst-thumbs");
  const hint = document.querySelector(".burst-hint");
  thumbs.innerHTML = "";
  if (shots.length > 1) {
    hint.style.display = "";
    shots.forEach((dataUrl, i) => {
      const img = document.createElement("img");
      img.src = dataUrl;
      img.className = "burst-thumb" + (i === 0 ? " selected" : "");
      img.addEventListener("click", () => {
        document.querySelectorAll(".burst-thumb").forEach((el) => el.classList.remove("selected"));
        img.classList.add("selected");
        imgResult.src = dataUrl;
        btnSave.href = dataUrl;
      });
      thumbs.appendChild(img);
    });
  } else {
    hint.style.display = "none";
  }
  imgResult.src = shots[0];
  btnSave.href = shots[0];
  showScreen("save");
}

// イベント登録
document.getElementById("btn-start").addEventListener("click", () => {
  renderEventList();
  showScreen("event");
});

document.getElementById("btn-back-event").addEventListener("click", () => {
  showScreen("event");
});

document.getElementById("btn-to-camera").addEventListener("click", async () => {
  showScreen("camera");
  updateFrameOverlay();
  await startCamera();
});

document.getElementById("btn-capture").addEventListener("click", captureSingle);
document.getElementById("btn-timer").addEventListener("click", captureWithCountdown);

document.getElementById("btn-switch-camera").addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  await startCamera();
});

document.getElementById("btn-zoom-in").addEventListener("click", () => setZoom(zoomLevel + ZOOM_STEP));
document.getElementById("btn-zoom-out").addEventListener("click", () => setZoom(zoomLevel - ZOOM_STEP));


document.getElementById("btn-change-frame").addEventListener("click", () => {
  stopCamera();
  showScreen("design");
});

document.getElementById("btn-retake").addEventListener("click", async () => {
  showScreen("camera");
  updateFrameOverlay();
  await startCamera();
});

document.getElementById("btn-new-frame").addEventListener("click", () => {
  selectedFrame = null;
  document.getElementById("btn-to-camera").disabled = true;
  renderDesignList(selectedEvent);
  showScreen("design");
});

loadFrames();
