// Harp: a concert harp in a recording studio, played with your hands (step
// 2) or, for now, a mouse, a finger or the keys. A fingertip crossing a
// string plucks it; sweeping across many plays a glissando, louder the
// faster you go. A gold ghost hand plays with you. Your camera sits small
// in the corner.
//
//   CameraRig.tsx     the views (front, player, close), fitted to the screen (layout.ts)
//   Studio.tsx        the room and its light, day and night; the LEDs (led.ts)
//   Harp.tsx          the harp and its glowing, ringing strings
//   GhostHand.tsx     the ghost pluck hand (ghost.ts)
//   PointerInput.tsx  dragging across the strings, tapping them, and the keys
//   CameraFrame.tsx   your camera in the corner
//   Hud.tsx           the bottom dock, the note strip (NoteStrip.tsx), how to play
//   audio.ts          the sound engine: the recorded harp (sampler.ts) or the
//                     voice made in code (synth.ts)
//   strings.ts        the strings, and how a crossing plucks them
//   Home.tsx          the home page (Start), shown over the scene while it loads
import { Suspense, useEffect } from "react";

import { CameraFrame } from "./CameraFrame";
import { CameraRig } from "./CameraRig";
import { GhostHand } from "./GhostHand";
import { Harp } from "./Harp";
import { Hud } from "./Hud";
import { PointerInput } from "./PointerInput";
import { harp, useHarpVersion } from "./state";
import { Studio } from "./Studio";

/** Mounts once everything above it has loaded (the home page waits for it). */
const Loaded = () => {
  useEffect(() => {
    harp.loaded = true;
    harp.changed();
  }, []);
  return null;
};

export const HarpScene = () => {
  useHarpVersion();
  return (
    <>
      <CameraRig />
      <Suspense fallback={null}>
        <Studio />
        <Harp />
        <GhostHand />
        <Loaded />
      </Suspense>
      <CameraFrame />
      <PointerInput />
      <Hud />
    </>
  );
};
