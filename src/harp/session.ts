// A song being learnt or played (pure: times in seconds, one clock).
//
// The caller passes every string plucked (and when it sounds), and moves the
// session on with the time now.
//
// Learn waits for you: the next step counts once its string is plucked (a
// rolled chord or a glissando: its strings plucked in order). A wrong string
// just sounds, with a gentle hint; nothing can be failed, nothing hurries.
//
// Play runs at the song's tempo (or slower) after a one-bar count-in. Each
// step is judged by when its (first) string is plucked: within ±0.12 s of
// its beat is perfect, up to 0.3 s late is good; a roll or glissando then
// needs its other strings in order soon after. Otherwise it is missed.
import { songBeats, stepStarts, type Song } from "./songs";

export type Mode = "learn" | "play";
export type Judgement = "perfect" | "good" | "miss";

export type SessionEvent = {
  kind: Judgement | "hint";
  index: number;
  at: number;
};

/** Play: the timing window round a step's beat (s). */
export const TIMING = { perfect: 0.12, late: 0.3 };
/**
 * A roll's or glissando's other strings must follow the first within this
 * long (s): a roll's, and a glissando's per string (plus a little).
 */
export const FOLLOW = { roll: 0.7, glissPerString: 0.12, glissExtra: 0.4 };
/** Learn: a roll or glissando begun this long ago (s) starts afresh. */
export const LEARN_FOLLOW = 2;
/** The count-in before the first downbeat (bars). */
export const COUNT_IN_BARS = 1;

/** How a step's first string plucked `dt` s after its beat is judged (null: outside the window). */
export const judgeTiming = (dt: number): Judgement | null => {
  if (Math.abs(dt) <= TIMING.perfect) return "perfect";
  if (dt > TIMING.perfect && dt <= TIMING.late) return "good";
  return null;
};

const POINTS: Record<Judgement, number> = { perfect: 1, good: 0.6, miss: 0 };

/** Stars for a finished song (1–3), from how well its steps were played. */
export const starsFor = (results: readonly (Judgement | null)[]) => {
  const n = results.length || 1;
  const score = results.reduce((sum, r) => sum + (r ? POINTS[r] : 0), 0) / n;
  if (score >= 0.8) return 3;
  if (score >= 0.5) return 2;
  return 1;
};

/** How long a step's later strings have to follow its first (s). */
const followFor = (strings: number) =>
  strings <= 3
    ? FOLLOW.roll
    : FOLLOW.glissExtra + strings * FOLLOW.glissPerString;

/** Is `string` among those a hand crosses going between a step's strings? */
const between = (strings: number[], string: number) =>
  string > Math.min(...strings) && string < Math.max(...strings);

type Pending = {
  /** How many of its strings are plucked, in order. */
  got: number;
  /** When its first string was plucked, and how it was judged then. */
  firstAt: number;
  first: Judgement | null;
};

export class Session {
  readonly song: Song;

  readonly mode: Mode;

  readonly speed: number;

  /** Each step's result (Learn: "good" once played). */
  readonly results: (Judgement | null)[];

  /** Learn: the next step. Play: the earliest step not yet judged. */
  next = 0;

  done = false;

  /** Events not yet shown (the caller drains them). */
  events: SessionEvent[] = [];

  /** Each step's start (beats). */
  readonly starts: number[];

  /** Play: the time of the first downbeat. */
  readonly t0: number;

  private readonly spb: number;

  private readonly pending: Pending[];

  constructor(song: Song, mode: Mode, speed: number, now: number) {
    this.song = song;
    this.mode = mode;
    this.speed = mode === "learn" ? 1 : speed;
    this.spb = 60 / (song.bpm * this.speed);
    this.results = song.steps.map(() => null);
    this.pending = song.steps.map(() => ({
      got: 0,
      firstAt: -1e9,
      first: null,
    }));
    this.starts = stepStarts(song);
    this.t0 = now + COUNT_IN_BARS * song.beatsPerBar * this.spb;
  }

  /** Seconds per beat. */
  get secondsPerBeat() {
    return this.spb;
  }

  /** The time of a beat (Play). */
  timeOf(beat: number) {
    return this.t0 + beat * this.spb;
  }

