import { describe, expect, it } from "vitest";

import {
  barsOf,
  CHORD_MIDI,
  nextSongId,
  songBars,
  songBeats,
  SONGS,
  stepName,
  stepStarts,
} from "./songs";
import { STRINGS } from "./strings";

describe("the songs", () => {
  it("are four, each with a title, a tempo and steps", () => {
    expect(SONGS.length).toBe(4);
    SONGS.forEach((s) => {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.bpm).toBeGreaterThan(40);
      expect(s.steps.length).toBeGreaterThan(10);
    });
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(4);
  });

  it("play only the harp's strings", () => {
    SONGS.forEach((s) =>
      s.steps.forEach((x) => {
        expect(x.strings.length).toBeGreaterThan(0);
        expect(x.beats).toBeGreaterThan(0);
        x.strings.forEach((i) => {
          expect(Number.isInteger(i)).toBe(true);
          expect(STRINGS[i]).toBeDefined();
        });
      }),
    );
  });

  it("roll their chords low to high and glide their glissandos string by string", () => {
    const special = SONGS.flatMap((s) => s.steps).filter(
      (x) => x.kind !== "note",
    );
    expect(special.some((x) => x.kind === "roll")).toBe(true);
    expect(special.some((x) => x.kind === "gliss")).toBe(true);
    special.forEach((x) => {
      expect(x.strings.length).toBeGreaterThanOrEqual(3);
      x.strings.slice(1).forEach((s, i) => {
        expect(s).toBeGreaterThan(x.strings[i]);
        if (x.kind === "gliss") expect(s - x.strings[i]).toBe(1);
      });
    });
  });

  it("have a backing chord for every bar", () => {
    SONGS.forEach((s) => {
      expect(s.chords.length).toBe(songBars(s));
      s.chords.forEach((c) => expect(CHORD_MIDI[c]).toBeDefined());
    });
  });

  it("land Amazing Grace's bars after its upbeat", () => {
    const grace = SONGS.find((s) => s.id === "grace")!;
    const bars = barsOf(grace);
    expect(bars[0]).toEqual({ start: 0, beats: 1 });
    expect(bars[1]).toEqual({ start: 1, beats: 3 });
    // The first full bar starts on "A-" (C4), with the I chord.
    const starts = stepStarts(grace);
    expect(STRINGS[grace.steps[starts.indexOf(1)].strings[0]].note).toBe("C4");
    expect(grace.chords[1]).toBe("I");
    expect(bars[bars.length - 1].start + 3).toBe(songBeats(grace));
  });

  it("start each step where the last one ends", () => {
    const s = SONGS[0];
    const starts = stepStarts(s);
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBe(s.steps[0].beats);
    expect(songBeats(s)).toBe(48);
  });

  it("name their steps", () => {
    const ode = SONGS.find((s) => s.id === "ode")!;
    expect(stepName(ode.steps[0])).toBe("E4");
    expect(stepName(ode.steps[ode.steps.length - 1])).toBe("C3 G3 E4");
    const grace = SONGS.find((s) => s.id === "grace")!;
    expect(stepName(grace.steps[0])).toBe("C3 → G3");
  });

  it("go round to the first after the last", () => {
    expect(nextSongId(SONGS[3].id)).toBe(SONGS[0].id);
  });
});
