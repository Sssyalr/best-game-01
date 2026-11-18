// FERROX-9 — procedural textures, painted on canvases at load time.
// No image files ship with the game; every surface is generated here,
// which keeps the whole game self-contained and offline.
// This pass paints at 1024px with grunge, rust, scratches and wear, and
// pairs each colour map with a roughness map so metal, rust and concrete
// read differently under the lights instead of as flat colour.

import * as THREE from 'three';

function canvasTexture(size, painter, repeatX = 1, repeatY = 1, srgb = true) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  painter(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
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

// Soft dark blotches: grime, oil, damp patches.
function blotches(ctx, size, count, color, alphaMax, rMin, rMax) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = rMin + Math.random() * (rMax - rMin);
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.1 + Math.random() * alphaMax;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Rust drips running down from a point: a dark streak with a bright edge.
function rustDrips(ctx, size, count, xMin, xMax, y0, lenMax) {
  for (let i = 0; i < count; i++) {
    const x = xMin + Math.random() * (xMax - xMin);
    const y = y0 + Math.random() * size * 0.15;
    const len = 20 + Math.random() * lenMax;
    const w = 2 + Math.random() * 5;
    const g = ctx.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, 'rgba(122,62,28,0.55)');
    g.addColorStop(1, 'rgba(122,62,28,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, y, w, len);
    ctx.fillStyle = 'rgba(60,30,14,0.5)';
    ctx.fillRect(x - w / 2, y, 1.5, len * 0.8);
  }
}

// Thin pale scratches, random angles.
function scratches(ctx, size, count, color = 'rgba(210,200,180,0.35)') {
  ctx.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = Math.random() * Math.PI;
    const len = 8 + Math.random() * 60;
    ctx.globalAlpha = 0.1 + Math.random() * 0.3;
    ctx.lineWidth = 0.6 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Stencilled text, worn: letters with a few speckles punched out.
function stencil(ctx, text, x, y, font, color) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  // Wear: punch random dark specks out of the letters.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.arc(x + (Math.random() - 0.5) * 140, y + (Math.random() - 0.5) * 40, 1 + Math.random() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Dark foundry floor: riveted metal plates with ember dust in the seams,
// oil stains, scratches and a worn painted guide line.
export function floorTexture() {
  return canvasTexture(1024, (ctx, s) => {
    ctx.fillStyle = '#211d24';
    ctx.fillRect(0, 0, s, s);
    const plate = s / 4;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const shade = 30 + ((x * 7 + y * 13) % 4) * 5;
        ctx.fillStyle = `rgb(${shade},${shade - 2},${shade + 5})`;
        ctx.fillRect(x * plate + 2, y * plate + 2, plate - 4, plate - 4);
        // Lighter worn centre on each plate where boots and wheels pass.
        const wg = ctx.createRadialGradient(
          x * plate + plate / 2, y * plate + plate / 2, 4,
          x * plate + plate / 2, y * plate + plate / 2, plate * 0.55,
        );
        wg.addColorStop(0, 'rgba(120,105,90,0.10)');
        wg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = wg;
        ctx.fillRect(x * plate, y * plate, plate, plate);
        // Seams.
        ctx.fillStyle = '#100d12';
        ctx.fillRect(x * plate, y * plate + plate - 2, plate, 2);
        ctx.fillRect(x * plate + plate - 2, y * plate, 2, plate);
        // Rivets at plate corners, with a highlight dot.
        for (const [rx, ry] of [[12, 12], [plate - 12, 12], [12, plate - 12], [plate - 12, plate - 12]]) {
          ctx.fillStyle = '#453f49';
          ctx.beginPath();
          ctx.arc(x * plate + rx, y * plate + ry, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(220,205,190,0.5)';
          ctx.beginPath();
          ctx.arc(x * plate + rx - 1, y * plate + ry - 1, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Worn painted guide line across the second row, teal and chipped.
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#1e7a72';
    ctx.fillRect(0, plate * 1 + plate * 0.46, s, 10);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 260; i++) {
      ctx.globalAlpha = 0.4 + Math.random() * 0.6;
      ctx.beginPath();
      ctx.arc(Math.random() * s, plate * 1 + plate * 0.46 + Math.random() * 10, 1 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    blotches(ctx, s, 26, 'rgba(8,6,8,0.9)', 0.5, 40, 160);
    blotches(ctx, s, 14, 'rgba(90,50,20,0.8)', 0.4, 30, 110);
    rustDrips(ctx, s, 40, 0, s, 0, 130);
    scratches(ctx, s, 130);
    speckle(ctx, s, 1400, ['#ff6a2a', '#8a4a28', '#3a2a1c', '#c9b18a'], 0.04, 0.18, 2.4);
  }, 10, 8);
}

// Roughness map for the floor: worn paths and oil are smooth (dark),
// rust and seams are rough (bright).
export function floorRoughTexture() {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#b4b4b4';
    ctx.fillRect(0, 0, s, s);
    const plate = s / 4;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const shade = 164 + ((x * 7 + y * 13) % 4) * 8;
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(x * plate + 2, y * plate + 2, plate - 4, plate - 4);
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(x * plate, y * plate + plate - 2, plate, 2);
        ctx.fillRect(x * plate + plate - 2, y * plate, 2, plate);
      }
    }
    blotches(ctx, s, 26, 'rgba(40,40,40,0.9)', 0.6, 40, 160);
    blotches(ctx, s, 14, 'rgba(235,235,235,0.9)', 0.5, 30, 110);
    speckle(ctx, s, 900, ['#ffffff', '#666666'], 0.1, 0.3, 2);
  }, 10, 8, false);
}

// Wall panels: tall dark plates with rivets, rust streaks from the top,
// stencilled bay numbers, a hazard stripe near the floor and grime.
export function wallTexture() {
  return canvasTexture(1024, (ctx, s) => {
    ctx.fillStyle = '#292630';
    ctx.fillRect(0, 0, s, s);
    const panel = s / 4;
    for (let x = 0; x < 4; x++) {
      const shade = 40 + (x % 2) * 7 + ((x * 3) % 3) * 2;
      ctx.fillStyle = `rgb(${shade},${shade - 1},${shade + 6})`;
      ctx.fillRect(x * panel + 2, 4, panel - 4, s - 8);
      // Panel top cap and bottom grime.
      ctx.fillStyle = '#17141b';
      ctx.fillRect(x * panel, 0, 2, s);
      ctx.fillRect(x * panel + 2, s - 26, panel - 4, 22);
      // Rivet column down the middle seam.
      ctx.fillStyle = '#3d3944';
      for (let ry = 30; ry < s - 40; ry += 46) {
        ctx.beginPath();
        ctx.arc(x * panel + panel / 2, ry, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Vent slits near the top.
      ctx.fillStyle = '#100d13';
      for (let v = 0; v < 4; v++) ctx.fillRect(x * panel + 22, 30 + v * 11, panel - 44, 5);
      // Stencilled bay number, worn.
      stencil(ctx, `0${x + 1}`, x * panel + panel / 2, s * 0.42, `bold ${s * 0.09}px monospace`, 'rgba(190,175,150,0.5)');
    }
    rustDrips(ctx, s, 60, 0, s, 0, 220);
    // Hazard stripe band.
    const bandY = s - 78;
    ctx.fillStyle = '#c99a1e';
    ctx.fillRect(0, bandY, s, 38);
    ctx.fillStyle = '#14111a';
    for (let x = -38; x < s + 38; x += 76) {
      ctx.beginPath();
      ctx.moveTo(x, bandY + 38);
      ctx.lineTo(x + 38, bandY);
      ctx.lineTo(x + 76, bandY);
      ctx.lineTo(x + 38, bandY + 38);
      ctx.closePath();
      ctx.fill();
    }
    blotches(ctx, s, 20, 'rgba(8,6,8,0.9)', 0.5, 40, 150);
    scratches(ctx, s, 90);
    speckle(ctx, s, 800, ['#5a3a22', '#241a12', '#7a5a3a'], 0.05, 0.2, 2.6);
  }, 6, 1);
}

export function wallRoughTexture() {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#a8a8a8';
    ctx.fillRect(0, 0, s, s);
    const panel = s / 4;
    for (let x = 0; x < 4; x++) {
      const shade = 158 + (x % 2) * 10;
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x * panel + 2, 4, panel - 4, s - 8);
    }
    blotches(ctx, s, 20, 'rgba(230,230,230,0.9)', 0.5, 40, 150);
    speckle(ctx, s, 700, ['#ffffff', '#777777'], 0.1, 0.3, 2);
  }, 6, 1, false);
}

// Crate face: stamped steel with edge wear, rust in the corners and a
// stencilled number.
export function crateTexture(label) {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#453f4a';
    ctx.fillRect(0, 0, s, s);
    // Subtle vertical brushed variation.
    for (let x = 0; x < s; x += 4) {
      ctx.fillStyle = `rgba(255,255,255,${0.01 + Math.random() * 0.02})`;
      ctx.fillRect(x, 0, 2, s);
    }
    // Corner brackets.
    ctx.strokeStyle = '#241f28';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, s - 14, s - 14);
    ctx.strokeStyle = '#5d5866';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, s - 48, s - 48);
    // Edge wear: pale chips along the outer frame.
    for (let i = 0; i < 60; i++) {
      const side = (Math.random() * 4) | 0;
      const t = Math.random() * s;
      ctx.fillStyle = 'rgba(210,195,170,0.5)';
      if (side === 0) ctx.fillRect(t, 4, 3 + Math.random() * 6, 3);
      else if (side === 1) ctx.fillRect(t, s - 7, 3 + Math.random() * 6, 3);
      else if (side === 2) ctx.fillRect(4, t, 3, 3 + Math.random() * 6);
      else ctx.fillRect(s - 7, t, 3, 3 + Math.random() * 6);
    }
    stencil(ctx, label, s / 2, s / 2 - 14, `bold ${s * 0.26}px monospace`, '#c9c2b8');
    stencil(ctx, 'FERROX-9', s / 2, s / 2 + s * 0.2, `bold ${s * 0.085}px monospace`, '#ff9a4d');
    blotches(ctx, s, 10, 'rgba(90,50,20,0.9)', 0.45, 20, 80);
    scratches(ctx, s, 46);
    speckle(ctx, s, 420, ['#241f26', '#6a5a44', '#8a7a5a'], 0.06, 0.22, 2);
  });
}

