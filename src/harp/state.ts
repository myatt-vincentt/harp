// What the harp, the ghost hand, the pointer and keys and the page UI share.
// Per-frame values are read and written in the frame loop (never React
// state); the few the page UI shows bump a version it subscribes to.
import { useSyncExternalStore } from "react";

import { sound } from "./audio";
import { VIEWS, type View } from "./layout";
import { glissando, pluckHeight, STRINGS, OCTAVE, stringOf } from "./strings";

export type PlaySource = "hands" | "pointer" | "keys";

/** One string plucked, for the strings, the hand, the strip and the lights. */
export type PluckEvent = {
  seq: number;
  string: number;
  /** 0 (softest) … 1 (hardest). */
  velocity: number;
  /** Where on the strings it was plucked (the harp's frame, m). */
  y: number;
  by: PlaySource;
  /** performance.now() / 1000 when it sounds. */
  at: number;
};

const listeners = new Set<() => void>();
let version = 0;

export const harp = {
  /** Screen width ÷ height. */
  aspect: 1,
  /** The latest plucks (the strings and the lights read the ones they haven't seen). */
  events: [] as PluckEvent[],
  seq: 0,
  /** performance.now() / 1000 of the last pluck, and of the last damp. */
  playedAt: -1e9,
  dampedAt: -1e9,
  /** The strings plucked lately, newest last (the note strip shows them). */
  recent: [] as Array<{ seq: number; string: number }>,
  /** What has been played (read by the development debug object). */
  log: [] as Array<{ t: number; what: string; by: PlaySource }>,

  // What the page UI shows.
  view: "front" as View,
  night: false,
  /** The corner camera is tucked away. */
  camHidden: false,
  /** The studio, the harp and the hand have loaded. */
  loaded: false,
  /** Start was tapped on the home page (the camera runs). */
  started: false,
  /** The home page has gone (the harp is in front of you). */
  entered: false,
  /** The "how to play" steps card is open. */
  howTo: false,
  /** It opened right after Start: it closes by itself (performance.now() ms). */
  howToUntil: null as number | null,
  /** After the first card: the dock's one pulse (performance.now() ms). */
  dockPulseAt: null as number | null,
  changed() {
    version += 1;
    listeners.forEach((l) => l());
  },
};

/** The note strip shows this many notes. */
export const RECENT = 7;

export const nextView = () => {
  harp.view = VIEWS[(VIEWS.indexOf(harp.view) + 1) % VIEWS.length];
  harp.changed();
};

export const setView = (v: View) => {
  harp.view = v;
  harp.changed();
};

export const setNight = (on: boolean) => {
  harp.night = on;
  harp.changed();
};

/** Start on the home page: the sound and the camera. */
export const start = () => {
  if (harp.started) return;
  sound.unlock();
  harp.started = true;
  harp.changed();
};

/** The home page has faded: the steps card shows for a few seconds. */
export const INTRO_CARD_MS = 6000;
export const enter = () => {
  if (harp.entered) return;
  harp.entered = true;
  harp.howTo = true;
  harp.howToUntil = performance.now() + INTRO_CARD_MS;
  harp.changed();
};

/** The steps card closes. After the first one the dock pulses once. */
export const closeHowTo = () => {
  if (!harp.howTo) return;
  const first = harp.howToUntil !== null;
  harp.howTo = false;
  harp.howToUntil = null;
  if (first) harp.dockPulseAt = performance.now();
  harp.changed();
};

export const openHowTo = () => {
  harp.howTo = true;
  harp.changed();
};

export const toggleCam = () => {
  harp.camHidden = !harp.camHidden;
  harp.changed();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Re-renders the caller when the page UI's state changes. */
export const useHarpVersion = () =>
  useSyncExternalStore(subscribe, () => version);

const record = (what: string, by: PlaySource) => {
  harp.log.push({ t: Math.round(performance.now()), what, by });
  if (harp.log.length > 60) harp.log.shift();
};

/**
 * One string plucked, `velocity` 0..1, `delay` seconds from now (a
 * glissando spaces its strings out), at height `y` on the string.
 */
export const pluck = (
  string: number,
  velocity: number,
  by: PlaySource,
  y = pluckHeight(string),
  delay = 0,
) => {
  const s = STRINGS[string];
  if (!s) return;
  sound.unlock();
  const v = Math.min(1, Math.max(0, velocity));
  sound.pluck(string, s.midi, v, delay);
  harp.seq += 1;
  const at = performance.now() / 1000 + delay;
  harp.events.push({ seq: harp.seq, string, velocity: v, y, by, at });
  if (harp.events.length > 64) harp.events.shift();
  harp.recent.push({ seq: harp.seq, string });
  if (harp.recent.length > RECENT) harp.recent.shift();
  harp.playedAt = Math.max(harp.playedAt, at);
  record(`pluck ${s.note} ${v.toFixed(2)}`, by);
  harp.changed();
  if (harp.howTo && by === "hands") closeHowTo();
};

/** Space: a C-major glissando up the strings, C4 … C6 (or all of them). */
export const sweep = (by: PlaySource = "keys", velocity = 0.6, all = false) => {
  const from = all ? 0 : stringOf("C4");
  glissando(from, Math.min(STRINGS.length - 1, from + 2 * OCTAVE)).forEach(
    (g) => pluck(g.string, velocity, by, pluckHeight(g.string), g.delay),
  );
};

/** Everything ringing stops (a fist, or Esc). */
export const damp = (by: PlaySource = "hands") => {
  const now = performance.now() / 1000;
  if (now - harp.dampedAt < 0.05) return;
  harp.dampedAt = now;
  sound.damp();
  record("damp", by);
};

/** The plucks since `seq` (oldest first). */
export const plucksSince = (seq: number) =>
  harp.events.filter((e) => e.seq > seq);
