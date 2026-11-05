// The ghost pluck hand (gold): its index finger reaches into the strings
// from your side of the harp. It follows the pointer over the strings, its
// index tip where the pointer is, and points while you play; played by the
// keys, it moves to each string as it sounds (a glissando sweeps it along
// the strings). Left alone it rests between E4 and F4 and slowly opens; a
// damp shows a fist. It never moves the harp: only the camera changes.
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Quaternion, Vector3, type Object3D } from "three";

import { dressGhost, ghostMaterial } from "./ghost";
import { rig } from "./Harp";
import { HAND_REST, HAND_TURN } from "./layout";
import { MODELS, useOptionalModel } from "./models";
import { pointer } from "./PointerInput";
import { harp, plucksSince } from "./state";
import { spanAt, STRINGS } from "./strings";

/** The hand's poses: pointing (plays), open (resting), a fist (damp). */
const POSES = ["PluckHand_Point", "PluckHand_Open", "PluckHand_Fist"] as const;
type Pose = (typeof POSES)[number];

/** The index tip in the hand's own frame, if the model doesn't say (m). */
const INDEX_TIP = new Vector3(-0.0237, 0.1695, -0.0473);
/**
 * Following: how fast the tip reaches the pointer and a key's string (1/s),
 * how long a pointer or a key keeps the hand (s), and how far the tip sits
 * from the strings' plane (m: + your side; in the strings while playing).
 */
const FOLLOW = {
  pointer: 32,
  keys: 22,
  back: 4,
  hold: 0.9,
  hover: 0.01,
  play: -0.006,
};
/**
 * Near the soundboard the hand tips its wrist up towards you about the
 * index tip (by up to `pitch` degrees), so its palm never sinks into the
 * soundbox: fully when the tip is `near` (m) above the strings' bottoms,
 * not at all from `far`.
 */
const BOARD = { pitch: 50, near: 0.05, far: 0.2 };
/** After a damp the fist shows this long; after this long idle the hand opens (s). */
const FIST_HOLD = 0.5;
const OPEN_AFTER = 1.6;

/** The hand's root, its own placement cleared (the holder places it). */
const rootOf = (src: Object3D) => {
  const r = src.clone(true);
  r.position.set(0, 0, 0);
  r.quaternion.identity();
  r.scale.set(1, 1, 1);
  return r;
};

/** Where the ghost hand's index tip is now (the harp's frame, read by the development checks). */
export const ghostTip = new Vector3().copy(HAND_REST);

export const GhostHand = () => {
  const src = useOptionalModel(MODELS.ghostPluck);

  const hand = useMemo(() => {
    if (!src) return null;
    const holder = new Group();
    const root = rootOf(src.getObjectByName("GhostHand_Pluck") ?? src);
    const tipNode = root.getObjectByName("Index_Tip");
    const tip = tipNode ? tipNode.position.clone() : INDEX_TIP.clone();
    dressGhost(root, ghostMaterial());
    holder.add(root);
    const poses = Object.fromEntries(
      POSES.map((n) => [n, root.getObjectByName(n) ?? null]),
    ) as Record<Pose, Object3D | null>;
    return { holder, poses, tip };
  }, [src]);

  const st = useRef({ seq: harp.seq, keyAt: -1e9, keyX: 0, keyY: 0 });
  const want = useMemo(() => new Vector3(), []);
  const tmp = useMemo(
    () => ({
      q: new Quaternion(),
      axis: new Vector3(1, 0, 0),
      v: new Vector3(),
      k: 0,
    }),
    [],
  );

  useFrame((_, rawDt) => {
    if (!hand) return;
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    const now = performance.now() / 1000;
    // Keys (and the hands later): the hand goes to each string as it sounds.
    plucksSince(s.seq).some((e) => {
      if (e.at > now) return true;
      s.seq = e.seq;
      if (e.by !== "pointer") {
        s.keyAt = e.at;
        s.keyX = STRINGS[e.string].x;
        s.keyY = e.y;
      }
      return false;
    });
    let rate = FOLLOW.back;
    const usePointer = pointer.over && now - pointer.at < FOLLOW.hold;
    if (usePointer && pointer.at >= s.keyAt) {
      want.set(pointer.x, pointer.y, pointer.down ? FOLLOW.play : FOLLOW.hover);
      rate = FOLLOW.pointer;
    } else if (now - s.keyAt < FOLLOW.hold) {
      want.set(s.keyX, s.keyY, FOLLOW.play);
      rate = FOLLOW.keys;
    } else want.copy(HAND_REST);
    ghostTip.lerp(want, 1 - Math.exp(-rate * dt));
    // Tipped up near the soundboard (eased, so it never snaps).
    const gap = ghostTip.y - spanAt(ghostTip.x).bottom;
    const k = Math.min(
      1,
      Math.max(0, (BOARD.far - gap) / (BOARD.far - BOARD.near)),
    );
    tmp.k += (k - tmp.k) * (1 - Math.exp(-12 * dt));
    tmp.q.setFromAxisAngle(tmp.axis, (-BOARD.pitch * Math.PI * tmp.k) / 180);
    hand.holder.quaternion.copy(tmp.q).multiply(HAND_TURN);
    tmp.v.copy(hand.tip).applyQuaternion(hand.holder.quaternion);
    hand.holder.position.copy(ghostTip).sub(tmp.v);

    let pose: Pose = "PluckHand_Point";
    const lastPlay = Math.max(harp.playedAt, pointer.at);
    if (now - harp.dampedAt < FIST_HOLD) pose = "PluckHand_Fist";
    else if (!pointer.down && now - lastPlay > OPEN_AFTER)
      pose = "PluckHand_Open";
    POSES.forEach((p) => {
      const o = hand.poses[p];
      if (o) o.visible = p === pose;
    });
  });

  // The hand goes onto the harp once it is on screen.
  useLayoutEffect(() => {
    if (!hand) return undefined;
    rig.harp.add(hand.holder);
    return () => {
      rig.harp.remove(hand.holder);
    };
  }, [hand]);

  return null;
};
