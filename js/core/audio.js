// Sons synthétisés via WebAudio (aucun fichier audio à charger).
// Le contexte démarre au premier clic (politique d'autoplay des navigateurs).

let ctx = null;
let muted = false;

export function setMuted(v) {
  muted = !!v;
}
export function isMuted() {
  return muted;
}

function ac() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = AC ? new AC() : null;
    } catch (e) {
      ctx = null;
    }
  }
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, dur, type = "sine", gain = 0.18, when = 0) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

export function playHit(crit = false) {
  if (crit) {
    tone(200, 0.12, "square", 0.16);
    tone(95, 0.2, "sawtooth", 0.15, 0.015);
    tone(420, 0.1, "triangle", 0.12, 0.02);
  } else {
    tone(150, 0.09, "square", 0.13);
    tone(80, 0.13, "triangle", 0.12, 0.01);
  }
}

export function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "triangle", 0.17, i * 0.11));
}

export function playLose() {
  [330, 247, 175].forEach((f, i) => tone(f, 0.26, "sawtooth", 0.15, i * 0.14));
}

export function playDing() {
  tone(880, 0.12, "sine", 0.15);
  tone(1320, 0.16, "sine", 0.13, 0.06);
}
