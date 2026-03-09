// ============================================
// Vitalis Intro Cutscene System
// ============================================

// --- State ---
let introActive = false;
let introSceneIndex = 0;
let introTimer = 0;
let introOpacity = 0;
let introScrollY = 0;
let lastIntroTime = 0;

// --- Scene Data ---
const introScenes = [
    { type: "fadeText", text: ["The world was once whole.", "A place where life and decay moved in balance."], duration: 5000 },
    { type: "fadeText", text: ["But the Blight came without warning.", "It spread through soil, stone, and spirit...", "...until even the air began to rot."], duration: 7000 },
    { type: "imageSlide", image: "assets/intro/ruins.png", text: ["Only a few remained untouched.", "Those who carried the last spark of Vitalis."], duration: 6000 },
    { type: "lightPulse", text: ["And from that spark... a journey begins."], duration: 5000 },
    { type: "title", text: ["VITALIS"], duration: 4000 }
];

// --- Image Loader ---
const introImages = {};

function loadIntroImage(path) {
    if (!introImages[path]) {
        const img = new Image();
        img.src = path;
        introImages[path] = img;
    }
}

// --- Controller ---
function startIntro() {
    const c = document.getElementById('gameCanvas');
    introActive = true;
    introSceneIndex = 0;
    introTimer = 0;
    introOpacity = 0;
    introScrollY = c ? c.height : 600;
    lastIntroTime = performance.now();
    console.log('[Intro] Started');
}

function endIntro() {
    introActive = false;
    console.log('[Intro] Ended — launching game');
    // After intro ends, start the actual game
    if (typeof startGameAfterIntro === 'function') {
        startGameAfterIntro();
    }
}

// Skip intro on any key press
window.addEventListener("keydown", (e) => {
    if (introActive) {
        endIntro();
    }
});

// --- Update ---
function updateIntro(dt) {
    if (!introActive) return;
    const scene = introScenes[introSceneIndex];
    introTimer += dt;
    if (introTimer >= scene.duration) {
        introSceneIndex++;
        introTimer = 0;
        introOpacity = 0;
        const c = document.getElementById('gameCanvas');
        introScrollY = c ? c.height : 600;
        if (introSceneIndex >= introScenes.length) {
            endIntro();
            return;
        }
    }
}

// --- Renderers ---
function renderFadeText(ctx, scene) {
    introOpacity = Math.min(1, introOpacity + 0.01);
    ctx.globalAlpha = introOpacity;
    ctx.fillStyle = "#ffffff";
    ctx.font = "24px serif";
    ctx.textAlign = "center";
    scene.text.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, canvas.height / 2 + i * 30);
    });
    ctx.globalAlpha = 1;
}

function renderScrollText(ctx, scene) {
    introScrollY -= 0.3;
    ctx.fillStyle = "#ffffff";
    ctx.font = "22px serif";
    ctx.textAlign = "center";
    scene.text.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, introScrollY + i * 40);
    });
}

function renderImageSlide(ctx, scene) {
    loadIntroImage(scene.image);
    const img = introImages[scene.image];

    // Only draw if the image loaded successfully (not broken)
    if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#ffffff";
    ctx.font = "22px serif";
    ctx.textAlign = "center";

    scene.text.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, canvas.height - 120 + i * 30);
    });

    ctx.globalAlpha = 1;
}

function renderLightPulse(ctx, scene) {
    const pulse = Math.sin(introTimer * 0.005) * 0.5 + 0.5;

    ctx.fillStyle = `rgba(255,255,255,${pulse * 0.3})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "24px serif";
    ctx.textAlign = "center";

    scene.text.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, canvas.height / 2 + i * 30);
    });
}

function renderTitle(ctx, scene) {
    introOpacity = Math.min(1, introOpacity + 0.01);

    ctx.globalAlpha = introOpacity;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px 'Orbitron', sans-serif";
    ctx.textAlign = "center";

    // Add a glow effect matching the title screen
    ctx.shadowColor = "#ff8c00";
    ctx.shadowBlur = 30;
    ctx.fillText(scene.text[0], canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 1;
}

// --- Main Render Dispatcher ---
function renderIntro(ctx) {
    if (!introActive) return;

    const scene = introScenes[introSceneIndex];
    if (!scene) return;

    // Black background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dispatch to the correct renderer
    switch (scene.type) {
        case "fadeText":    renderFadeText(ctx, scene);    break;
        case "scrollText":  renderScrollText(ctx, scene);  break;
        case "imageSlide":  renderImageSlide(ctx, scene);  break;
        case "lightPulse":  renderLightPulse(ctx, scene);  break;
        case "title":       renderTitle(ctx, scene);       break;
    }

    // Skip hint
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Press any key to skip", canvas.width / 2, canvas.height - 30);
    ctx.globalAlpha = 1;
}

// --- Intro Game Loop (runs independently during intro) ---
function introLoop(timestamp) {
    if (!introActive) return;

    const dt = timestamp - lastIntroTime;
    lastIntroTime = timestamp;

    updateIntro(dt);
    renderIntro(ctx);

    requestAnimationFrame(introLoop);
}
