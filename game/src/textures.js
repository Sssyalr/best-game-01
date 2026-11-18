// FERROX-9 — procedural textures, painted on canvases at load time.
// No image files ship with the game; every surface is generated here,
// which keeps the whole game self-contained and offline.

import * as THREE from 'three';

function canvasTexture(size, painter, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  painter(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function speckle(ctx, size, count, colors, alphaMin, alphaMax, radiusMax) {
  for (let i = 0; i < count; i++) {
    const c = colors[(Math.random() * colors.length) | 0];
    ctx.globalAlpha = alphaMin + Math.random() * (alphaMax - alphaMin);
    ctx.fillStyle = c;
    const r = 0.5 + Math.random() * radiusMax;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Dark foundry floor: riveted metal plates with ember dust in the seams.
export function floorTexture() {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#26232b';
    ctx.fillRect(0, 0, s, s);
    const plate = s / 4;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const shade = 34 + ((x * 7 + y * 13) % 3) * 5;
        ctx.fillStyle = `rgb(${shade},${shade - 2},${shade + 4})`;
        ctx.fillRect(x * plate + 2, y * plate + 2, plate - 4, plate - 4);
        ctx.fillStyle = '#17141a';
        ctx.fillRect(x * plate, y * plate + plate - 2, plate, 2);
        ctx.fillRect(x * plate + plate - 2, y * plate, 2, plate);
        // Rivets at plate corners.
        ctx.fillStyle = '#3d3942';
        for (const [rx, ry] of [[10, 10], [plate - 10, 10], [10, plate - 10], [plate - 10, plate - 10]]) {
          ctx.beginPath();
          ctx.arc(x * plate + rx, y * plate + ry, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    speckle(ctx, s, 900, ['#ff6a2a', '#8a4a28', '#3a2a1c'], 0.04, 0.16, 2.2);
  }, 10, 8);
}

// Wall panels: tall dark plates with a hazard stripe near the floor.
export function wallTexture() {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#2e2b33';
    ctx.fillRect(0, 0, s, s);
    const panel = s / 4;
    for (let x = 0; x < 4; x++) {
      const shade = 44 + (x % 2) * 6;
      ctx.fillStyle = `rgb(${shade},${shade - 1},${shade + 5})`;
      ctx.fillRect(x * panel + 2, 4, panel - 4, s - 8);
      ctx.fillStyle = '#1a171d';
      ctx.fillRect(x * panel, 0, 2, s);
      // Vent slits near the top.
      ctx.fillStyle = '#141116';
      for (let v = 0; v < 4; v++) ctx.fillRect(x * panel + 18, 26 + v * 10, panel - 36, 4);
    }
    // Hazard stripe band.
    const bandY = s - 64;
    ctx.fillStyle = '#c99a1e';
    ctx.fillRect(0, bandY, s, 34);
    ctx.fillStyle = '#16131a';
    for (let x = -34; x < s + 34; x += 68) {
      ctx.beginPath();
      ctx.moveTo(x, bandY + 34);
      ctx.lineTo(x + 34, bandY);
      ctx.lineTo(x + 68, bandY);
      ctx.lineTo(x + 34, bandY + 34);
      ctx.closePath();
      ctx.fill();
    }
    speckle(ctx, s, 500, ['#5a3a22', '#241a12'], 0.05, 0.18, 2.5);
  }, 6, 1);
}

// Crate face: stamped steel with a stencilled number.
export function crateTexture(label) {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#4a4550';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#2c2830';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, s - 10, s - 10);
    ctx.strokeStyle = '#5d5866';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, s - 36, s - 36);
    ctx.fillStyle = '#c9c2b8';
    ctx.font = `bold ${s * 0.28}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, s / 2, s / 2 - 8);
    ctx.font = `bold ${s * 0.09}px monospace`;
    ctx.fillStyle = '#ff9a4d';
    ctx.fillText('FERROX-9', s / 2, s / 2 + s * 0.2);
    speckle(ctx, s, 260, ['#241f26', '#6a5a44'], 0.06, 0.2, 2);
  });
}

// Soft radial glow, used as a sprite for cores, muzzle flashes and pads.
export function glowTexture(inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Small crosshair dot drawn as a sprite is unnecessary; the HUD uses CSS.
export function makeCanvasTextureFromDraw(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
