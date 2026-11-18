// FERROX-9 — the entry program (Node 22, standard library only).
//
// The game itself is plain static files under game/ (game/index.html and
// its ES modules, plus the vendored three.js build), and the screenshots
// that show it are under screenshots/. This program's whole job is to hand
// those two folders in: it copies them into the output directory and
// writes the dossier.json the judge reads, built by the vendored
// make.fun library so the scorer can reproduce it byte for byte.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the folder this file lives in; the grader runs
// it from a read-only snapshot of that same folder.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The dossier caps come from the competition's own gate: the text is
// capped at 160 KiB, at most 4 screenshots of at most 256 KiB each, and
// game/ is capped at 993 entries / 48 MiB / 1000-byte paths, because the
// grader caps /output itself at 1000 entries and game/ counts beside
// screenshots/ and dossier.json.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(outDir, { recursive: true });

  // The playable game, exactly as it ships in this repository.
  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });

  // The screenshots, when the folder exists (it always does in the repo).
  const shots = join(repoRoot, 'screenshots');
  if (existsSync(shots)) {
    cpSync(shots, join(outDir, 'screenshots'), { recursive: true });
  }

  // The dossier the judge reads: the game's source outline plus the
  // screenshots, as the vendored library writes them from /output.
  writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, dossierCaps));
}

handIn();