// Dark gunmetal panel for pipes, beams and trims: seams, rivets, rust.
export function metalTexture() {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#2b2830';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#221f26';
    ctx.fillRect(0, s * 0.48, s, 4);
    ctx.fillRect(s * 0.48, 0, 4, s);
    ctx.fillStyle = '#3a3540';
    for (const [rx, ry] of [[24, 24], [s - 24, 24], [24, s - 24], [s - 24, s - 24], [s / 2, 24], [24, s / 2]]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    rustDrips(ctx, s, 22, 0, s, 0, 120);
    blotches(ctx, s, 12, 'rgba(80,45,18,0.9)', 0.4, 24, 90);
    scratches(ctx, s, 60);
    speckle(ctx, s, 500, ['#4a4030', '#1a151c'], 0.06, 0.2, 2);
  }, 2, 2);
}

// Hazard chevron strip, painted on a floor decal plane.
export function hazardStripTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c99a1e';
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = '#14111a';
  for (let x = -64; x < 512 + 64; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 64, 0);
    ctx.lineTo(x + 128, 0);
    ctx.lineTo(x + 64, 64);
    ctx.closePath();
    ctx.fill();
  }
  // Wear.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 160; i++) {
    ctx.globalAlpha = 0.3 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 64, 1 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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

// Soft vertical streak, used for rain drops.
export function streakTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(160,190,210,0)');
  g.addColorStop(0.5, 'rgba(170,200,220,0.85)');
  g.addColorStop(1, 'rgba(160,190,210,0)');
  ctx.fillStyle = g;
  ctx.fillRect(6, 0, 4, 64);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// Small soft dot, used for dust motes and embers.
export function dotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function makeCanvasTextureFromDraw(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
