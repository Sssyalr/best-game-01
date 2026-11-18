// FERROX-9 — deterministic states for screenshots and a self-test.
// ?shot=start|play|win|lose&seed=N puts the game into a fixed, readable
// state so the screenshots show the whole loop. ?selftest=1 plays the
// loop with scripted inputs and reports PASS/FAIL into the page, so a
// headless run can prove the game works without a mouse.

export function parseQuery() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot'),
    seed: parseInt(q.get('seed') || '1', 10) || 1,
    selftest: q.get('selftest') === '1',
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Put the game into a screenshot state. G is the controller main.js builds.
export function applyShot(G, shot, seed) {
  const rnd = mulberry32(seed);
  if (shot === 'start') {
    // Title screen over a moody view down the hall.
    G.toTitle();
    G.setCameraView({ x: 0, y: 3.4, z: 20 }, { yaw: 0, pitch: -0.06 });
    G.spawnBackdropEnemies(rnd);
    return 'start';
  }
  if (shot === 'play') {
    // Mid-game: one core restarted, two hostiles in view, HUD live.
    G.startGame();
    G.debugSetState({
      health: 78, ammo: 9, score: 650, elapsed: 154, coresDone: 1,
    });
    G.activateCoreById(0, true);
    G.setCameraView({ x: 2, y: 1.62, z: 12 }, { yaw: 0.12, pitch: -0.02 });
    G.spawnShotEnemies();
    G.hud.showMessage('CORE ALPHA ONLINE — 2 CORES REMAIN', 30);
    return 'play';
  }
  if (shot === 'win') {
    G.startGame();
    G.debugSetState({ health: 64, ammo: 7, score: 2840, elapsed: 226, kills: 9, coresDone: 3 });
    G.armExtraction();
    // Further back and tilted down: the pad reads as a destination, and its
    // floating label stays a landmark instead of filling the frame.
    G.setCameraView({ x: 0, y: 3.0, z: 12 }, { yaw: Math.PI, pitch: -0.18 });
    G.winGame();
    return 'win';
  }
  if (shot === 'lose') {
    G.startGame();
    G.debugSetState({ health: 0, ammo: 3, score: 950, elapsed: 187, kills: 5, coresDone: 1 });
    G.setCameraView({ x: -6, y: 1.62, z: 6 }, { yaw: -0.5, pitch: 0.05 });
    G.spawnShotEnemies();
    G.loseGame();
    return 'lose';
  }
  return null;
}

// Scripted end-to-end check of the whole loop. Writes one line per check
// into #selftest-result and into document.title, then returns the list.
export function runSelfTest(G) {
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok: !!ok, detail });
  };

  try {
    check('renderer', !!G.renderer, 'WebGL renderer exists');
    check('scene-meshes', G.sceneMeshCount() > 40, `${G.sceneMeshCount()} meshes in scene`);

    G.startGame();
    check('start', G.state === 'playing', `state=${G.state}`);

    // Movement: hold W for one second of fixed steps.
    const before = G.playerPos();
    G.holdKeys(['KeyW'], 60);
    const after = G.playerPos();
    const moved = Math.hypot(after.x - before.x, after.z - before.z);
    check('move-forward', moved > 2, `moved ${moved.toFixed(2)}m in 1s`);

    // Shooting: ammo drops, a tracer is produced.
    const ammoBefore = G.ammo();
    G.shootOnce();
    check('shoot-ammo', G.ammo() === ammoBefore - 1, `ammo ${ammoBefore} -> ${G.ammo()}`);
    check('tracer', G.lastTracer() !== null, 'tracer line drawn');

    // Enemy: spawn one in front, shoot it until it dies, score rises.
    const scoreBefore = G.score;
    const enemy = G.spawnTestEnemy('orb', 6);
    let hitSomething = false;
    for (let i = 0; i < 12 && !enemy.dead; i++) {
      const r = G.shootAt(enemy);
      if (r.hit) hitSomething = true;
      // Let the enemy manager run so a kill is processed and scored.
      G.step(9);
    }
    check('shoot-hits-enemy', hitSomething, 'raycast struck the orb');
    check('enemy-dies', enemy.dead, `orb health ${enemy.health}`);
    check('kill-scores', G.score > scoreBefore, `score ${scoreBefore} -> ${G.score}`);

    // Core: walk to Core Alpha and hold E to restart it.
    G.teleportToCore(0);
    G.holdInteract(150);
    check('core-restart', G.coresDone === 1, `cores done: ${G.coresDone}`);
    check('core-spawns', G.enemyCount() >= 5, `${G.enemyCount()} hostiles after first core`);

    // Medkit: damage, pick up, health rises.
    G.damagePlayer(40);
    const hpBefore = G.health();
    G.teleportToMedkit(0);
    G.step(30);
    check('medkit-heals', G.health() > hpBefore, `health ${hpBefore} -> ${G.health()}`);

    // Finish the remaining cores, arm the pad, step on it: win.
    // (Top the player up first: the scripted holds stand still under fire,
    // and a real player would use cover and medkits instead.)
    G.debugSetState({ health: 100 });
    G.teleportToCore(1);
    G.holdInteract(150);
    G.teleportToCore(2);
    G.holdInteract(150);
    check('all-cores', G.coresDone === 3, `cores done: ${G.coresDone}`);
    check('pad-armed', G.padArmed(), 'extraction pad armed');
    G.teleportToPad();
    G.step(10);
    check('win', G.state === 'won', `state=${G.state}`);

    // Restart, then die: lose.
    G.startGame();
    check('restart', G.state === 'playing' && G.health() === 100, 'fresh run after restart');
    G.damagePlayer(999);
    G.step(5);
    check('lose', G.state === 'lost', `state=${G.state}`);

    // Restart again: back to a clean run.
    G.startGame();
    check('restart-after-lose', G.state === 'playing' && G.score === 0, 'clean state after loss');
  } catch (err) {
    results.push({ name: 'exception', ok: false, detail: String(err && err.message || err) });
  }

  const passed = results.filter((r) => r.ok).length;
  const summary = `SELFTEST ${passed}/${results.length} ${passed === results.length ? 'PASS' : 'FAIL'}`;
  const lines = results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  const text = [summary, ...lines].join('\n');
  let node = document.getElementById('selftest-result');
  if (!node) {
    node = document.createElement('pre');
    node.id = 'selftest-result';
    document.body.appendChild(node);
  }
  node.textContent = text;
  document.title = summary;
  console.log(text);
  return { passed, total: results.length, results };
}
