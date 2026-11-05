// Development only: window.__harp, a look inside for testing without a
// camera — the state, the sound meter, and controls:
//
//   __harp.pluck("C4", 0.8)        pluck a string (by note or index), 0 soft … 1 hard
//   __harp.sweep()                 a C-major glissando (sweep(true): every string)
//   __harp.damp()                  stop the strings
//   __harp.view("player"), __harp.night(true), __harp.fingers("all")
//   __harp.look([x, y, z], [tx, ty, tz], fov)   a fixed camera (null: back)
//   __harp.useRecordings(false)    the voice made in code
//
// With ?debug in the address, a small readout in the top-left corner shows
// both hands, their tips on the air strings and the sound (to see what a
// webcam does).
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import { meter, samples, sound } from "./audio";
import { cameraOverride } from "./CameraRig";
import { ghostTip } from "./GhostHand";
import { air, hands, indexSeen, SIDES } from "./Hands";
import { rig } from "./Harp";
import type { View } from "./layout";
import { pointer } from "./PointerInput";
import {
  damp,
  harp,
  pluck,
  setFingers,
  setNight,
  setView,
  sweep,
} from "./state";
import type { Fingers } from "./air";
import { stringOf, STRINGS } from "./strings";

/** The ?debug readout: a plain text box, refreshed a few times a second. */
const useReadout = () => {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug"))
      return undefined;
    const box = document.createElement("pre");
    Object.assign(box.style, {
      position: "fixed",
      left: "8px",
      top: "60px",
      zIndex: "60",
      margin: "0",
      padding: "8px 10px",
      borderRadius: "10px",
      background: "rgb(0 0 0 / .7)",
      color: "#fff",
      font: "11px/1.4 ui-monospace, monospace",
      pointerEvents: "none",
    });
    document.body.appendChild(box);
    const yes = (b: boolean) => (b ? "yes" : "no");
    const t = window.setInterval(() => {
      const lines = SIDES.map((side) => {
        const seen = indexSeen(side);
        if (!hands.tracked[side] || !seen) return `${side} hand no`;
        const slot = Math.round(seen.slot);
        const k = air.flip ? STRINGS.length - 1 - slot : slot;
        const note = STRINGS[k]?.note ?? "-";
        return `${side} hand yes  tip x ${seen.x.toFixed(3)} y ${seen.y.toFixed(3)}  string ${slot} ${note}  band ${yes(seen.inBand)}  fist ${yes(hands.fist[side])}`;
      });
      const last = STRINGS[hands.lastString]?.note ?? "-";
      box.textContent = [
        ...lines,
        `fingers ${harp.fingers}  plucks ${hands.plucks}  damps ${hands.damps}  last ${last} (${hands.lastTip ?? "-"})  order ${air.flip ? "high left" : "low left"}`,
        `sound ${sound.unlocked ? "started" : "not started"} ${sound.voiceKind}  peak ${meter.peak.toFixed(2)}`,
      ].join("\n");
    }, 200);
    return () => {
      window.clearInterval(t);
      box.remove();
    };
  }, []);
};

const DevDebug = () => {
  useReadout();
  const camera = useThree((st) => st.camera);
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    const api = {
      harp,
      rig,
      camera,
      scene,
      meter,
      sound,
      samples,
      pointer,
      ghostTip,
      hands,
      air,
      /** The output's level and low end right now. */
      levels: () => ({ ...sound.last }),
      pluck: (s: string | number, velocity = 0.6) => {
        sound.unlock();
        pluck(typeof s === "number" ? s : stringOf(s), velocity, "keys");
      },
      sweep: (all = false, velocity = 0.6) => {
        sound.unlock();
        sweep("keys", velocity, all);
      },
      damp: () => damp("keys"),
      useRecordings: (on: boolean) => sound.useRecordings(on),
      view: (v: View) => setView(v),
      fingers: (f: Fingers) => setFingers(f),
      night: (on: boolean) => setNight(on),
      look(pos: number[] | null, target: number[] = [0, 0.8, -0.3], fov = 40) {
        cameraOverride.pose = pos
          ? { pos: new Vector3(...pos), target: new Vector3(...target), fov }
          : null;
      },
    };
    (window as unknown as { __harp?: typeof api }).__harp = api;
    return () => {
      delete (window as unknown as { __harp?: typeof api }).__harp;
    };
  }, [camera, scene]);
  return null;
};

export default DevDebug;
