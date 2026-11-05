// The harp's sound engine (Web Audio): 22 strings, each ringing on its own
// (the recorded harp, sampler.ts, once loaded; until then the voice made in
// code, synth.ts), a small hall's reverb and a gentle limiter, and a meter
// the studio's speakers and LEDs move with. Silent until Start (browsers
// only start audio on a tap).
//
//   strings → master → dry + (pre-delay → hall) → limiter → speakers
import { loadSamples, sampleHarp, type SampleNote } from "./sampler";
import { synthHarp, type HarpVoice } from "./synth";

const MASTER = 0.7;
/** The hall: its length (s), how fast it dies, how much is heard, its pre-delay (s). */
const HALL = { length: 3.2, decay: 2.6, wet: 0.26, preDelay: 0.022 };
/** Speaker motion: rise fast, fall back over this long (s). */
const RELEASE = 0.16;
/** A pluck starts this far ahead of the audio clock (s), so a glissando keeps its spacing. */
const LEAD = 0.01;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let synth: HarpVoice | null = null;
let recorded: HarpVoice | null = null;
/** Which voice plays: the recordings (when loaded) or the one made in code. */
let useRecorded = true;
let unlocked = false;
/** The recordings, once loaded (also for the development checks). */
export const samples: { bank: SampleNote[] | null } = { bank: null };

let analyser: AnalyserNode | null = null;
let wave: Float32Array | null = null;
let bins: Uint8Array | null = null;
/** What the room's speakers show: overall level and the low end (0..1, eased). */
const out = { level: 0, low: 0 };

/** What has been played (read by the development debug object). */
export const meter = {
  unlocked: false,
  /** The loudest sample sent out so far (1 = full scale). */
  peak: 0,
  events: [] as Array<{ t: number; what: string }>,
};

const log = (what: string) => {
  meter.events.push({ t: Math.round((ctx?.currentTime ?? 0) * 1000), what });
  if (meter.events.length > 40) meter.events.shift();
};

/** A small hall: noise dying away, darker as it fades, a little different left and right. */
const hallImpulse = (c: AudioContext) => {
  const n = Math.round(c.sampleRate * HALL.length);
  const ir = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i += 1) {
      const t = i / n;
      const k = 0.18 + 0.6 * (1 - t);
      lp += (Math.random() * 2 - 1 - lp) * k;
      d[i] = lp * (1 - t) ** HALL.decay;
    }
  }
  return ir;
};

const makeContext = () => {
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  const c = new AC({ latencyHint: "interactive" });
  master = c.createGain();
  master.gain.value = MASTER;
  const sum = c.createGain();
  const pre = c.createDelay(0.1);
  pre.delayTime.value = HALL.preDelay;
  const hall = c.createConvolver();
  hall.buffer = hallImpulse(c);
  const wet = c.createGain();
  wet.gain.value = HALL.wet;
  master.connect(sum);
  master.connect(pre).connect(hall).connect(wet).connect(sum);
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -9;
  limiter.knee.value = 8;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.3;
  analyser = c.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0;
  wave = new Float32Array(analyser.fftSize);
  bins = new Uint8Array(analyser.frequencyBinCount);
  sum.connect(limiter).connect(analyser).connect(c.destination);
  synth = synthHarp(c, master);
  const to = master;
  void loadSamples(c).then((bank) => {
    if (!bank || !to) return;
    samples.bank = bank;
    recorded = sampleHarp(c, to, bank);
  });
  return c;
};

const voice = () => (useRecorded && recorded ? recorded : synth);

export const sound = {
  /**
   * The output's level and its low end right now, each 0..1: quick to rise,
   * easing back over about 0.16 s. Silent is 0.
   */
  levels(dt: number) {
    if (!analyser || !wave || !bins || !ctx || ctx.state !== "running") {
      out.level = 0;
      out.low = 0;
      return out;
    }
    analyser.getFloatTimeDomainData(wave as Float32Array<ArrayBuffer>);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < wave.length; i += 1) {
      sum += wave[i] * wave[i];
      peak = Math.max(peak, Math.abs(wave[i]));
    }
    meter.peak = Math.max(meter.peak, peak);
    const rms = Math.sqrt(sum / wave.length);
    analyser.getByteFrequencyData(bins as Uint8Array<ArrayBuffer>);
    // The bins below about 250 Hz (the harp's bass strings).
    const top = Math.max(
      1,
      Math.round((250 / (ctx.sampleRate / 2)) * bins.length),
    );
    let low = 0;
    for (let i = 1; i <= top; i += 1) low = Math.max(low, bins[i] / 255);
    const level = Math.min(1, rms * 4);
    const lowNow = Math.max(0, (low - 0.55) / 0.45);
    const fall = Math.exp(-dt / (RELEASE / 3));
    out.level = level > out.level ? level : out.level * fall;
    out.low = lowNow > out.low ? lowNow : out.low * fall;
    return out;
  },

  /** The levels as last measured (by the studio, once a frame). */
  get last() {
    return out;
  },

  meter,

  /** Sets up the sound (no sound yet). */
  preload() {
    if (ctx) return;
    ctx = makeContext();
  },

  /** Start: the browser lets the sound play from here on. */
  unlock() {
    if (!ctx) this.preload();
    if (!ctx) return;
    // Play through the phone's silent switch, like a music app.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = "playback";
    } catch {
      // not supported
    }
    if (ctx.state !== "running") void ctx.resume();
    unlocked = true;
    meter.unlocked = true;
  },

  get unlocked() {
    return unlocked;
  },

  /** One string plucked, `delay` seconds from now. */
  pluck(string: number, midi: number, velocity: number, delay = 0) {
    const v = voice();
    if (!ctx || !v || !unlocked) return;
    v.pluck(string, midi, velocity, ctx.currentTime + LEAD + delay);
    log(`pluck ${string} ${velocity.toFixed(2)}`);
  },

  /** Every string stops ringing (both voices, in case they swapped). */
  damp() {
    if (!ctx) return;
    synth?.damp(ctx.currentTime);
    recorded?.damp(ctx.currentTime);
    log("damp");
  },

  /** Plays the recordings (true) or the voice made in code (false). */
  useRecordings(on: boolean) {
    useRecorded = on;
  },

  /** Which voice plays now. */
  get voiceKind() {
    return voice() === recorded && recorded ? "recorded" : "synth";
  },
};
