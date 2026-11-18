// FERROX-9 — the HUD and the screens: health, ammo, cores, score, timer,
// crosshair, hitmarkers, damage feedback and the title / win / lose
// overlays. All of it is plain DOM over the canvas.

export class HUD {
  constructor() {
    this.el = {};
    for (const id of [
      'hud', 'health-fill', 'health-num', 'ammo-num', 'reload-hint',
      'cores-pips', 'score-num', 'timer-num', 'enemies-num',
      'crosshair', 'hitmarker', 'message', 'vignette', 'interact',
      'screen-title', 'screen-win', 'screen-lose', 'screen-pause',
      'win-score', 'win-time', 'win-kills', 'lose-score', 'lose-cores',
      'title-hint', 'objective-line',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.messageTimer = null;
    this.hitTimer = null;
  }

  showOnly(screenId) {
    for (const id of ['screen-title', 'screen-win', 'screen-lose', 'screen-pause']) {
      this.el[id].classList.toggle('hidden', id !== screenId);
    }
    this.el.hud.classList.toggle('hidden', screenId === 'screen-title');
    if (screenId) this.el.hud.classList.add('hidden');
    else this.el.hud.classList.remove('hidden');
  }

  showHud() {
    this.showOnly(null);
  }

  setHealth(hp, max) {
    const pct = Math.max(0, (hp / max) * 100);
    this.el['health-fill'].style.width = `${pct}%`;
    this.el['health-fill'].classList.toggle('low', pct <= 30);
    this.el['health-num'].textContent = `${Math.ceil(hp)}`;
  }

  setAmmo(ammo, mag, reloading) {
    this.el['ammo-num'].textContent = reloading ? '--' : `${ammo} / ${mag}`;
    this.el['reload-hint'].classList.toggle('hidden', !reloading);
  }

  setCores(done, total) {
    const pips = this.el['cores-pips'];
    pips.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const pip = document.createElement('span');
      pip.className = `pip${i < done ? ' on' : ''}`;
      pip.textContent = '⬢';
      pips.appendChild(pip);
    }
  }

  setScore(score) {
    this.el['score-num'].textContent = String(score).padStart(5, '0');
  }

  setTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    this.el['timer-num'].textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  setEnemies(n) {
    this.el['enemies-num'].textContent = String(n);
  }

  setObjective(text) {
    this.el['objective-line'].textContent = text;
  }

  showMessage(text, seconds = 2.6) {
    this.el.message.textContent = text;
    this.el.message.classList.remove('hidden');
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.el.message.classList.add('hidden'), seconds * 1000);
  }

  showHitmarker(kill) {
    const h = this.el.hitmarker;
    h.textContent = kill ? '✕' : '✚';
    h.classList.toggle('kill', kill);
    h.classList.remove('hidden');
    clearTimeout(this.hitTimer);
    this.hitTimer = setTimeout(() => h.classList.add('hidden'), 140);
  }

  flashDamage() {
    const v = this.el.vignette;
    v.classList.remove('flash');
    void v.offsetWidth; // restart the CSS animation
    v.classList.add('flash');
  }

  showInteract(text) {
    if (!text) {
      this.el.interact.classList.add('hidden');
      return;
    }
    this.el.interact.textContent = text;
    this.el.interact.classList.remove('hidden');
  }

  showWin(score, seconds, kills) {
    this.el['win-score'].textContent = String(score).padStart(5, '0');
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    this.el['win-time'].textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    this.el['win-kills'].textContent = String(kills);
    this.showOnly('screen-win');
  }

  showLose(score, coresDone, total) {
    this.el['lose-score'].textContent = String(score).padStart(5, '0');
    this.el['lose-cores'].textContent = `${coresDone} / ${total}`;
    this.showOnly('screen-lose');
  }

  showPause(paused) {
    if (paused) this.showOnly('screen-pause');
    else this.showOnly(null);
  }
}
