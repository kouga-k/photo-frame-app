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
const faceCanvas      = document.getElementById("face-overlay");
const faceCtx         = faceCanvas.getContext("2d");
const countdownEl     = document.getElementById("countdown");

// 顔検出
let faceDetector = null;
let detectionRunning = false;

async function initFaceDetection() {
  if (typeof FaceDetection === "undefined") return;
  try {
    faceDetector = new FaceDetection({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${f}`,
    });
    faceDetector.setOptions({ model: "short", minDetectionConfidence: 0.5 });
    faceDetector.onResults(onFaceResults);
  } catch (e) {
    faceDetector = null;
  }
}

function onFaceResults(results) {
  if (!video.videoWidth) return;
  faceCanvas.width = video.videoWidth;
  faceCanvas.height = video.videoHeight;
  faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
  if (!results.detections) return;
  for (const det of results.detections) {
    const bb = det.boundingBox;
    const cx = bb.xCenter * faceCanvas.width;
    const cy = bb.yCenter * faceCanvas.height;
    const r = Math.max(bb.width * faceCanvas.width, bb.height * faceCanvas.height) / 2 * 1.15;
    faceCtx.strokeStyle = "#FFD700";
    faceCtx.lineWidth = 5;
    faceCtx.beginPath();
    faceCtx.arc(cx, cy, r, 0, Math.PI * 2);
    faceCtx.stroke();
  }
}

async function detectLoop() {
  if (!detectionRunning || !faceDetector) return;
  if (video.readyState >= 2) {
    try { await faceDetector.send({ image: video }); } catch {}
  }
  setTimeout(detectLoop, 150);
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
    if (v.tate) frames.push({ id: v.id + "_tate", label: v.label + "（縦）", src: v.tate, orientation: "tate" });
    if (v.yoko && v.yoko !== v.tate) frames.push({ id: v.id + "_yoko", label: v.label + "（横）", src: v.yoko, orientation: "yoko" });
  });

  frames.forEach((f) => {
    const div = document.createElement("div");
    div.className = "frame-item frame-item-" + f.orientation;
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
    cameraContainer.classList.toggle("landscape", selectedFrame.orientation === "yoko");
    updateRotation();
  }
}

// 横フレーム×縦画面なら90度回転して大きく表示
function updateRotation() {
  if (!selectedFrame) return;
  const wrapper = document.querySelector(".camera-wrapper");
  if (!wrapper) return;
  const W = wrapper.clientWidth;
  const H = wrapper.clientHeight;
  const isPortraitScreen = H > W;
  const isYoko = selectedFrame.orientation === "yoko";

  if (isYoko && isPortraitScreen) {
    let w, h;
    if ((16 / 9) * W <= H) {
      h = W;
      w = (16 / 9) * W;
    } else {
      w = H;
      h = (9 / 16) * H;
    }
    cameraContainer.style.width = w + "px";
    cameraContainer.style.height = h + "px";
    cameraContainer.classList.add("rotated");
  } else {
    cameraContainer.style.width = "";
    cameraContainer.style.height = "";
    cameraContainer.classList.remove("rotated");
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
    const mirror = facingMode === "user" ? "scaleX(-1)" : "";
    video.style.transform = mirror;
    faceCanvas.style.transform = mirror;
    if (!faceDetector) await initFaceDetection();
    if (!detectionRunning) {
      detectionRunning = true;
      detectLoop();
    }
  } catch {
    alert("カメラを起動できませんでした。\nカメラの使用を許可してください。");
  }
}

// カメラ停止
function stopCamera() {
  detectionRunning = false;
  faceCtx && faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
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
  updateFrameOverlay();
  showScreen("camera");
  await startCamera();
});

document.getElementById("btn-capture").addEventListener("click", captureSingle);
document.getElementById("btn-timer").addEventListener("click", captureWithCountdown);

document.getElementById("btn-switch-camera").addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  await startCamera();
});

document.getElementById("btn-change-frame").addEventListener("click", () => {
  stopCamera();
  showScreen("design");
});

document.getElementById("btn-retake").addEventListener("click", async () => {
  updateFrameOverlay();
  showScreen("camera");
  await startCamera();
});

document.getElementById("btn-new-frame").addEventListener("click", () => {
  selectedFrame = null;
  document.getElementById("btn-to-camera").disabled = true;
  renderDesignList(selectedEvent);
  showScreen("design");
});

window.addEventListener("resize", updateRotation);
window.addEventListener("orientationchange", () => setTimeout(updateRotation, 300));

loadFrames();
