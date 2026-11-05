import { describe, expect, it } from "vitest";

import { nearestSample, shapeOf } from "./sampler";
import { frequency, pluckBlend, renderPluck, ringTime } from "./synth";

/** A seeded random, so the renders compare like with like. */
const seeded = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
};
const rms = (d: Float32Array, from: number, to: number) => {
  let sum = 0;
  for (let i = from; i < to; i += 1) sum += d[i] * d[i];
  return Math.sqrt(sum / (to - from));
};
/** The share of the sound's energy in sample-to-sample change: brightness. */
const brightness = (d: Float32Array, from: number, to: number) => {
  let diff = 0;
  let all = 0;
  for (let i = from + 1; i < to; i += 1) {
    diff += (d[i] - d[i - 1]) ** 2;
    all += d[i] ** 2;
  }
  return diff / all;
};

const SR = 22050;

describe("the voice made in code", () => {
  it("is in tune", () => {
    expect(frequency(69)).toBeCloseTo(440, 6);
    expect(frequency(60)).toBeCloseTo(261.63, 1);
  });

  it("rings long, the low strings longest", () => {
    expect(ringTime(48)).toBeGreaterThan(ringTime(84));
    expect(ringTime(84)).toBeGreaterThanOrEqual(1.8);
    const d = renderPluck(SR, 60, "hard", seeded(3));
    // Still sounding after a second, and dying away.
    const early = rms(d, 0, SR * 0.1);
    const later = rms(d, SR, SR * 1.1);
    expect(later).toBeGreaterThan(early * 0.05);
    expect(later).toBeLessThan(early);
  });

  it("sounds brighter plucked hard than soft", () => {
    const soft = renderPluck(SR, 60, "soft", seeded(7));
    const hard = renderPluck(SR, 60, "hard", seeded(7));
    const n = Math.round(SR * 0.05);
    expect(brightness(hard, 0, n)).toBeGreaterThan(brightness(soft, 0, n));
  });

  it("blends the soft and the hard pluck by strength", () => {
    expect(pluckBlend(0).soft).toBeCloseTo(1, 6);
    expect(pluckBlend(1).hard).toBeCloseTo(1, 6);
  });
});

describe("the recorded voice", () => {
  it("plays the nearest recording, retuned", () => {
    const bank = [{ midi: 45 }, { midi: 48 }, { midi: 52 }];
    expect(nearestSample(bank, 50)).toEqual({ sample: bank[1], shift: 2 });
    expect(nearestSample(bank, 53)).toEqual({ sample: bank[2], shift: 1 });
  });

  it("is louder, brighter and sharper plucked hard", () => {
    const soft = shapeOf(0.1);
    const hard = shapeOf(0.9);
    expect(hard.gain).toBeGreaterThan(soft.gain);
    expect(hard.cutoff).toBeGreaterThan(soft.cutoff);
    expect(hard.attack).toBeLessThan(soft.attack);
  });
});
