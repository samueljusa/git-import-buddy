/** Sons « Apple motion » joués via WebAudio (aucun fichier requis). */

export type ChimeKind = "send" | "success" | "error" | "notify";

type Note = { f: number; t: number };

const PRESETS: Record<ChimeKind, { notes: Note[]; type: OscillatorType; gain: number; tail: number }> = {
  // Tap léger et montant au lancement d'une action
  send: { notes: [{ f: 880, t: 0 }, { f: 1174.66, t: 0.06 }], type: "sine", gain: 0.16, tail: 0.45 },
  // Accord clair et satisfaisant à la fin d'une génération
  success: {
    notes: [{ f: 659.25, t: 0 }, { f: 987.77, t: 0.1 }, { f: 1318.51, t: 0.2 }],
    type: "sine",
    gain: 0.2,
    tail: 0.9,
  },
  // Deux notes descendantes, discrètes
  error: { notes: [{ f: 392, t: 0 }, { f: 293.66, t: 0.12 }], type: "triangle", gain: 0.18, tail: 0.6 },
  // Notification (réponse support)
  notify: { notes: [{ f: 659.25, t: 0 }, { f: 987.77, t: 0.12 }], type: "sine", gain: 0.22, tail: 0.9 },
};

export function playChime(kind: ChimeKind = "notify") {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const preset = PRESETS[kind];
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const total = Math.max(...preset.notes.map((n) => n.t)) + preset.tail + 0.2;

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    master.gain.exponentialRampToValueAtTime(preset.gain, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + total);

    preset.notes.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = preset.type;
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.9, now + t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + preset.tail);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + t);
      osc.stop(now + t + preset.tail + 0.1);
    });

    setTimeout(() => void ctx.close().catch(() => undefined), (total + 0.4) * 1000);
  } catch {
    /* audio indisponible */
  }
}

/** Compat : carillon de notification. */
export function playAppleChime() {
  playChime("notify");
}
