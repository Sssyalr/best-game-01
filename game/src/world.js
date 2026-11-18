// FERROX-9 — the foundry hall: geometry, lights, collision and the
// interactive set pieces (fusion cores, extraction pad, medkits).
// Everything the player can bump into, shoot at or switch on lives here.

import * as THREE from 'three';
import { LEVEL, COLORS } from './config.js';
import { floorTexture, floorRoughTexture, wallTexture, wallRoughTexture, crateTexture, metalTexture, hazardStripTexture, glowTexture, makeCanvasTextureFromDraw } from './textures.js';

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
    // Low sun through the damaged roof: warm, slanted, casts the hall's
    // long shadows (PCFSoft). One shadow-casting light only, for speed.
    const sun = new THREE.DirectionalLight(0xffd9b0, 1.5);
    sun.position.set(14, 18, -14);
    sun.target.position.set(0, 0, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 34;
    sun.shadow.camera.bottom = -34;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 70;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    scene.add(sun.target);
    this.sunLight = sun;
    // Warm fill over the middle of the hall so the centre never goes dead.
    const mid = new THREE.PointLight(0xff8a40, 150, 30, 1.8);
    mid.position.set(0, 5.2, 2);
    scene.add(mid);
  }

  buildShell() {
    const { scene } = this;
    const W = LEVEL.width;
    const D = LEVEL.depth;
    const H = LEVEL.wallHeight;

    const floorTex = floorTexture();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 4, D + 4),
      new THREE.MeshStandardMaterial({
        map: floorTex, roughnessMap: floorRoughTexture(), bumpMap: floorTex, bumpScale: 0.6,
        roughness: 1.0, metalness: 0.35,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    this.solids.push(floor);

    // Ceiling beams: dark girders that catch the fog.
    const beamMat = new THREE.MeshStandardMaterial({ map: metalTexture(), roughness: 0.85, metalness: 0.5 });
    for (let x = -24; x <= 24; x += 8) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, D), beamMat);
      beam.position.set(x, H - 0.2, 0);
      beam.castShadow = true;
      scene.add(beam);
    }

    const wallTex = wallTexture();
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex, roughnessMap: wallRoughTexture(), bumpMap: wallTex, bumpScale: 0.5,
      roughness: 1.0, metalness: 0.4,
    });
    const mkWall = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
      m.position.set(x, H / 2, z);
      m.receiveShadow = true;
      scene.add(m);
      this.solids.push(m);
      this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    };
    const t = LEVEL.wallThickness;
    mkWall(W + 2 * t, t, 0, -D / 2 - t / 2); // north
    mkWall(W + 2 * t, t, 0, D / 2 + t / 2); // south
    mkWall(t, D, -W / 2 - t / 2, 0); // west
    mkWall(t, D, W / 2 + t / 2, 0); // east

    this.buildWallDressing();

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

  // Pipes, vents, cable trays and protruding panels along the walls.
  // All of it sits flush to a wall or above head height, so it needs no
  // collider and never blocks a scripted path.
  buildWallDressing() {
    const { scene } = this;
    const W = LEVEL.width;
    const D = LEVEL.depth;
    const pipeMat = new THREE.MeshStandardMaterial({ map: metalTexture(), roughness: 0.55, metalness: 0.75 });
    const rustMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9, metalness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x191620, roughness: 0.9, metalness: 0.4 });
    // Long pipes along the north and south walls, plus risers at the corners.
    for (const z of [-D / 2 + 0.9, D / 2 - 0.9]) {
      for (const [y, r] of [[4.6, 0.28], [5.2, 0.2]]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(r, r, W - 4, 10), pipeMat);
        pipe.rotation.z = Math.PI / 2;
        pipe.position.set(0, y, z);
        pipe.castShadow = true;
        scene.add(pipe);
      }
    }
    for (const x of [-W / 2 + 0.9, W / 2 - 0.9]) {
      for (const [y, r] of [[4.6, 0.28], [5.2, 0.2]]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(r, r, D - 4, 10), pipeMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(x, y, 0);
        pipe.castShadow = true;
        scene.add(pipe);
      }
    }
    for (const [x, z] of [[-W / 2 + 0.9, -D / 2 + 0.9], [W / 2 - 0.9, -D / 2 + 0.9], [-W / 2 + 0.9, D / 2 - 0.9], [W / 2 - 0.9, D / 2 - 0.9]]) {
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5.4, 10), rustMat);
      riser.position.set(x, 2.7, z);
      scene.add(riser);
    }
    // Ceiling pipes crossing the hall between the beams.
    for (const z of [-14, 6]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, W - 6, 10), pipeMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 5.5, z);
      pipe.castShadow = true;
      scene.add(pipe);
    }
    // Cable trays: thin trays with two sagging cables, north and south.
    for (const z of [-D / 2 + 1.4, D / 2 - 1.4]) {
      const tray = new THREE.Mesh(new THREE.BoxGeometry(W - 6, 0.12, 0.7), darkMat);
      tray.position.set(0, 3.4, z);
      scene.add(tray);
      for (const dz of [-0.18, 0.18]) {
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, W - 6, 6), rustMat);
        cable.rotation.z = Math.PI / 2;
        cable.position.set(0, 3.3, z + dz);
        scene.add(cable);
      }
    }
    // Protruding wall panels with varied depth, east and west walls.
    for (let i = 0; i < 6; i++) {
      const z = -18 + i * 7;
      for (const sx of [-1, 1]) {
        const depth = 0.25 + ((i * 7 + (sx > 0 ? 3 : 0)) % 3) * 0.18;
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(depth, 3.4, 3.2),
          new THREE.MeshStandardMaterial({ map: metalTexture(), roughness: 0.7, metalness: 0.6 }),
        );
        panel.position.set(sx * (W / 2 - depth / 2 + 0.1), 2.4, z);
        panel.castShadow = true;
        panel.receiveShadow = true;
        scene.add(panel);
      }
    }
    // Vents: dark slatted boxes high on the north and south walls.
    for (const [x, z, ry] of [[-18, -D / 2 + 0.6, 0], [18, -D / 2 + 0.6, 0], [-10, D / 2 - 0.6, Math.PI], [14, D / 2 - 0.6, Math.PI]]) {
      const vent = new THREE.Group();
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 0.25), darkMat);
      vent.add(back);
      for (let v = 0; v < 4; v++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.14, 0.1), rustMat);
        slat.position.set(0, -0.55 + v * 0.36, 0.16);
        vent.add(slat);
      }
      vent.position.set(x, 4.6, z);
      vent.rotation.y = ry;
      scene.add(vent);
    }
  }

  buildCover() {
    const { scene } = this;
    const crateMat = (label) => {
      const tex = crateTexture(label);
      return new THREE.MeshStandardMaterial({
        map: tex, bumpMap: tex, bumpScale: 0.4, roughness: 0.75, metalness: 0.45,
      });
    };
    LEVEL.crates.forEach(([x, z, w, d, h], i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), crateMat(`F-${100 + i}`));
      m.position.set(x, h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      this.solids.push(m);
      this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    });
    const pillarMat = new THREE.MeshStandardMaterial({ color: COLORS.metal, roughness: 0.6, metalness: 0.6 });
    const ringMat = new THREE.MeshStandardMaterial({ color: COLORS.hazard, roughness: 0.5, metalness: 0.3, emissive: 0x332200 });
    LEVEL.pillars.forEach(([x, z, r, h]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, h, 12), pillarMat);
      p.position.set(x, h / 2, z);
      p.castShadow = true;
      p.receiveShadow = true;
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
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      group.add(plinth);
      this.solids.push(plinth);
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 1.7, 2.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x3d3a44, roughness: 0.55, metalness: 0.7 }),
      );
      housing.position.y = 1.7;
      housing.castShadow = true;
      housing.receiveShadow = true;
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
    const label = textSprite('EXTRACTION', '#7df0e2', 0.62);
    label.position.y = 3.9;
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
    const W = LEVEL.width;
    const D = LEVEL.depth;
    // --- Gantry crane silhouettes rising above the walls, north and south.
    // Very dark against the fog: the hall reads as part of a larger dock.
    const craneMat = new THREE.MeshStandardMaterial({ color: 0x0a090c, roughness: 1, metalness: 0.2 });
    const mkCrane = (cx, cz, span, height) => {
      const g = new THREE.Group();
      for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, height, 0.9), craneMat);
        leg.position.set(sx * span / 2, height / 2, 0);
        g.add(leg);
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.5, height * 0.7, 0.5), craneMat);
        brace.position.set(sx * span / 2, height * 0.45, 0);
        brace.rotation.z = sx * 0.35;
        g.add(brace);
      }
      const jib = new THREE.Mesh(new THREE.BoxGeometry(span + 4, 0.8, 0.8), craneMat);
      jib.position.set(0, height, 0);
      g.add(jib);
      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.7), craneMat);
      hook.position.set(span * 0.22, height - 1.6, 0);
      g.add(hook);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), craneMat);
      cable.position.set(span * 0.22, height - 0.55, 0);
      g.add(cable);
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,90,60,0.9)', 'rgba(255,80,60,0.2)'),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      lamp.scale.set(1.4, 1.4, 1);
      lamp.position.set(span * 0.22, height - 2.2, 0);
      g.add(lamp);
      g.position.set(cx, 0, cz);
      scene.add(g);
      return lamp;
    };
    this.craneLampN = mkCrane(0, -D / 2 - 2.5, 22, 13);
    this.craneLampS = mkCrane(10, D / 2 + 2.5, 16, 11);

    // --- Container stacks along the east and west walls (real cover). ------
    const stackDefs = [
      // x, z, w, d, h, tint, label
      [-27, -16, 6, 3, 3, 0x9a8a76, 'C-201'],
      [-27, -2, 5, 3, 2.4, 0xffffff, 'C-207'],
      [-27, 20, 5, 3, 2.4, 0x7a8a8a, 'C-213'],
      [27, -16, 6, 3, 3, 0xffffff, 'C-204'],
      [27, -2, 5, 3, 2.4, 0x9a8a76, 'C-209'],
      [27, 20, 5, 3, 2.4, 0x7a8a8a, 'C-216'],
    ];
    for (const [x, z, w, d, h, tint, label] of stackDefs) {
      const tex = crateTexture(label);
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          map: tex, bumpMap: tex, bumpScale: 0.4, color: tint, roughness: 0.8, metalness: 0.4,
        }),
      );
      m.position.set(x, h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      this.solids.push(m);
      this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    }
    // One second box stacked on the west stack for height variety.
    const topTex = crateTexture('C-208');
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2.2, 2.6),
      new THREE.MeshStandardMaterial({ map: topTex, bumpMap: topTex, bumpScale: 0.4, roughness: 0.8, metalness: 0.4 }),
    );
    top.position.set(-27, 2.4 + 1.1, -2);
    top.castShadow = true;
    top.receiveShadow = true;
    scene.add(top);
    this.solids.push(top);
    this.addCollider(-29, -25, -3.3, -0.7);

    // --- Hanging light fixtures under the beams (emissive + glow only). ----
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x1c1920, roughness: 0.8, metalness: 0.5 });
    for (const [x, z] of [[-12, 0], [12, 0], [-12, -12], [12, -12]]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), fixtureMat);
      cable.position.set(x, 5.35, z);
      scene.add(cable);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 1.0), fixtureMat);
      box.position.set(x, 4.85, z);
      scene.add(box);
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.36, 0.8),
        new THREE.MeshBasicMaterial({ color: 0xffc27a }),
      );
      panel.rotation.x = Math.PI / 2;
      panel.position.set(x, 4.7, z);
      scene.add(panel);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,190,110,0.8)', 'rgba(255,140,50,0.2)'),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7,
      }));
      glow.scale.set(3.2, 3.2, 1);
      glow.position.set(x, 4.5, z);
      scene.add(glow);
    }

    // --- Floor decals: hazard strips marking the pad approach and the cores.
    const stripTex = hazardStripTexture();
    const mkStrip = (x, z, w, ry) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, 0.55),
        new THREE.MeshBasicMaterial({
          map: stripTex, transparent: true, opacity: 0.85, depthWrite: false,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = ry;
      m.position.set(x, 0.02, z);
      scene.add(m);
    };
    mkStrip(0, 17.6, 6, 0);
    mkStrip(-26, -12.6, 5, 0);
    mkStrip(26, -12.6, 5, 0);
    mkStrip(0, -14.6, 5, 0);

    // --- Scattered floor debris: flat plates and pipe offcuts (visual only).
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0x2a262c, roughness: 0.9, metalness: 0.4 });
    const debris = [
      [3, 8, 0.7, 0.08, 0.5, 0.4], [-5, -2, 0.9, 0.07, 0.4, 1.1], [9, -6, 0.6, 0.08, 0.45, 2.2],
      [-11, 13, 0.8, 0.07, 0.5, 0.9], [15, 14, 0.7, 0.08, 0.4, 0.2], [-18, -10, 0.9, 0.07, 0.5, 1.6],
      [18, -10, 0.6, 0.08, 0.4, 2.8], [4, -16, 0.8, 0.07, 0.5, 0.7], [-3, 16, 0.7, 0.08, 0.45, 1.9],
    ];
    for (const [x, z, w, h, d, ry] of debris) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), debrisMat);
      m.position.set(x, h / 2, z);
      m.rotation.y = ry;
      m.receiveShadow = true;
      scene.add(m);
    }
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
    this.craneLampN.material.opacity = 0.55 + Math.sin(time * 2.4) * 0.45;
    this.craneLampS.material.opacity = 0.55 + Math.sin(time * 2.4 + 1.3) * 0.45;
    for (const kit of this.medkits) {
      if (!kit.available && time >= kit.respawnAt) {
        kit.available = true;
        kit.group.visible = true;
      }
      if (kit.available) kit.box.rotation.y += dt * 0.8;
    }
  }
}