  /** Play: the song's position (beats from the first downbeat; < 0 in the count-in). */
  beatAt(now: number) {
    return (now - this.t0) / this.spb;
  }

  /** The step to play now (Learn: the next; Play: the one under the beat). */
  current(now: number): number {
    if (this.mode === "learn") return this.next;
    const b = this.beatAt(now);
    for (let i = this.next; i < this.starts.length; i += 1)
      if (b < this.starts[i] + this.song.steps[i].beats) return i;
    return this.starts.length;
  }

  /** How far through the song (0..1). */
  progress(now: number) {
    if (this.mode === "learn") return this.next / this.song.steps.length;
    return Math.min(1, Math.max(0, this.beatAt(now) / songBeats(this.song)));
  }

  get stars() {
    return starsFor(this.results);
  }

  /** A string plucked, sounding at `t`. */
  pluck(string: number, t: number) {
    if (this.done) return;
    if (this.mode === "learn") this.learnPluck(string, t);
    else this.playPluck(string, t);
  }

  /** Moves on to `now` (Play: steps whose time has passed are judged). */
  update(now: number) {
    if (this.done || this.mode !== "play") return;
    const { steps } = this.song;
    while (this.next < steps.length) {
      const i = this.next;
      const p = this.pending[i];
      const beat = this.timeOf(this.starts[i]);
      const len = steps[i].strings.length;
      if (p.got === 0) {
        if (now <= beat + TIMING.late) break;
        this.judge(i, "miss", now);
      } else if (p.got < len) {
        if (now <= p.firstAt + followFor(len)) break;
        this.judge(i, "miss", now);
      } else break;
    }
    this.finishIfDone();
  }

  private judge(i: number, r: Judgement, at: number) {
    this.results[i] = r;
    this.events.push({ kind: r, index: i, at });
    // Steps are judged in order: the next unjudged one leads.
    while (this.next < this.results.length && this.results[this.next] !== null)
      this.next += 1;
  }

  private finishIfDone() {
    if (this.next >= this.song.steps.length) this.done = true;
  }

  private learnPluck(string: number, t: number) {
    const step = this.song.steps[this.next];
    if (!step) return;
    const p = this.pending[this.next];
    if (p.got > 0 && t - p.firstAt > LEARN_FOLLOW) p.got = 0;
    if (string === step.strings[p.got]) {
      if (p.got === 0) p.firstAt = t;
      p.got += 1;
      if (p.got >= step.strings.length) {
        this.judge(this.next, "good", t);
        this.finishIfDone();
      }
      return;
    }
    // Midway through a roll or glissando, other strings crossed on the way
    // do not matter; plucking its first string again starts it afresh.
    if (string === step.strings[0]) {
      p.got = 1;
      p.firstAt = t;
      return;
    }
    if (p.got > 0 && step.strings.includes(string)) return;
    if (p.got === 0 || !between(step.strings, string))
      this.events.push({ kind: "hint", index: this.next, at: t });
  }

  private playPluck(string: number, t: number) {
    const { steps } = this.song;
    // A roll or glissando under way: its next string.
    for (let i = this.next; i < steps.length; i += 1) {
      const p = this.pending[i];
      const st = steps[i].strings;
      const open =
        this.results[i] === null &&
        p.got > 0 &&
        p.got < st.length &&
        t - p.firstAt <= followFor(st.length);
      if (open && st[p.got] === string) {
        p.got += 1;
        if (p.got >= st.length) this.judge(i, p.first ?? "good", t);
        this.finishIfDone();
        return;
      }
    }
    // The first string of the earliest step it is in time for.
    for (let i = this.next; i < steps.length; i += 1) {
      const beat = this.timeOf(this.starts[i]);
      if (t < beat - TIMING.perfect) return;
      const p = this.pending[i];
      const r =
        this.results[i] === null &&
        p.got === 0 &&
        steps[i].strings[0] === string
          ? judgeTiming(t - beat)
          : null;
      if (r) {
        p.got = 1;
        p.firstAt = t;
        p.first = r;
        if (steps[i].strings.length === 1) this.judge(i, r, t);
        this.finishIfDone();
        return;
      }
    }
  }
}
