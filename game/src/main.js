// FERROX-9 — bootstrap, game loop, rules and the controller the
// screenshot / self-test hooks drive. States: title -> playing ->
// paused / won / lost, with a restart that resets everything clean.

import * as THREE from 'three';
import { GAME, PLAYER, SCORE, LEVEL, COLORS } from './config.js';
import { World } from './world.js';
import { Atmosphere } from './atmosphere.js';
import { Player } from './player.js';
import { EnemyManager } from './enemies.js';
import { SoundBank } from './audio.js';
import { HUD } from './hud.js';
import { applyShot, runSelfTest, parseQuery } from './shots.js';
import { glowTexture } from './textures.js';

const SHOT_MODE = new URLSearchParams(window.location.search).has('shot');
const SELFTEST_MODE = new URLSearchParams(window.location.search).get('selftest') === '1';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Cinematic grade: soft shadows and filmic tone mapping so the ember
    // lights bloom and the dark corners stay moody instead of flat.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = LEVEL.exposure;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 200);
    this.sound = new SoundBank();
    this.world = new World(this.scene);
    this.atmosphere = new Atmosphere(this.scene);
    this.player = new Player(this.camera, this.canvas, this.sound);
    this.enemies = new EnemyManager(this.scene, this.world, this.sound);
    this.hud = new HUD();
    this.state = 'title';
    this.score = 0;
    this.kills = 0;
    this.coresDone = 0;
    this.elapsed = 0;
    this.now = 0;
    this.lastCoreTick = 0;
    this.coreTarget = null;
    this.tracer = null;
    this.tracerUntil = 0;
    this.muzzleLight = null;
    this.muzzleUntil = 0;
    this.effects = [];
    this.lastTracerPoint = null;
    this.bindUI();
    this.bindShooting();
    window.addEventListener('resize', () => this.onResize());
    this.player.onInteract = (dt) => this.advanceCore(dt);
    this.enemies.onKill = (enemy, score) => this.onEnemyKilled(enemy, score);
    this.enemies.onPlayerHit = (dmg, from) => this.onPlayerHit(dmg, from);
  }

  bindUI() {
    const unlockAndStart = () => { this.sound.unlock(); this.sound.click(); this.startGame(); };
    document.getElementById('btn-start').addEventListener('click', unlockAndStart);
    document.getElementById('btn-again-win').addEventListener('click', unlockAndStart);
    document.getElementById('btn-again-lose').addEventListener('click', unlockAndStart);
    document.getElementById('btn-resume').addEventListener('click', () => {
      this.sound.unlock();
      this.sound.click();
      this.resumeGame();
    });
    this.canvas.addEventListener('click', () => {
      this.sound.unlock();
      if (this.state === 'playing' && !this.player.locked) this.player.requestLock();
    });
    document.addEventListener('pointerlockchange', () => {
      // Esc (or Alt-Tab) drops the lock mid-run: pause, unless this is a
      // scripted screenshot / self-test run.
      if (this.state === 'playing' && !this.player.locked && !SHOT_MODE && !SELFTEST_MODE) {
        this.pauseGame();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && (this.state === 'title' || this.state === 'won' || this.state === 'lost')) {
        this.sound.unlock();
        this.startGame();
      }
    });
  }

  bindShooting() {
    // Muzzle flash light + a reusable tracer line.
    this.muzzleLight = new THREE.PointLight(0xffb060, 0, 9, 1.6);
    this.scene.add(this.muzzleLight);
    const tracerGeo = new THREE.BufferGeometry();
    tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({
      color: 0xffc27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
    }));
    this.tracer.visible = false;
    this.tracer.frustumCulled = false;
    this.scene.add(this.tracer);
    this.player.onShoot = (origin, dir) => this.resolveShot(origin, dir);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // --- State transitions ---------------------------------------------------

  toTitle() {
    this.state = 'title';
    this.resetRun();
    this.hud.showOnly('screen-title');
  }

  startGame() {
    this.resetRun();
    this.state = 'playing';
    this.hud.showHud();
    this.hud.setObjective('Restart 3 fusion cores, then reach the extraction pad.');
    this.hud.showMessage('RESTART THE 3 FUSION CORES', 3);
    this.player.requestLock();
    this.refreshHud();
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showPause(true);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.showPause(false);
    this.player.requestLock();
  }

  winGame() {
    if (this.state === 'won') return;
    this.state = 'won';
    const timeBonus = Math.max(0, 600 - Math.floor(this.elapsed)) * SCORE.timeBonusPerSecond;
    this.score += SCORE.winBase + timeBonus;
    this.sound.win();
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.showWin(this.score, this.elapsed, this.kills);
  }

  loseGame() {
    if (this.state === 'lost') return;
    this.state = 'lost';
    this.sound.lose();
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.showLose(this.score, this.coresDone, GAME.coresToWin);
  }

  resetRun() {
    this.score = 0;
    this.kills = 0;
    this.coresDone = 0;
    this.elapsed = 0;
    this.coreTarget = null;
    this.player.reset();
    this.enemies.reset();
    for (const core of this.world.cores) {
      core.active = false;
      core.progress = 0;
      core.coreMat.emissive.setHex(0x442200);
      core.coreMat.emissiveIntensity = 0.6;
      core.glow.material.opacity = 0.55;
      core.light.intensity = 60;
      core.light.color.setHex(0xff8a30);
      core.ring.material.color.setHex(0x2fd6c8);
    }
    this.world.pad.armed = false;
    this.world.pad.ring.material.opacity = 0.4;
    this.world.pad.glow.material.opacity = 0.4;
    this.world.pad.light.intensity = 40;
    for (const kit of this.world.medkits) {
      kit.available = true;
      kit.group.visible = true;
    }
    this.enemies.spawnInitial();
    this.refreshHud();
  }

  refreshHud() {
    this.hud.setHealth(this.player.health, PLAYER.maxHealth);
    this.hud.setAmmo(this.player.ammo, PLAYER.magSize, this.player.reloading);
    this.hud.setCores(this.coresDone, GAME.coresToWin);
    this.hud.setScore(this.score);
    this.hud.setTimer(this.elapsed);
    this.hud.setEnemies(this.enemies.countAlive());
  }

  // --- Combat ---------------------------------------------------------------

  resolveShot(origin, dir) {
    const muzzle = origin.clone().addScaledVector(dir, 0.6);
    muzzle.y -= 0.12;
    const result = this.enemies.raycastShot(origin, dir, this.camera);
    this.lastTracerPoint = result.point.clone();
    // Tracer + muzzle flash.
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
    pos.setXYZ(1, result.point.x, result.point.y, result.point.z);
    pos.needsUpdate = true;
    this.tracer.visible = true;
    this.tracerUntil = this.now + 0.06;
    this.muzzleLight.position.copy(muzzle);
    this.muzzleLight.intensity = 90;
    this.muzzleUntil = this.now + 0.05;

    if (result.enemy) {
      const e = result.enemy;
      const headshot = result.point.y > e.pos.y + 0.35;
      const dmg = headshot ? PLAYER.headshotDamage : PLAYER.damage;
      const killed = e.takeDamage(dmg, this.now);
      this.hud.showHitmarker(killed);
      this.sound.hitMarker();
      this.spawnSpark(result.point, 0xffc27a);
      if (killed) this.sound.explosion();
      return { hit: true, killed, headshot };
    }
    if (result.blocked) this.spawnSpark(result.point, 0xff9a4d);
    return { hit: false, killed: false, headshot: false };
  }

  spawnSpark(point, color) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,220,150,0.95)', 'rgba(255,140,50,0.3)'),
      color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    sprite.position.copy(point);
    sprite.scale.set(0.9, 0.9, 1);
    this.scene.add(sprite);
    this.effects.push({ sprite, life: 0.28, max: 0.28 });
  }

  spawnExplosion(point) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,180,90,0.95)', 'rgba(255,80,20,0.35)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    sprite.position.copy(point);
    sprite.position.y += 0.4;
    sprite.scale.set(0.5, 0.5, 1);
    this.scene.add(sprite);
    this.effects.push({ sprite, life: 0.55, max: 0.55, grow: 6 });
  }

  onEnemyKilled(enemy, score) {
    this.kills += 1;
    this.score += score;
    this.sound.kill();
    this.spawnExplosion(enemy.pos);
    this.hud.setScore(this.score);
    this.hud.setEnemies(this.enemies.countAlive());
  }

  onPlayerHit(dmg, from) {
    if (this.state !== 'playing') return;
    this.player.damage(dmg, from);
    this.hud.flashDamage();
    this.hud.setHealth(this.player.health, PLAYER.maxHealth);
  }

  // --- Cores ------------------------------------------------------------------

  advanceCore(dt) {
    const core = this.world.nearestCore(this.player.pos, PLAYER.interactRange);
    if (!core) return;
    this.coreTarget = core;
    core.progress += dt / PLAYER.coreHoldSeconds;
    const pct = Math.min(99, Math.floor(core.progress * 100));
    this.hud.showInteract(`RESTARTING ${core.name.toUpperCase()} — ${pct}% (HOLD E)`);
    if (this.now - this.lastCoreTick > 0.22) {
      this.lastCoreTick = this.now;
      this.sound.coreTick(core.progress);
    }
    if (core.progress >= 1) this.completeCore(core);
  }

  completeCore(core) {
    this.world.activateCore(core);
    this.coresDone += 1;
    this.enemies.coresDone = this.coresDone;
    this.score += SCORE.core;
    this.sound.coreOnline();
    this.hud.setCores(this.coresDone, GAME.coresToWin);
    this.hud.setScore(this.score);
    this.hud.showInteract(null);
    this.enemies.spawnAfterCore();
    if (this.coresDone >= GAME.coresToWin) {
      this.world.armPad();
      this.hud.setObjective('ALL CORES ONLINE — reach the EXTRACTION pad!');
      this.hud.showMessage('ALL CORES ONLINE — GET TO EXTRACTION', 3.5);
    } else {
      const left = GAME.coresToWin - this.coresDone;
      this.hud.setObjective(`${this.coresDone} / ${GAME.coresToWin} cores online — restart ${left} more.`);
      this.hud.showMessage(`${core.name.toUpperCase()} ONLINE — ${left} CORE${left > 1 ? 'S' : ''} REMAIN`, 3);
    }
    this.hud.setEnemies(this.enemies.countAlive());
  }

  // --- Per-frame update -------------------------------------------------------

  updateGame(dt) {
    this.now += dt;
    if (this.state === 'playing') {
      this.elapsed += dt;
      this.player.update(dt, this.now, this.world);
      this.enemies.update(dt, this.now, this.player.pos, true);
      // Interact prompt when near an idle core and not holding E.
      const near = this.world.nearestCore(this.player.pos, PLAYER.interactRange);
      if (near && !this.player.keys['KeyE']) {
        this.hud.showInteract(`HOLD E TO RESTART ${near.name.toUpperCase()}`);
      } else if (!near && this.coreTarget) {
        this.hud.showInteract(null);
        this.coreTarget = null;
      } else if (!near && !this.player.keys['KeyE']) {
        this.hud.showInteract(null);
      }
      // Medkit pickup.
      if (this.world.tryMedkit(this.player.pos) && this.player.health < PLAYER.maxHealth) {
        this.player.heal(30);
        this.score += SCORE.medkit;
        this.sound.pickup();
        this.hud.showMessage('MEDKIT APPLIED  +30 INTEGRITY', 2);
        this.hud.setHealth(this.player.health, PLAYER.maxHealth);
        this.hud.setScore(this.score);
      }
      // Extraction: all cores done and standing on the pad.
      if (this.coresDone >= GAME.coresToWin && this.world.padContains(this.player.pos)) {
        this.winGame();
      }
      // Death.
      if (this.player.health <= 0) this.loseGame();
      // HUD refresh (cheap DOM writes each frame are fine at this scale).
      this.hud.setHealth(this.player.health, PLAYER.maxHealth);
      this.hud.setAmmo(this.player.ammo, PLAYER.magSize, this.player.reloading);
      this.hud.setTimer(this.elapsed);
      this.hud.setEnemies(this.enemies.countAlive());
    }
    // Transient effects always animate.
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.life -= dt;
      if (fx.life <= 0) {
        this.scene.remove(fx.sprite);
        this.effects.splice(i, 1);
      } else {
        const t = fx.life / fx.max;
        fx.sprite.material.opacity = t;
        if (fx.grow) {
          const s = (1 - t) * fx.grow + 0.5;
          fx.sprite.scale.set(s, s, 1);
        }
      }
    }
    if (this.tracer.visible && this.now > this.tracerUntil) this.tracer.visible = false;
    if (this.muzzleLight.intensity > 0 && this.now > this.muzzleUntil) this.muzzleLight.intensity = 0;
    this.world.update(dt, this.now);
    this.atmosphere.update(dt, this.now);
  }

  loop() {
    const clock = new THREE.Clock();
    const tick = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      this.updateGame(dt);
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  // --- Controller API for shots.js / self-test -----------------------------

  sceneMeshCount() {
    let n = 0;
    this.scene.traverse(() => n++);
    return n;
  }
  playerPos() { return { x: this.player.pos.x, z: this.player.pos.z }; }
  ammo() { return this.player.ammo; }
  health() { return this.player.health; }
  enemyCount() { return this.enemies.countAlive(); }
  padArmed() { return this.world.pad.armed; }
  lastTracer() { return this.lastTracerPoint; }

  setCameraView(pos, look) {
    this.player.pos.set(pos.x, pos.y, pos.z);
    this.player.yaw = look.yaw;
    this.player.pitch = look.pitch || 0;
    this.camera.position.set(pos.x, pos.y, pos.z);
    this.camera.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ');
  }

  spawnBackdropEnemies(rnd) {
    this.enemies.spawn('orb', 2);
    this.enemies.spawn('scuttler', 4);
    this.enemies.spawn('orb', 6);
  }

  spawnShotEnemies() {
    // Fixed, in-view placements for the gameplay screenshot.
    const orb = this.enemies.spawn('orb', 0);
    if (orb) { orb.pos.set(-4.5, 2.1, 3.5); orb.group.position.copy(orb.pos); }
    const scut = this.enemies.spawn('scuttler', 1);
    if (scut) { scut.pos.set(5.5, 0.45, 5.5); scut.group.position.copy(scut.pos); }
  }

  debugSetState({ health, ammo, score, elapsed, coresDone, kills }) {
    if (health !== undefined) this.player.health = health;
    if (ammo !== undefined) this.player.ammo = ammo;
    if (score !== undefined) this.score = score;
    if (elapsed !== undefined) this.elapsed = elapsed;
    if (coresDone !== undefined) this.coresDone = coresDone;
    if (kills !== undefined) this.kills = kills;
    this.refreshHud();
  }

  activateCoreById(id, silent) {
    const core = this.world.cores.find((c) => c.id === id);
    if (!core || core.active) return;
    this.world.activateCore(core);
    this.coresDone = this.world.cores.filter((c) => c.active).length;
    this.enemies.coresDone = this.coresDone;
    this.hud.setCores(this.coresDone, GAME.coresToWin);
    if (!silent) this.sound.coreOnline();
  }

  armExtraction() {
    this.world.armPad();
    this.hud.setObjective('ALL CORES ONLINE — reach the EXTRACTION pad!');
  }

  holdKeys(codes, steps) {
    for (const c of codes) this.player.keys[c] = true;
    this.step(steps);
    for (const c of codes) this.player.keys[c] = false;
  }

  shootOnce() {
    this.player.tryShoot(this.now);
  }

  spawnTestEnemy(kind, dist) {
    const dir = this.player.direction;
    const pos = this.player.pos.clone().addScaledVector(dir, dist);
    pos.y = 0;
    // Build through the manager so the enemy is tracked.
    const e = this.enemies.spawn(kind, 0);
    if (e) {
      e.pos.set(pos.x, kind === 'orb' ? 2.1 : 0.45, pos.z);
      e.group.position.copy(e.pos);
      // The raycast reads matrixWorld, which the renderer only refreshes
      // on the next frame: push this teleport through now so a shot taken
      // in the same tick still finds the enemy where it stands.
      e.group.updateMatrixWorld(true);
    }
    return e;
  }

  shootAt(enemy) {
    const target = enemy.pos.clone();
    target.y += 0.2;
    const dir = target.sub(this.camera.position).normalize();
    return this.resolveShot(this.camera.position.clone(), dir);
  }

  teleportToCore(id) {
    const core = this.world.cores.find((c) => c.id === id);
    if (!core) return;
    this.player.pos.set(core.x, PLAYER.eyeHeight, core.z + 2.6);
    this.player.yaw = 0; // facing north, toward the core
    this.player.pitch = 0;
    this.camera.position.copy(this.player.pos);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
  }

  holdInteract(steps) {
    this.player.keys['KeyE'] = true;
    this.step(steps);
    this.player.keys['KeyE'] = false;
  }

  teleportToMedkit(i) {
    const kit = this.world.medkits[i];
    if (!kit) return;
    this.player.pos.set(kit.x + 0.8, PLAYER.eyeHeight, kit.z);
  }

  damagePlayer(amount) {
    this.player.damage(amount, null);
    this.hud.setHealth(this.player.health, PLAYER.maxHealth);
  }

  teleportToPad() {
    this.player.pos.set(LEVEL.pad.x, PLAYER.eyeHeight, LEVEL.pad.z);
  }

  step(n) {
    for (let i = 0; i < n; i++) this.updateGame(1 / 60);
  }
}

// --- Boot ---------------------------------------------------------------------

const game = new Game();
game.toTitle();
game.loop();

const q = parseQuery();
if (q.selftest) {
  // Let the first frames render, then run the scripted checks.
  setTimeout(() => runSelfTest(game), 600);
} else if (q.shot) {
  // Settle the scene, then pose the requested state for the screenshot.
  setTimeout(() => applyShot(game, q.shot, q.seed), 700);
}

// Expose the controller for debugging and for the screenshot harness.
window.__game = game;
