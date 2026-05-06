// フレーム定義
const FRAMES = [
  { id: "mother", label: "母の日", tate: "frames/mother_tate.png", yoko: "frames/mother_yoko.png" },
  { id: "father", label: "父の日", tate: "frames/father_tate.png", yoko: "frames/father_yoko.png" },
  { id: "keirou", label: "敬老会", tate: "frames/keirou_tate.png", yoko: "frames/keirou_yoko.png" },
  { id: "birthday", label: "誕生日", tate: "frames/birthday_tate.png", yoko: "frames/birthday_yoko.png" },
  { id: "christmas", label: "クリスマス", tate: "frames/christmas_tate.png", yoko: "frames/christmas_yoko.png" },
];

// 状態
let selectedFrame = null;
let currentStream = null;
let facingMode = "environment";
let isLandscape = false;

// 要素取得
const screens = {
  top: document.getElementById("screen-top"),
  select: document.getElementById("screen-select"),
  camera: document.getElementById("screen-camera"),
  save: document.getElementById("screen-save"),
};

const video = document.getElementById("video");
const frameOverlay = document.getElementById("frame-overlay");
const cameraContainer = document.getElementById("camera-container");
const canvasResult = document.getElementById("canvas-result");
const imgResult = document.getElementById("img-result");
const btnSave = document.getElementById("btn-save");
const frameList = document.getElementById("frame-list");

// 画面切替
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// フレーム一覧を描画
function renderFrameList() {
  frameList.innerHTML = "";
  FRAMES.forEach((frame) => {
    const div = document.createElement("div");
    div.className = "frame-item";
    div.innerHTML = `<img src="${frame.tate}" alt="${frame.label}"><span class="frame-label">${frame.label}</span>`;
    div.addEventListener("click", () => {
      document.querySelectorAll(".frame-item").forEach((el) => el.classList.remove("selected"));
      div.classList.add("selected");
      selectedFrame = frame;
      document.getElementById("btn-to-camera").disabled = false;
    });
    frameList.appendChild(div);
  });
}

// 縦横判定
function checkOrientation() {
  isLandscape = window.innerWidth > window.innerHeight;
  if (cameraContainer) {
    cameraContainer.classList.toggle("landscape", isLandscape);
  }
  if (selectedFrame && frameOverlay.src) {
    frameOverlay.src = isLandscape ? selectedFrame.yoko : selectedFrame.tate;
  }
}

// カメラ起動
async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
  }
  try {
    const constraints = {
      video: {
        facingMode: facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;
    await video.play();
  } catch (err) {
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
  // フラッシュ効果
  const flash = document.createElement("div");
  flash.className = "flash";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 400);

  const frameImg = new Image();
  frameImg.crossOrigin = "anonymous";
  frameImg.src = isLandscape ? selectedFrame.yoko : selectedFrame.tate;

  frameImg.onload = () => {
    const w = frameImg.naturalWidth;
    const h = frameImg.naturalHeight;

    canvasResult.width = w;
    canvasResult.height = h;
    const ctx = canvasResult.getContext("2d");

    // カメラ映像を描画
    const videoAspect = video.videoWidth / video.videoHeight;
    const canvasAspect = w / h;
    let sx, sy, sw, sh;

    if (videoAspect > canvasAspect) {
      sh = video.videoHeight;
      sw = sh * canvasAspect;
      sx = (video.videoWidth - sw) / 2;
      sy = 0;
    } else {
      sw = video.videoWidth;
      sh = sw / canvasAspect;
      sx = 0;
      sy = (video.videoHeight - sh) / 2;
    }

    // 前面カメラの場合は左右反転
    if (facingMode === "user") {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    }

    // フレームを重ねる
    ctx.drawImage(frameImg, 0, 0, w, h);

    // プレビュー表示
    const dataUrl = canvasResult.toDataURL("image/png");
    imgResult.src = dataUrl;
    btnSave.href = dataUrl;

    showScreen("save");
    stopCamera();
  };

  frameImg.onerror = () => {
    alert("フレーム画像の読み込みに失敗しました。");
  };
}

// イベント設定
document.getElementById("btn-start").addEventListener("click", () => {
  renderFrameList();
  showScreen("select");
});

document.getElementById("btn-to-camera").addEventListener("click", async () => {
  checkOrientation();
  frameOverlay.src = isLandscape ? selectedFrame.yoko : selectedFrame.tate;
  showScreen("camera");
  await startCamera();
});

document.getElementById("btn-back-top").addEventListener("click", () => {
  showScreen("top");
});

document.getElementById("btn-capture").addEventListener("click", () => {
  capture();
});

document.getElementById("btn-switch-camera").addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  await startCamera();
});

document.getElementById("btn-change-frame").addEventListener("click", () => {
  stopCamera();
  showScreen("select");
});

document.getElementById("btn-retake").addEventListener("click", async () => {
  checkOrientation();
  frameOverlay.src = isLandscape ? selectedFrame.yoko : selectedFrame.tate;
  showScreen("camera");
  await startCamera();
});

document.getElementById("btn-new-frame").addEventListener("click", () => {
  selectedFrame = null;
  document.getElementById("btn-to-camera").disabled = true;
  renderFrameList();
  showScreen("select");
});

// 画面回転時のフレーム切替
window.addEventListener("resize", () => {
  checkOrientation();
});

// 前面カメラの映像を反転表示
const style = document.createElement("style");
document.head.appendChild(style);

const observer = new MutationObserver(() => {
  if (facingMode === "user") {
    video.style.transform = "scaleX(-1)";
  } else {
    video.style.transform = "";
  }
});

video.addEventListener("loadedmetadata", () => {
  if (facingMode === "user") {
    video.style.transform = "scaleX(-1)";
  } else {
    video.style.transform = "";
  }
});
