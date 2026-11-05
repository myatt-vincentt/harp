// Development only: window.__harp, a look inside for testing without a
// camera — the state, the sound meter, and controls:
//
//   __harp.pluck("C4", 0.8)        pluck a string (by note or index), 0 soft … 1 hard
//   __harp.sweep()                 a C-major glissando (sweep(true): every string)
//   __harp.damp()                  stop the strings
//   __harp.view("player"), __harp.night(true)
//   __harp.look([x, y, z], [tx, ty, tz], fov)   a fixed camera (null: back)
//   __harp.useRecordings(false)    the voice made in code
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import { meter, samples, sound } from "./audio";
import { cameraOverride } from "./CameraRig";
import { ghostTip } from "./GhostHand";
import { rig } from "./Harp";
import type { View } from "./layout";
import { pointer } from "./PointerInput";
import { damp, harp, pluck, setNight, setView, sweep } from "./state";
import { stringOf } from "./strings";

const DevDebug = () => {
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
