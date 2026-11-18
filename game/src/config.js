// FERROX-9 — central tuning and level layout.
// One place holds every number the rest of the game reads, so balancing
// the game means editing this file, not hunting through the code.

export const GAME = {
  title: 'FERROX-9',
  subtitle: 'Salvage run on the derelict foundry station',
  coresToWin: 3,
  roundTimeLimit: 420, // seconds; 0 = no limit (the timer counts up instead)
};

export const PLAYER = {
  radius: 0.45,
  eyeHeight: 1.62,
  walkSpeed: 6.0,
  sprintSpeed: 9.0,
  accel: 42,
  friction: 10,
  maxHealth: 100,
  magSize: 12,
  reloadSeconds: 1.15,
  fireInterval: 0.14, // seconds between shots
  damage: 34,
  headshotDamage: 68,
  interactRange: 3.4,
  coreHoldSeconds: 2.0,
};

export const ORB = {
  name: 'Warden Orb',
  radius: 0.55,
  hoverHeight: 2.1,
  health: 60,
  patrolSpeed: 2.2,
  chaseSpeed: 3.6,
  aggroRange: 26,
  shootRange: 22,
  shootInterval: 1.7,
  boltSpeed: 16,
  boltDamage: 9,
  score: 150,
  color: 0xff5a3c,
};

export const SCUTTLER = {
  name: 'Scrap Scuttler',
  radius: 0.6,
  height: 0.9,
  health: 45,
  patrolSpeed: 2.8,
  chaseSpeed: 5.2,
  aggroRange: 20,
  lungeRange: 2.4,
  lungeDamage: 14,
  lungeCooldown: 1.1,
  score: 100,
  color: 0xffc233,
};

export const DIFFICULTY = {
  // Applied after each core is restarted: enemies get faster and bolder.
  perCoreSpeedBonus: 0.35,
  perCoreAggroBonus: 3,
  perCoreShootBonus: -0.18, // orb shoot interval shrinks
  spawnAfterCore: 2,
  maxEnemies: 10,
};

export const SCORE = {
  core: 500,
  winBase: 1000,
  timeBonusPerSecond: 2, // win bonus = max(0, 600 - seconds) * this
  medkit: 25,
};

export const LEVEL = {
  width: 64, // x: -32..32
  depth: 46, // z: -23..23
  wallHeight: 6,
  wallThickness: 1,
  fogColor: 0x0b090e,
  fogNear: 13,
  fogFar: 48,
  ambientColor: 0x2a2f45,
  ambientIntensity: 0.38,
  hemiSky: 0x353a55,
  hemiGround: 0x1a120c,
  hemiIntensity: 0.42,
  exposure: 1.18, // ACES filmic tone-mapping exposure
  // Player spawns at the south gate, facing north into the hall.
  playerSpawn: { x: 0, z: 19, yaw: 0 }, // yaw 0 faces north (-z) into the hall
  // Extraction pad: the shuttle dock at the south wall, behind the spawn.
  pad: { x: 0, z: 21.4, radius: 2.6 },
  // The three fusion cores to restart.
  cores: [
    { id: 0, name: 'Core Alpha', x: -26, z: -17 },
    { id: 1, name: 'Core Beta', x: 26, z: -17 },
    { id: 2, name: 'Core Gamma', x: 0, z: -19 },
  ],
  // Crates: [x, z, w, d, h] — cover and collision.
  crates: [
    [-14, 8, 4, 4, 2.2], [-10, 8, 3, 3, 1.4], [12, 10, 4, 3, 2.2],
    [16, 6, 3, 3, 1.4], [-20, -4, 3, 4, 2.2], [20, -4, 3, 4, 2.2],
    [-8, -8, 4, 3, 1.4], [8, -8, 4, 3, 1.4], [-14, -14, 3, 3, 2.2],
    [14, -14, 3, 3, 2.2], [0, 2, 5, 2, 1.2], [0, -12, 3, 3, 1.4],
    // Edge stacks added in the visual pass: clear of the spawn lane,
    // the core approaches, the medkits and the extraction pad.
    [-28, -8, 3, 3, 1.4], [28, -8, 3, 3, 1.4],
    [-28, 18, 3, 2, 2.2], [28, 18, 3, 2, 2.2],
  ],
  // Pillars: [x, z, radius, height]
  pillars: [
    [-16, 0, 1.1, 6], [16, 0, 1.1, 6],
    [-16, -12, 1.1, 6], [16, -12, 1.1, 6],
  ],
  // Enemy spawn points (patrol anchors).
  spawns: [
    { x: -24, z: 4 }, { x: 24, z: 4 }, { x: -10, z: -16 },
    { x: 10, z: -16 }, { x: 0, z: -6 }, { x: -26, z: 14 },
    { x: 26, z: 14 }, { x: 0, z: 12 },
  ],
  // Medkit stations: [x, z]
  medkits: [
    { x: -28, z: 12 }, { x: 28, z: 12 },
  ],
};

export const COLORS = {
  ember: 0xff6a2a,
  emberSoft: 0xff9a4d,
  teal: 0x2fd6c8,
  hazard: 0xffc233,
  floor: 0x232028,
  wall: 0x2e2b33,
  metal: 0x4a4550,
  dark: 0x121016,
};
