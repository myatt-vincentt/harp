// Playing with a mouse, fingers or the computer keyboard, no hands needed:
//   drag    across the strings: every string crossed is plucked, in order
//           (a glissando), louder the faster you drag
//   tap     a string: it is plucked
//   keys    A S D F G H J K play C4 … C5, with Shift an octave up; Space
//           plays a C-major glissando; Esc damps every string
// The ghost hand follows the pointer over the strings. Works in every view.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Matrix4, Plane, Raycaster, Vector2, Vector3 } from "three";

import { rig } from "./Harp";
import { damp, harp, pluck, sweep } from "./state";
import {
  crossedStrings,
  keyString,
  nearestString,
  onStringArea,
  speedToVelocity,
} from "./strings";

/** A key's pluck strength (0..1), a tap's, and Space's glissando. */
const KEY_VELOCITY = 0.6;
const TAP_VELOCITY = 0.5;
const SWEEP_VELOCITY = 0.55;
/** A tap: shorter than this (s) and moved less than this (m). */
const TAP = { time: 0.35, move: 0.008 };
/** A drag's speed reads over the last this long (s), and at least this long. */
const SPEED_WINDOW = 0.08;
const MIN_DT = 0.016;

/** Where the pointer is over the strings (the harp's frame; the ghost hand follows it). */
export const pointer = {
  /** Over the strings now. */
  over: false,
  /** Pressed (dragging). */
  down: false,
  x: 0,
  y: 0,
  /** performance.now() / 1000 of the last move over the strings. */
  at: -1e9,
};

/** Is this event on a control (the dock, a card, the camera, the media switcher…)? */
const onControl = (e: Event) => {
  const el = e.target as HTMLElement | null;
  return !!el?.closest?.(
    "[data-hud], button, select, input, textarea, a, [role='button']",
  );
};

export const PointerInput = () => {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const ray = new Raycaster();
    const ndc = new Vector2();
    const canvas = gl.domElement;
    const touchWas = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    const cursorWas = canvas.style.cursor;
    const plane = new Plane();
    const inv = new Matrix4();
    const hit = new Vector3();
    const normal = new Vector3();
    const origin = new Vector3();

    /** Where the pointer meets the strings' plane, in the harp's frame (or null). */
    const onPlane = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -(((e.clientY - r.top) / r.height) * 2 - 1),
      );
      ray.setFromCamera(ndc, camera);
      rig.harp.updateMatrixWorld();
      normal.set(0, 0, 1).transformDirection(rig.harp.matrixWorld);
      origin.setFromMatrixPosition(rig.harp.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(normal, origin);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      inv.copy(rig.harp.matrixWorld).invert();
      const local = hit.applyMatrix4(inv);
      return { x: local.x, y: local.y, t: performance.now() / 1000 };
    };

    const follow = (p: { x: number; y: number; t: number }) => {
      pointer.over = onStringArea(p.x, p.y, 0.04);
      if (!pointer.over) return;
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.at = p.t;
    };

    /** A drag in progress: where it started, and where it was last. */
    const drags = new Map<
      number,
      {
        x0: number;
        y0: number;
        t0: number;
        x: number;
        y: number;
        t: number;
        moved: number;
        /** Recent readings (x, t), for the speed. */
        trail: Array<{ x: number; t: number }>;
      }
    >();

    const onDown = (e: PointerEvent) => {
      if (onControl(e) || !harp.entered) return;
      const p = onPlane(e);
      if (!p) return;
      drags.set(e.pointerId, {
        x0: p.x,
        y0: p.y,
        t0: p.t,
        x: p.x,
        y: p.y,
        t: p.t,
        moved: 0,
        trail: [{ x: p.x, t: p.t }],
      });
      pointer.down = true;
      follow(p);
    };
    const onMove = (e: PointerEvent) => {
      const d = drags.get(e.pointerId);
      const p = onPlane(e);
      if (!p) return;
      if (!d) {
        if (e.pointerType !== "mouse" || onControl(e) || !harp.entered) {
          pointer.over = false;
          return;
        }
        follow(p);
        canvas.style.cursor = pointer.over ? "pointer" : cursorWas;
        return;
      }
      follow(p);
      // The speed across the strings over the last few readings.
      d.trail.push({ x: p.x, t: p.t });
      while (d.trail.length > 2 && p.t - d.trail[1].t > SPEED_WINDOW)
        d.trail.shift();
      const ref = d.trail[0];
      const velocity = speedToVelocity(
        (p.x - ref.x) / Math.max(MIN_DT, p.t - ref.t),
      );
      // Every string crossed since the last reading, in order.
      crossedStrings(
        { x: d.x, y: d.y, z: 0 },
        { x: p.x, y: p.y, z: 0 },
      ).forEach((c) => pluck(c.string, velocity, "pointer", c.y));
      d.moved += Math.hypot(p.x - d.x, p.y - d.y);
      d.x = p.x;
      d.y = p.y;
      d.t = p.t;
    };
    const onUp = (e: PointerEvent) => {
      const d = drags.get(e.pointerId);
      drags.delete(e.pointerId);
      pointer.down = drags.size > 0;
      if (e.pointerType !== "mouse") pointer.over = false;
      if (!d) return;
      // A tap plucks the string under it.
      const t = performance.now() / 1000;
      if (d.moved > TAP.move || t - d.t0 > TAP.time) return;
      const i = nearestString(d.x0, d.y0);
      if (i >= 0) pluck(i, TAP_VELOCITY, "pointer", d.y0);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.repeat ||
        !harp.entered ||
        // (a dock button keeps the keys: only typing fields take them)
        !!(e.target as HTMLElement | null)?.closest?.("input, textarea, select")
      )
        return;
      const i = keyString(e.code, e.shiftKey);
      if (i !== null) {
        e.preventDefault();
        pluck(i, KEY_VELOCITY, "keys");
      } else if (e.code === "Space") {
        e.preventDefault();
        sweep("keys", SWEEP_VELOCITY);
      } else if (e.code === "Escape") {
        e.preventDefault();
        damp("keys");
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      canvas.style.touchAction = touchWas;
      canvas.style.cursor = cursorWas;
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [camera, gl]);

  return null;
};
