// The harp's voice made in code (no recordings): a plucked string by the
// Karplus-Strong method, played until the recordings have loaded (or if they
// can't load).
//
// A burst of noise circulates in a delay line one period long; a gentle
// averaging filter in the loop takes the brightness out first, so the note
// starts bright and mellows as it rings, like a gut string. A soft pluck (the
// pad of the finger, near the middle) starts darker and rounder than a hard
// one (the finger snapping off, nearer the end), so the two sound different
// and are not only louder or quieter. Each note is rendered once (soft and
// hard) and kept; a pluck blends the two by strength.
//
// `HarpVoice` is all the rest of the app knows of a voice: the recordings
// (sampler.ts) play behind the same one.

/** Every string rings on its own. Times are the AudioContext's (s). */
export interface HarpVoice {
  /** Plucks `string` (0 C3 … 21 C6) on `midi`, `velocity` 0..1, at `at`. */
  pluck(string: number, midi: number, velocity: number, at: number): void;
  /** Every string stops ringing. */
  damp(at: number): void;
}

/** A note's frequency (Hz). */
export const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * How long a string rings (s, to silence): the low C3 longest, the top C6
 * shortest, as on a real harp.
 */
export const ringTime = (midi: number) =>
  Math.max(1.8, 6.5 - ((midi - 48) / 36) * 4.5);

/** The two plucks: how bright the burst is (0..1) and where it is plucked (share of the string). */
const LAYER = {
  soft: { bright: 0.3, at: 0.32 },
  hard: { bright: 0.9, at: 0.12 },
};
/** Loudness at full strength. */
const LOUD = 0.32;
/** Fades (time constants, s): a string plucked again, a damp. */
const TIME = { restrike: 0.015, damp: 0.05 };

/** How hard the strike is heard: the soft and hard pluck's shares (equal power). */
export const pluckBlend = (velocity: number) => {
  const k = Math.min(1, Math.max(0, velocity)) ** 0.9;
  return {
    soft: Math.cos((k * Math.PI) / 2),
    hard: Math.sin((k * Math.PI) / 2),
  };
};

/** One note, plucked softly or hard, rendered into samples. */
export const renderPluck = (
  sampleRate: number,
  midi: number,
  layer: keyof typeof LAYER,
  random: () => number = Math.random,
) => {
  const f = frequency(midi);
  const ring = ringTime(midi);
  const n = Math.round(sampleRate * (ring + 0.1));
  const out = new Float32Array(n);
  // The loop: one period, less the averaging filter's half sample.
  const period = sampleRate / f - 0.5;
  const whole = Math.floor(period);
  const frac = period - whole;
  // Loss per trip round the loop, so it falls 60 dB in `ring` seconds.
  const loss = 0.001 ** (1 / (f * ring));
  const { bright, at } = LAYER[layer];
  // The burst: noise, smoothed by how bright the pluck is, combed by where
  // the string is plucked (a node there), one period long.
  const burst = new Float32Array(whole + 2);
  let lp = 0;
  for (let i = 0; i < burst.length; i += 1) {
    lp += (random() * 2 - 1 - lp) * bright;
    burst[i] = lp;
  }
  const comb = Math.max(1, Math.round(at * whole));
  let mean = 0;
  for (let i = burst.length - 1; i >= 0; i -= 1) {
    burst[i] -= i >= comb ? burst[i - comb] : 0;
    mean += burst[i] / burst.length;
  }
  let peak = 1e-6;
  for (let i = 0; i < burst.length; i += 1) {
    burst[i] -= mean;
    peak = Math.max(peak, Math.abs(burst[i]));
  }
  for (let i = 0; i < burst.length; i += 1) out[i] = burst[i] / peak;
  // Round and round: y[i] += loss × the average of the two samples one period back.
  for (let i = whole + 2; i < n; i += 1) {
    const a = out[i - whole] * (1 - frac) + out[i - whole - 1] * frac;
    const b = out[i - whole - 1] * (1 - frac) + out[i - whole - 2] * frac;
    out[i] += loss * 0.5 * (a + b);
  }
  // A soft start (no click) and a short fade at the end.
  const fadeIn = Math.round(sampleRate * 0.0015);
  for (let i = 0; i < fadeIn; i += 1) out[i] *= i / fadeIn;
  const fadeOut = Math.round(sampleRate * 0.08);
  for (let i = 0; i < fadeOut; i += 1) out[n - 1 - i] *= i / fadeOut;
  return out;
};

type Ringing = { out: GainNode; srcs: AudioBufferSourceNode[] };

/** Fades a ringing string out from `at`. */
export const fadeOut = (r: Ringing, at: number, tc: number) => {
  r.out.gain.cancelScheduledValues(at);
  r.out.gain.setValueAtTime(r.out.gain.value, at);
  r.out.gain.setTargetAtTime(0, at, tc);
  r.srcs.forEach((s) => {
    try {
      s.stop(at + tc * 8);
    } catch {
      // already stopped
    }
  });
};

/**
 * The voice made in code. The body (a warm wooden box) is one shared filter
 * pair between the strings and `out`.
 */
export const synthHarp = (c: BaseAudioContext, out: AudioNode): HarpVoice => {
  const body = c.createBiquadFilter();
  body.type = "peaking";
  body.frequency.value = 230;
  body.Q.value = 0.9;
  body.gain.value = 4;
  const air = c.createBiquadFilter();
  air.type = "highshelf";
  air.frequency.value = 5000;
  air.gain.value = -5;
  body.connect(air).connect(out);
  const cache = new Map<string, AudioBuffer>();
  const bufferOf = (midi: number, layer: keyof typeof LAYER) => {
    const key = `${midi}-${layer}`;
    let b = cache.get(key);
    if (!b) {
      const data = renderPluck(c.sampleRate, midi, layer);
      b = c.createBuffer(1, data.length, c.sampleRate);
      b.copyToChannel(data, 0);
      cache.set(key, b);
    }
    return b;
  };
  const strings = new Map<number, Ringing>();
  return {
    pluck(string, midi, velocity, at) {
      const v = Math.min(1, Math.max(0, velocity));
      const prev = strings.get(string);
      if (prev) fadeOut(prev, at, TIME.restrike);
      const o = c.createGain();
      o.gain.value = LOUD * (0.25 + 0.75 * v ** 1.1);
      o.connect(body);
      const blend = pluckBlend(v);
      const srcs = (["soft", "hard"] as const).map((layer) => {
        const g = c.createGain();
        g.gain.value = blend[layer];
        const s = c.createBufferSource();
        s.buffer = bufferOf(midi, layer);
        s.connect(g).connect(o);
        s.start(at);
        return s;
      });
      const r: Ringing = { out: o, srcs };
      strings.set(string, r);
      srcs[0].addEventListener("ended", () => {
        if (strings.get(string) === r) strings.delete(string);
        o.disconnect();
      });
    },
    damp(at) {
      strings.forEach((r) => fadeOut(r, at, TIME.damp));
      strings.clear();
    },
  };
};
