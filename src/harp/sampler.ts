// The harp's recorded voice: real plucked harp notes (one recording every
// two or three strings, played at a medium strength), behind the same
// `HarpVoice` as the voice made in code (synth.ts).
//
// Each string plays the nearest recording, retuned (at most a tone and a
// half). There is one strength of recording, so how hard the string is
// plucked sets the loudness, how bright it is (a gentle filter that opens for
// a hard pluck) and how sharp its start is. Every string rings on its own;
// plucked again, its last note gives way quickly. Damping fades every
// string out within a few hundredths of a second.
import { fadeOut, type HarpVoice } from "./synth";

/** A recorded note. */
export type SampleNote = { midi: number; buffer: AudioBuffer };

type Manifest = { notes: Array<{ midi: number; file: string }> };

/** Where the recordings' list is. */
export const SAMPLES_MANIFEST = "/sounds/harp.json";

/** Loads the recordings (null when they can't be loaded or decoded). */
export const loadSamples = async (
  ctx: BaseAudioContext,
): Promise<SampleNote[] | null> => {
  try {
    const res = await fetch(SAMPLES_MANIFEST);
    if (!res.ok) return null;
    const m = (await res.json()) as Manifest;
    return await Promise.all(
      m.notes.map(async (n) => {
        const r = await fetch(n.file);
        if (!r.ok) throw new Error(n.file);
        return {
          midi: n.midi,
          buffer: await ctx.decodeAudioData(await r.arrayBuffer()),
        };
      }),
    );
  } catch {
    return null;
  }
};

/** The recording nearest a note (and how far to retune it, semitones). */
export const nearestSample = <T extends { midi: number }>(
  bank: readonly T[],
  midi: number,
) => {
  let best = bank[0];
  bank.forEach((s) => {
    if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
  });
  return { sample: best, shift: midi - best.midi };
};

/**
 * How a pluck's strength shapes the recording: its loudness, the filter's
 * opening (Hz, soft … hard) and the start's length (s, soft … hard).
 */
export const STRENGTH = {
  loud: { soft: 0.3, hard: 1.15 },
  open: { soft: 1600, hard: 16000 },
  attack: { soft: 0.007, hard: 0.0008 },
};

/** A pluck's shaping for `velocity` 0..1. */
export const shapeOf = (velocity: number) => {
  const v = Math.min(1, Math.max(0, velocity));
  const { loud, open, attack } = STRENGTH;
  return {
    gain: loud.soft + (loud.hard - loud.soft) * v ** 1.1,
    cutoff: open.soft * (open.hard / open.soft) ** v,
    attack: attack.soft + (attack.hard - attack.soft) * v,
  };
};

/** Fades (time constants, s): a string plucked again, a damp. */
const TIME = { restrike: 0.015, damp: 0.05 };
/** The recordings' overall level beside the voice made in code. */
const LEVEL = 0.55;

type Ringing = { out: GainNode; srcs: AudioBufferSourceNode[] };

export const sampleHarp = (
  c: BaseAudioContext,
  out: AudioNode,
  bank: SampleNote[],
): HarpVoice => {
  const strings = new Map<number, Ringing>();
  return {
    pluck(string, midi, velocity, at) {
      const prev = strings.get(string);
      if (prev) fadeOut(prev, at, TIME.restrike);
      const { sample, shift } = nearestSample(bank, midi);
      const shape = shapeOf(velocity);
      const o = c.createGain();
      o.gain.setValueAtTime(0, at);
      o.gain.linearRampToValueAtTime(LEVEL * shape.gain, at + shape.attack);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 0.5;
      lp.frequency.value = Math.min(c.sampleRate / 2 - 100, shape.cutoff);
      lp.connect(o).connect(out);
      const s = c.createBufferSource();
      s.buffer = sample.buffer;
      s.playbackRate.value = 2 ** (shift / 12);
      s.connect(lp);
      s.start(at);
      const r: Ringing = { out: o, srcs: [s] };
      strings.set(string, r);
      s.addEventListener("ended", () => {
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
