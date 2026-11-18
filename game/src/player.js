// FERROX-9 — the player: first-person movement, mouse look, shooting,
// reloading, health and core interaction. Pointer lock owns the mouse;
// the game never reads it outside of play.

import * as THREE from 'three';
import { PLAYER, LEVEL } from './config.js';

export class Player {
  constructor(camera, dom, sound) {
    this.camera = camera;
    this.dom = dom;
    this.sound = sound;
    this.pos = new THREE.Vector3(LEVEL.playerSpawn.x, PLAYER.eyeHeight, LEVEL.playerSpawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = LEVEL.playerSpawn.yaw;
    this.pitch = 0;
    this.health = PLAYER.maxHealth;
    this.ammo = PLAYER.magSize;
    this.reloading = false;
    this.reloadEndsAt = 0;
    this.lastShotAt = -10;
    this.holdingFire = false;
    this.keys = {};
    this.locked = false;
    this.onShoot = null; // (origin, direction) => hit info, set by main
    this.onInteract = null; // () => void, set by main
    this.onReload = null;
    this.tracer = null;
    this.muzzle = null;
    this.bindInput();
  }

  bindInput() {
    const dom = this.dom;
    dom.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      this.keys[e.code] = true;
      if (e.code === 'KeyR') this.startReload();
    });
    dom.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    dom.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.holdingFire = true;
    });
    dom.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.holdingFire = false;
    });
    dom.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0021;
      this.pitch -= e.movementY * 0.0021;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
    dom.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
    });
    dom.addEventListener('blur', () => { this.holdingFire = false; });
  }

  requestLock() {
    if (!this.locked) {
      try {
        const p = this.dom.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* headless / denied: play continues without lock */ }
    }
  }

  reset() {
    this.pos.set(LEVEL.playerSpawn.x, PLAYER.eyeHeight, LEVEL.playerSpawn.z);
    this.vel.set(0, 0, 0);
    this.yaw = LEVEL.playerSpawn.yaw;
    this.pitch = 0;
    this.health = PLAYER.maxHealth;
    this.ammo = PLAYER.magSize;
    this.reloading = false;
    this.holdingFire = false;
    this.keys = {};
  }

  get direction() {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  startReload() {
    if (this.reloading || this.ammo === PLAYER.magSize) return;
    this.reloading = true;
    this.reloadEndsAt = performance.now() / 1000 + PLAYER.reloadSeconds;
    this.sound.reload();
    if (this.onReload) this.onReload();
  }

  tryShoot(now) {
    if (this.reloading) return false;
    if (now - this.lastShotAt < PLAYER.fireInterval) return false;
    if (this.ammo <= 0) {
      this.sound.dryFire();
      this.lastShotAt = now;
      this.startReload();
      return false;
    }
    this.lastShotAt = now;
    this.ammo -= 1;
    this.sound.shot();
    if (this.onShoot) this.onShoot(this.camera.position.clone(), this.direction);
    return true;
  }

  damage(amount, fromPos) {
    if (this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.sound.hurt();
    // A small kick away from the attacker sells the hit.
    if (fromPos) {
      const away = new THREE.Vector3(this.pos.x - fromPos.x, 0, this.pos.z - fromPos.z);
      if (away.lengthSq() > 0.01) {
        away.normalize().multiplyScalar(2.2);
        this.vel.x += away.x;
        this.vel.z += away.z;
      }
    }
  }

  heal(amount) {
    this.health = Math.min(PLAYER.maxHealth, this.health + amount);
  }

  update(dt, now, world) {
    // Reload completion.
    if (this.reloading && now >= this.reloadEndsAt) {
      this.reloading = false;
      this.ammo = PLAYER.magSize;
    }
    // Movement: WASD relative to yaw, Shift to sprint.
    const sprint = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const forward = (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) - (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
    const strafe = (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) - (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let mx = (-sin * forward) + (cos * strafe);
    let mz = (-cos * forward) + (-sin * strafe);
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }
    this.vel.x += mx * PLAYER.accel * dt;
    this.vel.z += mz * PLAYER.accel * dt;
    // Friction when no input.
    const damp = Math.exp(-PLAYER.friction * dt);
    if (len === 0) { this.vel.x *= damp; this.vel.z *= damp; }
    // Clamp horizontal speed.
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (hSpeed > speed) {
      this.vel.x *= speed / hSpeed;
      this.vel.z *= speed / hSpeed;
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    world.collide(this.pos, PLAYER.radius);
    // Head bob while moving on the ground.
    const bob = hSpeed > 0.5 ? Math.sin(now * 9) * 0.045 * Math.min(1, hSpeed / speed) : 0;
    this.camera.position.set(this.pos.x, PLAYER.eyeHeight + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    // Hold-to-fire.
    if (this.holdingFire && this.locked) this.tryShoot(now);
    // Hold E to interact with a core.
    if (this.keys['KeyE'] && this.onInteract) this.onInteract(dt);
  }
}
