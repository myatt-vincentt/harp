// Songs: learning and playing along.
//
// Learn waits for you at each step: the strings to play pulse gold on the
// harp and on the corner camera's air strings, the note card shows the step
// and the next three, and it counts once its string is plucked (a rolled
// chord or a glissando: its strings in order). A right step sparkles gold; a
// wrong string just sounds, with a gentle hint. Play runs the song at its
// tempo (or slower) after a one-bar count-in, with a soft backing (a low
// drone and a pad), and judges each step by its timing; at the end, one to
// three stars. Esc, or the dock's stop button, ends the song and free play
// carries on. Hands, keys and drags all play the songs.
import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";

import { sound } from "./audio";
import { makeBacking, type Backing } from "./backing";
import { COUNT_IN_BARS, Session, type Mode } from "./session";
import { songBars, songById } from "./songs";
import { harp, pluckHook } from "./state";

/** Play's slower speed. */
export const SLOW = 0.75;
/** How far ahead (s) the backing is scheduled. */
const LOOKAHEAD = 0.2;

const player = {
  backing: null as Backing | null,
  /** The next count-in beat and bar to schedule. */
  click: 0,
  bar: 0,
};

const perfNow = () => performance.now() / 1000;

/** Each song's best stars (Play), remembered in this browser. */
const BEST_KEY = "harp.best";
export const bestStars = (): Record<string, number> => {
  try {
    return JSON.parse(window.localStorage.getItem(BEST_KEY) ?? "{}") as Record<
      string,
      number
    >;
  } catch {
    return {};
  }
};
const saveBest = (id: string, stars: number) => {
  try {
    const best = bestStars();
    if ((best[id] ?? 0) >= stars) return;
    best[id] = stars;
    window.localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // no storage: not remembered
  }
};

/** Starts a song (from a tap: it also starts the sound). */
export const startSong = (id: string, mode: Mode) => {
  const song = songById(id);
  sound.unlock();
  const a = sound.audio();
  if (!song || !a) return;
  player.backing?.cut(a.ctx.currentTime);
  player.backing ??= makeBacking(a.ctx, a.master);
  harp.session = new Session(song, mode, harp.slow ? SLOW : 1, perfNow() + 0.1);
  player.click = 0;
  player.bar = 0;
  harp.target = song.steps[0].strings;
  harp.songCard = false;
  harp.howTo = false;
  harp.howToUntil = null;
  harp.finish = null;
  harp.changed();
};

/** Ends the song (free play carries on). */
export const stopSong = () => {
  const a = sound.audio();
  player.backing?.cut(a?.ctx.currentTime ?? 0);
  harp.session = null;
  harp.target = null;
  harp.changed();
};

/** The finish card goes (or a new song starts). */
export const closeFinish = () => {
  harp.finish = null;
  harp.changed();
};

export const SongPlayer = () => {
  // Esc ends the song, or closes the songs card or the finish card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (harp.session) stopSong();
      else if (harp.songCard || harp.finish) {
        harp.songCard = false;
        harp.finish = null;
        harp.changed();
      }
    };
    window.addEventListener("keydown", onKey);
    // Every string plucked goes to the song.
    pluckHook.fn = (string, at) => harp.session?.pluck(string, at);
    return () => {
      window.removeEventListener("keydown", onKey);
      pluckHook.fn = null;
    };
  }, []);
  useEffect(() => () => stopSong(), []);

  useFrame(() => {
    const s = harp.session;
    const a = sound.audio();
    if (!s || !a) return;
    const now = perfNow();
    s.update(now);
    // The song's clock is the page's; the backing's is the audio's.
    const toAudio = (t: number) => a.ctx.currentTime + (t - now);

    // Play: the count-in clicks and the backing's chords, a little ahead.
    if (s.mode === "play" && player.backing) {
      const bpb = s.song.beatsPerBar;
      const count = COUNT_IN_BARS * bpb;
      while (player.click < count) {
        const at = s.timeOf(player.click - count);
        if (at > now + LOOKAHEAD) break;
        player.backing.click(
          toAudio(Math.max(now, at)),
          player.click % bpb === 0,
        );
        player.click += 1;
      }
      while (player.bar < songBars(s.song)) {
        const at = s.timeOf(player.bar * bpb);
        if (at > now + LOOKAHEAD) break;
        player.backing.chord(
          s.song.chords[player.bar] ?? "I",
          toAudio(Math.max(now, at)),
          bpb * s.secondsPerBeat,
        );
        player.bar += 1;
      }
    }

    // Right steps sparkle; wrong strings bring a hint.
    s.events.forEach((e) => {
      if (e.kind === "good" || e.kind === "perfect") {
        harp.fx.goodSeq += 1;
        harp.fx.perfect = e.kind === "perfect";
      } else if (e.kind === "hint") harp.fx.hintSeq += 1;
    });
    let dirty = s.events.length > 0;
    s.events = [];

    // The strings to play now.
    const i = s.current(now);
    const target = i < s.song.steps.length ? s.song.steps[i].strings : null;
    if (target !== harp.target) {
      harp.target = target;
      dirty = true;
    }

    if (s.done) {
      const stars = s.mode === "play" ? s.stars : 3;
      if (s.mode === "play") saveBest(s.song.id, stars);
      player.backing?.chime(a.ctx.currentTime + 0.05);
      harp.finish = {
        id: s.song.id,
        mode: s.mode,
        stars,
        at: performance.now(),
      };
      harp.session = null;
      harp.target = null;
      dirty = true;
    }
    if (dirty) harp.changed();
  });

  return null;
};
