// Your hands, read from the hand tracker every frame. Both hands play, like
// at a real harp: each index fingertip is a plucker on the air strings
// (air.ts), spread across your camera picture as the corner camera shows it
// (so you always see every string there), in the order the harp's strings
// show on screen. Crossing a string plays it; a sweep plays a
// glissando, louder the faster you go; a fist held a moment stops every
// string. A lost hand does nothing: the strings ring on.
// The tracker names hands as they are on your body, whichever way the
// camera shows them; its picture points are as you see the picture.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { XRModel } from "@vincentt-xr/sdk";
import {
  useXRModelNode,
  type XRModelNodeHandTracking,
} from "@vincentt-xr/sdk/low-level";

import { AirStrings } from "./air";
import { fingersUp, type Joint } from "./fingers";
import { rig } from "./Harp";
import { frameRect, pictureToPanel } from "./layout";
import { damp, harp, pluck } from "./state";
import { STRINGS } from "./strings";

export const SIDES = ["left", "right"] as const;
export type Side = (typeof SIDES)[number];

/** The air strings (the corner camera draws them, the ghost hand follows them). */
export const air = new AirStrings(STRINGS.length);

/** What the ghost hand, the corner camera and the debug readout read about your hands. */
export const hands = {
  tracked: { left: false, right: false } as Record<Side, boolean>,
  fist: { left: false, right: false } as Record<Side, boolean>,
  /** The tip that played last, and when (s); where it is now (slot, band height). */
  lastTip: null as Side | null,
  playedAt: -1e9,
  /** When each tip last moved across the strings (s). */
  movedAt: { left: -1e9, right: -1e9 } as Record<Side, number>,
  plucks: 0,
  damps: 0,
  lastString: -1,
};

type Pt = { x: number; y: number };
const INDEX_TIP = 8;
/** A tip moving faster than this (slots / s) is moving. */
const MOVING = 1.5;

const a = new Vector3();
const b = new Vector3();

/** Is the harp showing its high strings on the left of the screen? */
const highOnLeft = (camera: Parameters<Vector3["project"]>[0]) => {
  const lo = STRINGS[0];
  const hi = STRINGS[STRINGS.length - 1];
  rig.harp.updateMatrixWorld();
  a.set(lo.x, (lo.bottom + lo.top) / 2, 0)
    .applyMatrix4(rig.harp.matrixWorld)
    .project(camera);
  b.set(hi.x, (hi.bottom + hi.top) / 2, 0)
    .applyMatrix4(rig.harp.matrixWorld)
    .project(camera);
  return b.x < a.x;
};

/** A band height (0 top … 1 bottom) as a height on string `i` (the harp's frame, m). */
export const heightOn = (i: number, h: number) => {
  const s = STRINGS[i];
  const k = 0.15 + 0.7 * (1 - Math.min(1, Math.max(0, h)));
  return s.bottom + (s.top - s.bottom) * k;
};

export const Hands = () => {
  const node = useXRModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);
  const st = useRef({
    stamp: { left: -1, right: -1 } as Record<Side, number>,
    up: { left: null, right: null } as Record<Side, boolean[] | null>,
    slot: { left: 0, right: 0 } as Record<Side, number>,
  });

  useFrame(({ camera, size }) => {
    const s = st.current;
    air.flip = highOnLeft(camera);
    const aspect = size.width / Math.max(1, size.height);
    const frame = frameRect(size.width, size.height);
    const panel = frame.width / Math.max(1, frame.height);
    const now = performance.now() / 1000;
    SIDES.forEach((side) => {
      const pose = harp.started ? (node?.poses?.[side] ?? null) : null;
      if (!pose || pose.held) {
        if (hands.tracked[side]) air.lost(side);
        hands.tracked[side] = false;
        hands.fist[side] = false;
        s.up[side] = null;
        return;
      }
      hands.tracked[side] = true;
      if (pose.timestampMs === s.stamp[side]) return;
      s.stamp[side] = pose.timestampMs;
      const img = pose.image as Pt[];
      // As the corner camera shows the picture: x 0 … 1 left to right, y 0 … 1 top to bottom.
      const at = (i: number) =>
        pictureToPanel(
          img[i].x * 0.5 + 0.5,
          0.5 - img[i].y * 0.5,
          aspect,
          panel,
        );
      const tip = at(INDEX_TIP);
      const k5 = at(5);
      const k17 = at(17);
      // The palm's width in panel widths (y is in heights: ÷ the aspect).
      const palm = Math.hypot(k5.x - k17.x, (k5.y - k17.y) / panel);
      s.up[side] = fingersUp(pose.world as Joint[], s.up[side]);
      const fist = s.up[side]!.every((u) => !u);
      hands.fist[side] = fist;
      const t = pose.timestampMs / 1000;
      air.push(side, { t, x: tip.x, y: tip.y, palm, fist }).forEach((e) => {
        if (e.kind === "damp") {
          damp("hands");
          hands.damps += 1;
          return;
        }
        pluck(
          e.string,
          e.velocity,
          "hands",
          heightOn(e.string, e.height),
          e.delay,
        );
        hands.plucks += 1;
        hands.lastString = e.string;
        hands.lastTip = side;
        hands.playedAt = now;
      });
      const seen = air.seen.get(side);
      if (seen) {
        if (Math.abs(seen.slot - s.slot[side]) > MOVING * 0.033 && seen.inBand)
          hands.movedAt[side] = now;
        s.slot[side] = seen.slot;
      }
    });
  });

  return null;
};
