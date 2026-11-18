// FERROX-9 — the foundry hall: geometry, lights, collision and the
// interactive set pieces (fusion cores, extraction pad, medkits).
// Everything the player can bump into, shoot at or switch on lives here.

import * as THREE from 'three';
import { LEVEL, COLORS } from './config.js';
import { floorTexture, wallTexture, crateTexture, glowTexture, makeCanvasTextureFromDraw } from './textures.js';

function textSprite(text, color = '#ffd9a0', scale = 1) {
  const tex = makeCanvasTextureFromDraw(512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2);
  });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(6 * scale, 1.5 * scale, 1);
  return sprite;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // {minX,maxX,minZ,maxZ} axis-aligned boxes
    this.solids = []; // meshes a bullet ray can strike
    this.cores = [];
    this.medkits = [];
    this.time = 0;
    this.buildLights();
    this.buildShell();
    this.buildCover();
    this.buildCores();
    this.buildPad();
    this.buildMedkits();
    this.buildProps();
  }

  addCollider(minX, maxX, minZ, maxZ) {
    this.colliders.push({ minX, maxX, minZ, maxZ });
  }

  buildLights() {
    const { scene } = this;
    scene.fog = new THREE.Fog(LEVEL.fogColor, LEVEL.fogNear, LEVEL.fogFar);
    scene.background = new THREE.Color(LEVEL.fogColor);
    scene.add(new THREE.AmbientLight(LEVEL.ambientColor, LEVEL.ambientIntensity));
    const hemi = new THREE.HemisphereLight(LEVEL.hemiSky, LEVEL.hemiGround, LEVEL.hemiIntensity);
    scene.add(hemi);
    // Warm foundry glow from the north wall (the furnace end).
    const furnace = new THREE.PointLight(0xff5a1e, 900, 55, 1.8);
    furnace.position.set(0, 4.5, -21);
    scene.add(furnace);
    this.furnaceLight = furnace;
    // Cool fill from the south gate.
    const gate = new THREE.PointLight(0x2fd6c8, 260, 40, 1.8);
    gate.position.set(0, 4.5, 21);
    scene.add(gate);
  }

  buildShell() {
    const { scene } = this;
    const W = LEVEL.width;
    const D = LEVEL.depth;
    const H = LEVEL.wallHeight;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 4, D + 4),
      new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.85, metalness: 0.35 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    this.solids.push(floor);

    // Ceiling beams: dark girders that catch the fog.
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x1c1920, roughness: 0.9, metalness: 0.4 });
    for (let x = -24; x <= 24; x += 8) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, D), beamMat);
      beam.position.set(x, H - 0.2, 0);
      scene.add(beam);
    }

    const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.8, metalness: 0.4 });
    const mkWall = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
      m.position.set(x, H / 2, z);
      scene.add(m);
      this.solids.push(m);
      this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    };
    const t = LEVEL.wallThickness;
    mkWall(W + 2 * t, t, 0, -D / 2 - t / 2); // north
    mkWall(W + 2 * t, t, 0, D / 2 + t / 2); // south
    mkWall(t, D, -W / 2 - t / 2, 0); // west
    mkWall(t, D, W / 2 + t / 2, 0); // east

    // A molten slit on the north wall: the furnace mouth.
    const slit = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 1.6),
      new THREE.MeshBasicMaterial({ color: 0xff6a1e }),
    );
    slit.position.set(0, 2.2, -D / 2 + 0.06);
    scene.add(slit);
    const slitGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,150,60,0.9)', 'rgba(255,80,20,0.25)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    slitGlow.scale.set(26, 7, 1);
    slitGlow.position.set(0, 2.4, -D / 2 + 0.5);
    scene.add(slitGlow);
  }

  buildCover() {
    const { scene } = this;
    const crateMat = (label) => new THREE.MeshStandardMaterial({ map: crateTexture(label), roughness: 0.75, metalness: 0.45 });
    LEVEL.crates.forEach(([x, z, w, d, h], i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), crateMat(`F-${100 + i}`));
      m.position.set(x, h / 2, z);
      scene.add(m);
      this.solids.push(m);
      this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    });
    const pillarMat = new THREE.MeshStandardMaterial({ color: COLORS.metal, roughness: 0.6, metalness: 0.6 });
    const ringMat = new THREE.MeshStandardMaterial({ color: COLORS.hazard, roughness: 0.5, metalness: 0.3, emissive: 0x332200 });
    LEVEL.pillars.forEach(([x, z, r, h]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, h, 12), pillarMat);
      p.position.set(x, h / 2, z);
      scene.add(p);
      this.solids.push(p);
      this.addCollider(x - r, x + r, z - r, z + r);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.06, 0.07, 8, 20), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 1.1, z);
      scene.add(ring);
    });
  }

  buildCores() {
    const { scene } = this;
    LEVEL.cores.forEach((def) => {
      const group = new THREE.Group();
      group.position.set(def.x, 0, def.z);
      // Plinth and housing.
      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.5, 0.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x33303a, roughness: 0.7, metalness: 0.6 }),
      );
      plinth.position.y = 0.25;
      group.add(plinth);
      this.solids.push(plinth);
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 1.7, 2.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x3d3a44, roughness: 0.55, metalness: 0.7 }),
      );
      housing.position.y = 1.7;
      group.add(housing);
      this.solids.push(housing);
      // The core itself: a glowing crystal column, dim until restarted.
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x332211, emissive: 0x442200, emissiveIntensity: 0.6,
        roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92,
      });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), coreMat);
      crystal.position.y = 3.4;
      crystal.scale.y = 1.6;
      group.add(crystal);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,170,80,0.85)', 'rgba(255,110,30,0.2)'),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55,
      }));
      glow.scale.set(5, 5, 1);
      glow.position.y = 3.4;
      group.add(glow);
      const light = new THREE.PointLight(0xff8a30, 60, 16, 1.8);
      light.position.y = 3.4;
      group.add(light);
      // Floating label.
      const label = textSprite(def.name.toUpperCase(), '#ffc27a', 0.9);
      label.position.y = 5.2;
      group.add(label);
      // Activation ring on the floor.
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.6, 3.0, 40),
        new THREE.MeshBasicMaterial({ color: COLORS.teal, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      group.add(ring);
      scene.add(group);
      this.addCollider(def.x - 1.7, def.x + 1.7, def.z - 1.7, def.z + 1.7);
      this.cores.push({
        ...def, group, crystal, coreMat, glow, light, ring,
        active: false, progress: 0, spin: 0,
      });
    });
  }

  buildPad() {
    const { scene } = this;
    const { pad } = LEVEL;
    const group = new THREE.Group();
    group.position.set(pad.x, 0, pad.z);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(pad.radius, pad.radius + 0.3, 0.25, 32),
      new THREE.MeshStandardMaterial({ color: 0x2a2d38, roughness: 0.6, metalness: 0.7 }),
    );
    disc.position.y = 0.12;
    group.add(disc);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(pad.radius - 0.35, pad.radius - 0.05, 40),
      new THREE.MeshBasicMaterial({ color: COLORS.teal, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.28;
    group.add(ring);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(60,220,200,0.7)', 'rgba(40,160,150,0.15)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4,
    }));
    glow.scale.set(8, 3.5, 1);
    glow.position.y = 1.2;
    group.add(glow);
    const light = new THREE.PointLight(0x2fd6c8, 40, 14, 1.8);
    light.position.y = 2;
    group.add(light);
    const label = textSprite('EXTRACTION', '#7df0e2', 0.85);
    label.position.y = 4.4;
    group.add(label);
    scene.add(group);
    this.pad = { ...pad, group, ring, glow, light, armed: false };
  }

  buildMedkits() {
    const { scene } = this;
    LEVEL.medkits.forEach((def) => {
      const group = new THREE.Group();
      group.position.set(def.x, 0, def.z);
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.6, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.5, metalness: 0.2 }),
      );
      box.position.y = 0.9;
      group.add(box);
      const crossMat = new THREE.MeshBasicMaterial({ color: 0x2fd6c8 });
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.02), crossMat);
      vBar.position.set(0, 0.9, 0.46);
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.02), crossMat);
      hBar.position.set(0, 0.9, 0.46);
      group.add(vBar, hBar);
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.6, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x33303a, roughness: 0.7, metalness: 0.5 }),
      );
      stand.position.y = 0.3;
      group.add(stand);
      const light = new THREE.PointLight(0x2fd6c8, 18, 7, 1.8);
      light.position.y = 1.4;
      group.add(light);
      scene.add(group);
      this.medkits.push({ ...def, group, box, light, available: true, respawnAt: 0 });
    });
  }

  buildProps() {
    const { scene } = this;
    // A derelict shuttle silhouette parked beyond the south gate window,
    // visible through the haze: a simple hull shape, purely decorative.
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.5, metalness: 0.8 });
    const hull = new THREE.Mesh(new THREE.ConeGeometry(2.2, 7, 4), hullMat);
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = Math.PI / 4;
    hull.position.set(-14, 3.2, 27.5);
    scene.add(hull);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 3.2), hullMat);
    fin.position.set(-14, 2.2, 27.5);
    scene.add(fin);
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,80,60,0.9)', 'rgba(255,80,60,0.2)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    beacon.scale.set(1.6, 1.6, 1);
    beacon.position.set(-10.6, 3.2, 27.5);
    scene.add(beacon);
    this.beacon = beacon;
  }

  // --- Interaction helpers -------------------------------------------------

  nearestCore(pos, range) {
    let best = null;
    let bestD = range;
    for (const core of this.cores) {
      if (core.active) continue;
      const d = Math.hypot(core.x - pos.x, core.z - pos.z);
      if (d < bestD) { best = core; bestD = d; }
    }
    return best;
  }

  activateCore(core) {
    core.active = true;
    core.progress = 1;
    core.coreMat.emissive.setHex(0xff9a30);
    core.coreMat.emissiveIntensity = 2.4;
    core.glow.material.opacity = 1;
    core.light.intensity = 320;
    core.light.color.setHex(0xffb050);
    core.ring.material.color.setHex(0xff9a30);
  }

  armPad() {
    this.pad.armed = true;
    this.pad.ring.material.opacity = 1;
    this.pad.glow.material.opacity = 0.95;
    this.pad.light.intensity = 260;
  }

  padContains(pos) {
    return Math.hypot(pos.x - this.pad.x, pos.z - this.pad.z) < this.pad.radius;
  }

  tryMedkit(pos) {
    for (const kit of this.medkits) {
      if (!kit.available) continue;
      if (Math.hypot(kit.x - pos.x, kit.z - pos.z) < 1.6) {
        kit.available = false;
        kit.group.visible = false;
        kit.respawnAt = this.time + 45;
        return true;
      }
    }
    return false;
  }

  // --- Collision -----------------------------------------------------------
  // Axis-separated circle-vs-AABB resolution: move x, resolve, move z, resolve.
  // Returns the corrected position (mutates the passed vector).
  collide(pos, radius) {
    for (const c of this.colliders) {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // Center inside the box: push out along the smallest penetration.
          const pushL = pos.x - c.minX + radius;
          const pushR = c.maxX - pos.x + radius;
          const pushB = pos.z - c.minZ + radius;
          const pushF = c.maxZ - pos.z + radius;
          const m = Math.min(pushL, pushR, pushB, pushF);
          if (m === pushL) pos.x = c.minX - radius;
          else if (m === pushR) pos.x = c.maxX + radius;
          else if (m === pushB) pos.z = c.minZ - radius;
          else pos.z = c.maxZ + radius;
        }
      }
    }
    // Clamp to the hall.
    const hw = LEVEL.width / 2 - 0.6;
    const hd = LEVEL.depth / 2 - 0.6;
    pos.x = Math.max(-hw, Math.min(hw, pos.x));
    pos.z = Math.max(-hd, Math.min(hd, pos.z));
    return pos;
  }

  pointBlocked(x, y, z) {
    if (y < 0 || y > LEVEL.wallHeight) return true;
    for (const c of this.colliders) {
      if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
    }
    return false;
  }

  update(dt, time) {
    this.time = time;
    // Furnace light breathes; core crystals spin and bob.
    this.furnaceLight.intensity = 900 + Math.sin(time * 1.3) * 120 + Math.sin(time * 4.7) * 40;
    for (const core of this.cores) {
      core.spin += dt * (core.active ? 1.6 : 0.4);
      core.crystal.rotation.y = core.spin;
      core.crystal.position.y = 3.4 + Math.sin(time * 1.8 + core.id * 2.1) * 0.12;
      if (core.active) core.glow.material.opacity = 0.85 + Math.sin(time * 3 + core.id) * 0.15;
    }
    if (this.pad.armed) {
      this.pad.ring.rotation.z += dt * 0.8;
      this.pad.glow.material.opacity = 0.8 + Math.sin(time * 4) * 0.18;
    }
    this.beacon.material.opacity = 0.55 + Math.sin(time * 2.4) * 0.45;
    for (const kit of this.medkits) {
      if (!kit.available && time >= kit.respawnAt) {
        kit.available = true;
        kit.group.visible = true;
      }
      if (kit.available) kit.box.rotation.y += dt * 0.8;
    }
  }
}
