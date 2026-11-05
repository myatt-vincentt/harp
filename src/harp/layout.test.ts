import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { frameRect, HARP, keepPoints, phoneness, viewMargins } from "./layout";

describe("the layout", () => {
  it("reads a laptop as wide and a phone as tall", () => {
    expect(phoneness(16 / 9)).toBe(0);
    expect(phoneness(390 / 844)).toBe(1);
  });

  it("keeps the corner camera in the top-right corner", () => {
    const r = frameRect(1440, 900);
    expect(r.left + r.width).toBe(1440 - 16);
    expect(r.top).toBe(16);
  });

  it("keeps room for the dock and the note strip below, and the corner camera above", () => {
    const m = viewMargins(390, 844);
    expect(m.bottom).toBeLessThan(0.75);
    expect(m.under).toBeLessThan(m.top);
  });

  it("stands the harp turned 17° with its strings facing the viewer", () => {
    const facing = new Vector3(0, 0, 1).applyQuaternion(HARP.quat);
    expect((Math.atan2(facing.x, facing.z) * 180) / Math.PI).toBeCloseTo(17, 0);
    expect(facing.y).toBeCloseTo(0, 6);
  });

  it("keeps the harp in view, above the floor", () => {
    (["front", "player", "close"] as const).forEach((v) => {
      keepPoints(v).forEach((p) => {
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(Math.hypot(p.x, p.z + 0.2)).toBeLessThan(1.2);
      });
    });
  });
});
