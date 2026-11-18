// FERROX-9 — the hostiles: Warden Orbs (hovering shooters) and Scrap
// Scuttlers (fast ground lungers). One manager owns spawning, AI and
// the enemy bolts the player has to dodge.

import * as THREE from 'three';
import { ORB, SCUTTLER, DIFFICULTY, LEVEL } from './config.js';
import { glowTexture } from './textures.js';

// Line of sight: sample the segment for a blocking collider (walls/crates).
export function hasLineOfSight(world, from, to) {
  const steps = 12;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const z = from.z + (to.z - from.z) * t;
    if (world.pointBlocked(x, y, z)) return false;
  }
  return true;
}

class Enemy {
  constructor(kind, def, pos, scene) {
    this.kind = kind; // 'orb' | 'scuttler'
    this.def = def;
    this.health = def.health;
    this.maxHealth = def.health;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.state = 'patrol';
    this.patrolTarget = null;
    this.patrolWait = 0;
    this.attackCooldown = 0;
    this.lungeCooldown = 0;
    this.flashUntil = 0;
    this.dead = false;
    this.scene = scene;
    this.buildMesh();
  }

  buildMesh() { /* overridden */ }

  takeDamage(amount, now) {
    if (this.dead) return false;
    this.health -= amount;
    this.flashUntil = now + 0.09;
    if (this.health <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}

class Orb extends Enemy {
  constructor(def, pos, scene) {
    super('orb', def, pos, scene);
    this.pos.y = ORB.hoverHeight;
  }

  buildMesh() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a26, roughness: 0.35, metalness: 0.8, emissive: ORB.color, emissiveIntensity: 0.25,
    });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(ORB.radius, 0), bodyMat);
    body.castShadow = true;
    g.add(body);
    // Glowing eye that tracks the player.
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xff3b1e }),
    );
    eye.position.set(0, 0, ORB.radius * 0.75);
    g.add(eye);
    this.eye = eye;
    // Hover ring.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ORB.radius + 0.12, 0.05, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.4, metalness: 0.8, emissive: ORB.color, emissiveIntensity: 0.5 }),
    );
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    this.ring = ring;
    // Health bar sprite above the orb.
    const bar = this.makeHealthBar();
    bar.raycast = () => {};
    bar.position.y = ORB.radius + 0.55;
    g.add(bar);
    this.bar = bar;
    this.bodyMat = bodyMat;
    g.position.copy(this.pos);
    this.group = g;
    this.group.userData.enemy = this;
    this.scene.add(g);
  }

  makeHealthBar() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 8;
    this.barCanvas = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.4, 0.18, 1);
    return sprite;
  }

  updateBar() {
    const ctx = this.barCanvas.getContext('2d');
    ctx.fillStyle = '#1a0d08';
    ctx.fillRect(0, 0, 64, 8);
    ctx.fillStyle = '#ff5a3c';
    ctx.fillRect(1, 1, 62 * Math.max(0, this.health / this.maxHealth), 6);
    this.bar.material.map.needsUpdate = true;
  }
}

class Scuttler extends Enemy {
  constructor(def, pos, scene) {
    super('scuttler', def, pos, scene);
    this.pos.y = SCUTTLER.height / 2;
  }

  buildMesh() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x4a4030, roughness: 0.5, metalness: 0.7, emissive: SCUTTLER.color, emissiveIntensity: 0.18,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 1.4), bodyMat);
    body.position.y = 0.42;
    body.castShadow = true;
    g.add(body);
    // Jaw / mandibles at the front.
    const jawMat = new THREE.MeshStandardMaterial({ color: 0x2a241c, roughness: 0.4, metalness: 0.8 });
    const jawL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.7), jawMat);
    jawL.position.set(-0.4, 0.3, 0.9);
    const jawR = jawL.clone();
    jawR.position.x = 0.4;
    g.add(jawL, jawR);
    // Eyes.
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffc233 });
    for (const sx of [-0.25, 0.25]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
      eye.position.set(sx, 0.62, 0.62);
      g.add(eye);
    }
    // Legs: six thin struts that animate while it runs.
    this.legs = [];
    const legMat = new THREE.MeshStandardMaterial({ color: 0x332e26, roughness: 0.6, metalness: 0.6 });
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), legMat);
      leg.position.set(side * 0.6, 0.25, -0.45 + Math.floor(i / 2) * 0.45);
      g.add(leg);
      this.legs.push(leg);
    }
    const bar = this.makeHealthBar();
    bar.raycast = () => {};
    bar.position.y = 1.15;
    g.add(bar);
    this.bar = bar;
    this.bodyMat = bodyMat;
    g.position.copy(this.pos);
    this.group = g;
    this.group.userData.enemy = this;
    this.scene.add(g);
  }

  makeHealthBar() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 8;
    this.barCanvas = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.4, 0.18, 1);
    return sprite;
  }

  updateBar() {
    const ctx = this.barCanvas.getContext('2d');
    ctx.fillStyle = '#14100a';
    ctx.fillRect(0, 0, 64, 8);
    ctx.fillStyle = '#ffc233';
    ctx.fillRect(1, 1, 62 * Math.max(0, this.health / this.maxHealth), 6);
    this.bar.material.map.needsUpdate = true;
  }
}

