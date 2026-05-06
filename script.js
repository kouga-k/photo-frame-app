// 状態
let eventsData = [];
let selectedEvent = null;
let selectedVariant = null;
let currentStream = null;
let facingMode = "environment";
let isLandscape = false;

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

// デザイン一覧を描画
function renderDesignList(ev) {
  designList.innerHTML = "";
  selectedVariant = null;
  ev.variants.forEach((v) => {
    const thumbSrc = bust(v.tate);
    const div = document.createElement("div");
    div.className = "frame-item";
    div.innerHTML = `<img src="${thumbSrc}" alt="${v.label}"><span class="frame-label">${v.label}</span>`;
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
  if (selectedVariant) {
    frameOverlay.src = bust(isLandscape ? selectedVariant.yoko : selectedVariant.tate);
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
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
}

// 撮影
function capture() {
  const flash = document.createElement("div");
  flash.className = "flash";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 400);

  const frameImg = new Image();
  frameImg.crossOrigin = "anonymous";
  frameImg.src = bust(isLandscape ? selectedVariant.yoko : selectedVariant.tate);

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

// イベント登録
document.getElementById("btn-start").addEventListener("click", () => {
  renderEventList();
  showScreen("event");
});

document.getElementById("btn-back-event").addEventListener("click", () => {
  showScreen("event");
});

document.getElementById("btn-to-camera").addEventListener("click", async () => {
  checkOrientation();
  frameOverlay.src = isLandscape ? selectedVariant.yoko : selectedVariant.tate;
  showScreen("camera");
  await startCamera();
});

document.getElementById("btn-capture").addEventListener("click", capture);

document.getElementById("btn-switch-camera").addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  await startCamera();
});

document.getElementById("btn-change-frame").addEventListener("click", () => {
  stopCamera();
  showScreen("design");
});

document.getElementById("btn-retake").addEventListener("click", async () => {
  checkOrientation();
  frameOverlay.src = isLandscape ? selectedVariant.yoko : selectedVariant.tate;
  showScreen("camera");
  await startCamera();
});

document.getElementById("btn-new-frame").addEventListener("click", () => {
  selectedVariant = null;
  document.getElementById("btn-to-camera").disabled = true;
  renderDesignList(selectedEvent);
  showScreen("design");
});

window.addEventListener("resize", checkOrientation);

loadFrames();
