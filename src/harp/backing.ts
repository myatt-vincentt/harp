// The backing for Play, made in code: a soft count-in click, a low drone
// on the chord's root and a warm pad holding the chord, quieter than the
// harp so it leads. Scheduled ahead on the audio clock; a stop cuts it.
import { CHORD_MIDI, type Chord } from "./songs";

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Loudness of each part. */
const LEVEL = { click: 0.16, accent: 0.24, bass: 0.16, pad: 0.05, chime: 0.07 };

export type Backing = {
  click(at: number, accent: boolean): void;
  chord(chord: Chord, at: number, seconds: number): void;
  /** A short rising chime (a song finished). */
  chime(at: number): void;
  /** Cuts everything still sounding or due. */
  cut(now: number): void;
};

export const makeBacking = (ctx: AudioContext, out: AudioNode): Backing => {
  const bus = ctx.createGain();
  bus.connect(out);
  let live: Array<{ stop: (t: number) => void }> = [];

  const tone = (
    type: OscillatorType,
    freq: number,
    at: number,
    level: number,
    attack: number,
    hold: number,
    release: number,
    filter = 2400,
    detune = 0,
  ) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = filter;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + attack);
    g.gain.setTargetAtTime(0, at + attack + hold, release / 3);
    o.connect(lp).connect(g).connect(bus);
    o.start(at);
    const end = at + attack + hold + release * 2;
    o.stop(end);
    const h = {
      stop: (t: number) => {
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, 0.03);
        try {
          o.stop(t + 0.2);
        } catch {
          // already stopped
        }
      },
    };
    live.push(h);
    o.onended = () => {
      live = live.filter((x) => x !== h);
    };
  };

  return {
    click(at, accent) {
      tone(
        "sine",
        accent ? 1760 : 1320,
        at,
        accent ? LEVEL.accent : LEVEL.click,
        0.002,
        0.01,
        0.05,
        8000,
      );
    },
    chord(chord, at, seconds) {
      const { bass, pad } = CHORD_MIDI[chord];
      // A low drone on the root, held through the bar.
      tone("sine", hz(bass), at, LEVEL.bass, 0.2, seconds - 0.25, 0.5, 700);
      pad.forEach((m) =>
        [-6, 6].forEach((cents) =>
          tone(
            "sawtooth",
            hz(m),
            at,
            LEVEL.pad / 2,
            0.25,
            seconds - 0.3,
            0.4,
            900,
            cents,
          ),
        ),
      );
    },
    chime(at) {
      [74, 78, 81, 86].forEach((m, i) =>
        tone("sine", hz(m), at + i * 0.09, LEVEL.chime, 0.005, 0.05, 0.9, 6000),
      );
    },
    cut(now) {
      live.forEach((h) => h.stop(now));
      live = [];
    },
  };
};