export class EnemyManager {
  constructor(scene, world, sound) {
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.enemies = [];
    this.bolts = []; // enemy projectiles
    this.coresDone = 0;
    this.spawnIndex = 0;
    this.boltGeo = new THREE.SphereGeometry(0.16, 8, 8);
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0xff4a22 });
    this.boltGlowTex = glowTexture('rgba(255,90,40,0.95)', 'rgba(255,60,20,0.25)');
    this.onKill = null; // (enemy, score) => void
    this.onPlayerHit = null; // (damage, fromPos) => void
  }

  speedBonus() { return this.coresDone * DIFFICULTY.perCoreSpeedBonus; }
  aggroBonus() { return this.coresDone * DIFFICULTY.perCoreAggroBonus; }
  shootBonus() { return this.coresDone * DIFFICULTY.perCoreShootBonus; }

  reset() {
    for (const e of this.enemies) e.dispose();
    for (const b of this.bolts) this.scene.remove(b.mesh);
    this.enemies = [];
    this.bolts = [];
    this.coresDone = 0;
    this.spawnIndex = 0;
  }

  spawnInitial() {
    this.spawn('orb', 0);
    this.spawn('scuttler', 1);
    this.spawn('orb', 3);
    this.spawn('scuttler', 5);
  }

  spawn(kind, spawnIdx) {
    if (this.enemies.length >= DIFFICULTY.maxEnemies) return null;
    const s = LEVEL.spawns[spawnIdx % LEVEL.spawns.length];
    const pos = new THREE.Vector3(s.x + (Math.random() - 0.5), 0, s.z + (Math.random() - 0.5));
    const enemy = kind === 'orb' ? new Orb(ORB, pos, this.scene) : new Scuttler(SCUTTLER, pos, this.scene);
    this.enemies.push(enemy);
    return enemy;
  }

  spawnAfterCore() {
    for (let i = 0; i < DIFFICULTY.spawnAfterCore; i++) {
      this.spawnIndex += 2;
      this.spawn(i % 2 === 0 ? 'scuttler' : 'orb', this.spawnIndex);
    }
  }

  pickPatrolTarget(enemy) {
    const s = LEVEL.spawns[(Math.random() * LEVEL.spawns.length) | 0];
    enemy.patrolTarget = new THREE.Vector3(s.x, enemy.pos.y, s.z);
  }

  // A hitscan shot from the player: returns the enemy hit (if any) and the
  // impact point, so main can draw a tracer and a spark.
  raycastShot(origin, direction, camera, maxDist = 80) {
    const ray = new THREE.Raycaster(origin, direction, 0.1, maxDist);
    // Sprites (health bars) need a camera to raycast; without one the
    // raycaster throws. Pass the player's camera through.
    ray.camera = camera;
    const meshes = [];
    for (const e of this.enemies) meshes.push(e.group);
    const hits = ray.intersectObjects(meshes, true);
    let enemyHit = null;
    let enemyDist = Infinity;
    for (const h of hits) {
      let obj = h.object;
      while (obj && !obj.userData.enemy) obj = obj.parent;
      if (obj && obj.userData.enemy) { enemyHit = obj.userData.enemy; enemyDist = h.distance; break; }
    }
    // Distance to the nearest solid wall, for the impact spark.
    const wallHits = ray.intersectObjects(this.world.solids, false);
    const wallDist = wallHits.length ? wallHits[0].distance : maxDist;
    if (enemyHit && enemyDist <= wallDist) {
      return { enemy: enemyHit, point: origin.clone().addScaledVector(direction, enemyDist), blocked: false };
    }
    return { enemy: null, point: origin.clone().addScaledVector(direction, Math.min(wallDist, maxDist)), blocked: wallHits.length > 0 };
  }

  fireBolt(from, targetPos) {
    const dir = targetPos.clone().sub(from).normalize();
    const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
    mesh.position.copy(from);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.boltGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(1.1, 1.1, 1);
    mesh.add(glow);
    this.scene.add(mesh);
    this.bolts.push({ mesh, vel: dir.multiplyScalar(ORB.boltSpeed), life: 4 });
  }

  update(dt, now, playerPos, playerAlive) {
    // --- Enemies ----------------------------------------------------------
    for (const e of this.enemies) {
      if (e.dead) continue;
      const toPlayer = new THREE.Vector3().subVectors(playerPos, e.pos);
      toPlayer.y = 0;
      const dist = toPlayer.length();
      const def = e.def;
      const speedMul = 1 + this.speedBonus() / 4;
      const aggro = def.aggroRange + this.aggroBonus();
      const eyePos = new THREE.Vector3(e.pos.x, e.pos.y + 0.3, e.pos.z);
      const canSee = playerAlive && dist < aggro && hasLineOfSight(this.world, eyePos, new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z));
      e.state = canSee ? 'chase' : 'patrol';
      e.attackCooldown -= dt;
      e.lungeCooldown -= dt;

      if (e.state === 'patrol') {
        if (!e.patrolTarget || e.pos.distanceTo(e.patrolTarget) < 1.2) {
          if (e.patrolWait > 0) e.patrolWait -= dt;
          else { this.pickPatrolTarget(e); e.patrolWait = 1 + Math.random() * 2; }
        } else {
          this.moveEnemy(e, e.patrolTarget, def.patrolSpeed * speedMul, dt);
        }
      } else {
        // Chase: steer at the player.
        const target = new THREE.Vector3(playerPos.x, e.pos.y, playerPos.z);
        const chaseSpeed = def.chaseSpeed * speedMul;
        if (e.kind === 'scuttler' && dist < SCUTTLER.lungeRange && e.lungeCooldown <= 0) {
          e.lungeCooldown = SCUTTLER.lungeCooldown;
          if (this.onPlayerHit) this.onPlayerHit(SCUTTLER.lungeDamage, e.pos.clone());
        } else {
          this.moveEnemy(e, target, chaseSpeed, dt);
        }
        // Orbs shoot when they have a line and are in range.
        if (e.kind === 'orb' && dist < ORB.shootRange && e.attackCooldown <= 0 && canSee) {
          e.attackCooldown = Math.max(0.7, ORB.shootInterval + this.shootBonus());
          const muzzle = e.pos.clone();
          muzzle.y += 0.2;
          const aim = new THREE.Vector3(playerPos.x, playerPos.y - 0.15, playerPos.z);
          this.fireBolt(muzzle, aim);
          this.sound.enemyShot();
        }
      }

      // Face the player (or the patrol direction).
      const face = e.state === 'chase' ? toPlayer : (e.patrolTarget ? new THREE.Vector3().subVectors(e.patrolTarget, e.pos) : new THREE.Vector3(0, 0, 1));
      if (face.lengthSq() > 0.01) {
        const targetYaw = Math.atan2(face.x, face.z);
        let d = targetYaw - e.group.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        e.group.rotation.y += d * Math.min(1, dt * 8);
      }

      // Hover bob for orbs; leg scuttle for crawlers.
      if (e.kind === 'orb') {
        e.pos.y = ORB.hoverHeight + Math.sin(now * 2.2 + e.group.rotation.y * 3) * 0.18;
        e.ring.rotation.z += dt * 1.5;
      } else {
        const running = e.state === 'chase';
        e.legs.forEach((leg, i) => {
          leg.rotation.x = running ? Math.sin(now * 14 + i * 1.1) * 0.5 : Math.sin(now * 3 + i) * 0.08;
        });
      }
      e.group.position.copy(e.pos);
      // Hit flash.
      const flashing = now < e.flashUntil;
      e.bodyMat.emissiveIntensity = flashing ? 1.6 : (e.kind === 'orb' ? 0.25 : 0.18);
      e.updateBar();
    }

    // --- Bolts -------------------------------------------------------------
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      const p = b.mesh.position;
      let dead = b.life <= 0;
      if (!dead && playerAlive) {
        const d = Math.hypot(p.x - playerPos.x, p.y - playerPos.y, p.z - playerPos.z);
        if (d < 0.75) {
          dead = true;
          if (this.onPlayerHit) this.onPlayerHit(ORB.boltDamage, p.clone());
        }
      }
      if (!dead && this.world.pointBlocked(p.x, p.y, p.z)) dead = true;
      if (dead) {
        this.scene.remove(b.mesh);
        this.bolts.splice(i, 1);
      }
    }

    // --- Remove the dead ----------------------------------------------------
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].dead) {
        const dead = this.enemies[i];
        this.enemies.splice(i, 1);
        if (this.onKill) this.onKill(dead, dead.def.score);
        dead.dispose();
      }
    }
  }

  moveEnemy(e, target, speed, dt) {
    const dir = new THREE.Vector3().subVectors(target, e.pos);
    dir.y = 0;
    const dist = dir.length();
    if (dist < 0.05) return;
    dir.normalize();
    const step = Math.min(dist, speed * dt);
    const next = e.pos.clone().addScaledVector(dir, step);
    // Orbs hover and only mind walls; scuttlers mind walls too.
    const saveY = next.y;
    this.world.collide(next, e.def.radius + 0.1);
    next.y = saveY;
    e.pos.copy(next);
  }

  countAlive() {
    return this.enemies.length;
  }
}
