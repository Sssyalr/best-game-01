// FERROX-9 — atmosphere: leaking rain, drifting dust, core embers and
// volumetric-feeling light shafts. All of it is decorative: it never
// blocks movement, never joins the raycast solids and never changes
// the rules. Pure mood, so the hall reads wet, smoky and alive.

import * as THREE from 'three';
import { LEVEL } from './config.js';
import { streakTexture, dotTexture } from './textures.js';

const HALL = { x: 30, z: 21, top: 7.5 };

export class Atmosphere {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.buildRain();
    this.buildSplashes();
    this.buildDust();
    this.buildEmbers();
    this.buildShafts();
  }

  // --- Rain: streaks falling through the damaged roof ----------------------
  buildRain() {
    const N = 650;
    this.rainCount = N;
    this.rainPos = new Float32Array(N * 3);
    this.rainSpeed = new Float32Array(N);
    this.rainDrift = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.rainPos[i * 3] = (Math.random() * 2 - 1) * HALL.x;
      this.rainPos[i * 3 + 1] = Math.random() * HALL.top;
      this.rainPos[i * 3 + 2] = (Math.random() * 2 - 1) * HALL.z;
      this.rainSpeed[i] = 9 + Math.random() * 6;
      this.rainDrift[i] = (Math.random() - 0.5) * 0.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    const mat = new THREE.PointsMaterial({
      map: streakTexture(), color: 0xa8c4d4, size: 0.55, transparent: true,
      opacity: 0.42, depthWrite: false, sizeAttenuation: true,
    });
    this.rain = new THREE.Points(geo, mat);
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  // --- Splash rings where drops hit the floor -------------------------------
  buildSplashes() {
    this.splashes = [];
    const geo = new THREE.RingGeometry(0.07, 0.2, 20);
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xbfd9e8, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      this.scene.add(ring);
      this.splashes.push({ mesh: ring, life: 0, max: 0.5 + Math.random() * 0.3, delay: Math.random() * 2 });
    }
    this.splashTimer = 0;
  }

  // --- Dust motes drifting in the light --------------------------------------
  buildDust() {
    const N = 240;
    this.dustCount = N;
    this.dustBase = new Float32Array(N * 3);
    this.dustPhase = new Float32Array(N);
    this.dustPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.dustBase[i * 3] = (Math.random() * 2 - 1) * HALL.x;
      this.dustBase[i * 3 + 1] = 0.4 + Math.random() * 5;
      this.dustBase[i * 3 + 2] = (Math.random() * 2 - 1) * HALL.z;
      this.dustPhase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3));
    const mat = new THREE.PointsMaterial({
      map: dotTexture(), color: 0xd8c9a8, size: 0.09, transparent: true,
      opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.dust = new THREE.Points(geo, mat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  // --- Embers rising off the furnace slit and the three cores ----------------
  buildEmbers() {
    const sources = [
      { x: 0, y: 2.2, z: -22, n: 70 },
      ...LEVEL.cores.map((c) => ({ x: c.x, y: 3.4, z: c.z, n: 36 })),
    ];
    const total = sources.reduce((a, s) => a + s.n, 0);
    this.emberCount = total;
    this.emberPos = new Float32Array(total * 3);
    this.emberSrc = [];
    this.emberSpeed = new Float32Array(total);
    this.emberWob = new Float32Array(total);
    const colors = new Float32Array(total * 3);
    let i = 0;
    for (const s of sources) {
      for (let k = 0; k < s.n; k++, i++) {
        this.emberSrc.push(s);
        this.emberPos[i * 3] = s.x + (Math.random() - 0.5) * 1.6;
        this.emberPos[i * 3 + 1] = s.y + Math.random() * 2.4;
        this.emberPos[i * 3 + 2] = s.z + (Math.random() - 0.5) * 1.6;
        this.emberSpeed[i] = 0.5 + Math.random() * 1.1;
        this.emberWob[i] = Math.random() * Math.PI * 2;
        // Orange to deep red, a few bright gold.
        const c = Math.random();
        const r = 1.0;
        const g = 0.32 + c * 0.45;
        const b = 0.06 + c * 0.1;
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.emberPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      map: dotTexture(), size: 0.16, transparent: true, opacity: 0.85,
      vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.embers = new THREE.Points(geo, mat);
    this.embers.frustumCulled = false;
    this.scene.add(this.embers);
  }

  // --- Light shafts hanging from the ceiling beams ---------------------------
  buildShafts() {
    this.shafts = [];
    const defs = [
      { x: -12, z: 0, color: 0xffb060, o: 0.04 },
      { x: 12, z: 0, color: 0xffb060, o: 0.035 },
      { x: -12, z: -12, color: 0xff8a30, o: 0.045 },
      { x: 12, z: -12, color: 0xff8a30, o: 0.04 },
      { x: 0, z: -18, color: 0xff7a20, o: 0.05 },
      { x: 0, z: 16, color: 0x2fd6c8, o: 0.032 },
    ];
    for (const d of defs) {
      const geo = new THREE.CylinderGeometry(0.55, 2.4, 6.4, 20, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: d.color, transparent: true, opacity: d.o,
        blending: THREE.AdditiveBlending, depthWrite: false,
        side: THREE.DoubleSide, fog: false,
      });
      const cone = new THREE.Mesh(geo, mat);
      cone.position.set(d.x, 3.1, d.z);
      cone.rotation.z = 0.06;
      this.scene.add(cone);
      this.shafts.push({ mesh: cone, base: d.o, phase: Math.random() * Math.PI * 2 });
    }
  }

  update(dt, time) {
    this.time = time;
    // Rain falls and wraps.
    const p = this.rainPos;
    for (let i = 0; i < this.rainCount; i++) {
      p[i * 3 + 1] -= this.rainSpeed[i] * dt;
      p[i * 3] += this.rainDrift[i] * dt;
      if (p[i * 3 + 1] < 0) {
        p[i * 3 + 1] = HALL.top + Math.random() * 1.5;
        p[i * 3] = (Math.random() * 2 - 1) * HALL.x;
        p[i * 3 + 2] = (Math.random() * 2 - 1) * HALL.z;
      }
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
    // Splash rings recycle.
    this.splashTimer -= dt;
    for (const s of this.splashes) {
      if (s.life > 0) {
        s.life -= dt;
        const t = 1 - Math.max(0, s.life) / s.max;
        const sc = 0.3 + t * 1.6;
        s.mesh.scale.set(sc, sc, 1);
        s.mesh.material.opacity = 0.5 * (1 - t);
      } else if (this.splashTimer <= 0) {
        s.life = s.max;
        s.mesh.position.x = (Math.random() * 2 - 1) * HALL.x;
        s.mesh.position.z = (Math.random() * 2 - 1) * HALL.z;
        this.splashTimer = 0.1 + Math.random() * 0.25;
      }
    }
    // Dust drifts on slow sine wander.
    const dp = this.dustPos;
    for (let i = 0; i < this.dustCount; i++) {
      const ph = this.dustPhase[i];
      dp[i * 3] = this.dustBase[i * 3] + Math.sin(time * 0.12 + ph) * 0.9;
      dp[i * 3 + 1] = this.dustBase[i * 3 + 1] + Math.sin(time * 0.07 + ph * 2.3) * 0.5;
      dp[i * 3 + 2] = this.dustBase[i * 3 + 2] + Math.cos(time * 0.09 + ph) * 0.9;
    }
    this.dust.geometry.attributes.position.needsUpdate = true;
    // Embers rise, wobble and recycle at their source.
    const ep = this.emberPos;
    for (let i = 0; i < this.emberCount; i++) {
      const s = this.emberSrc[i];
      ep[i * 3 + 1] += this.emberSpeed[i] * dt;
      ep[i * 3] += Math.sin(time * 2 + this.emberWob[i]) * 0.12 * dt;
      if (ep[i * 3 + 1] > s.y + 2.6) {
        ep[i * 3] = s.x + (Math.random() - 0.5) * 1.6;
        ep[i * 3 + 1] = s.y;
        ep[i * 3 + 2] = s.z + (Math.random() - 0.5) * 1.6;
      }
    }
    this.embers.geometry.attributes.position.needsUpdate = true;
    // Shafts breathe almost imperceptibly.
    for (const s of this.shafts) {
      s.mesh.material.opacity = s.base * (0.85 + Math.sin(time * 0.5 + s.phase) * 0.15);
    }
  }
}
