// The screen layout: where the harp stands, where each view's camera looks
// from and how much it shows, and where the corner camera sits.
//
// Coordinates are the room's (metres, y up). The harp stands still in the
// middle of the studio in every view; only the camera changes:
//   front   three-quarter front, the column nearer the camera (the default)
//   player  from the seated player's eyes behind the soundbox, looking
//           through the strings towards the column
//   close   the strings where you play, the column and the neck around them
import { Quaternion, Vector3 } from "three";

export type View = "front" | "player" | "close";
export const VIEWS: View[] = ["front", "player", "close"];

/** Screen shape → 0 (laptop, wide) … 1 (phone, tall). */
export const phoneness = (aspect: number) =>
  Math.min(1, Math.max(0, (1.5 - aspect) / (1.5 - 0.56)));

export type CameraPose = {
  pos: Vector3;
  target: Vector3;
  /** Vertical field of view (degrees). */
  fov: number;
};

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
/** The vertical field of view that gives this horizontal one. */
export const vfovFromH = (hfov: number, aspect: number) =>
  deg(2 * Math.atan(Math.tan(rad(hfov) / 2) / Math.max(0.1, aspect)));
/** The horizontal field of view of this vertical one. */
export const hfovFromV = (vfov: number, aspect: number) =>
  deg(2 * Math.atan(Math.tan(rad(vfov) / 2) * aspect));

// ---------------------------------------------------------------- the harp

export type Placement = { pos: Vector3; quat: Quaternion };

/**
 * Where the harp stands (its own frame: the strings in its x-y plane, +z
 * towards the viewer's side): turned 17° so the column comes towards Front.
 */
export const HARP: Placement = {
  pos: new Vector3(-0.4782, 0, -0.1538),
  quat: new Quaternion(0, 0.14781, 0, 0.98902).normalize(),
};

/** The ghost hand's turn on the strings (the harp's frame): index into the strings from the viewer's side. */
export const HAND_TURN = new Quaternion(
  -0.15473,
  0.88007,
  -0.43758,
  0.10029,
).normalize();

/** The ghost hand's index tip at rest (the harp's frame, m): between E4 and F4. */
export const HAND_REST = new Vector3(0.5114, 0.7769, -0.012);

// ---------------------------------------------------------------- the views

// Each view's camera: on a laptop (16:9) the vertical field of view, on a
// phone (9:16) the horizontal one it gives.
const P = 9 / 16;
const VIEW_POSES = {
  front: {
    laptop: { pos: [0.3, 0.95, 2.4], target: [0.05, 0.8, -0.3], vfov: 35.12 },
    phone: {
      pos: [0.22, 0.9, 1.7],
      target: [0.05, 0.8, -0.3],
      hfov: hfovFromV(67.38, P),
    },
  },
  player: {
    laptop: {
      pos: [0.6669, 1.38, 0.1026],
      target: [-0.1339, 0.8, -0.2591],
      vfov: 49.43,
    },
    phone: {
      pos: [0.6977, 1.36, 0.135],
      target: [-0.0383, 0.8, -0.2883],
      hfov: hfovFromV(65.47, P),
    },
  },
  close: {
    laptop: {
      pos: [0.0344, 0.9369, 0.526],
      target: [-0.1421, 0.8569, -0.2566],
      vfov: 44.1,
    },
    phone: {
      pos: [0.0801, 0.9569, 0.4702],
      target: [-0.1038, 0.8969, -0.2683],
      hfov: hfovFromV(78.58, P),
    },
  },
};

/* eslint-disable no-param-reassign */
/** A view's camera for this screen shape (before the fit). */
export const viewPose = (view: View, aspect: number, out: CameraPose) => {
  const v = VIEW_POSES[view];
  const k = phoneness(aspect);
  const [lx, ly, lz] = v.laptop.pos;
  const [px, py, pz] = v.phone.pos;
  out.pos.set(lx + (px - lx) * k, ly + (py - ly) * k, lz + (pz - lz) * k);
  const [ltx, lty, ltz] = v.laptop.target;
  const [ptx, pty, ptz] = v.phone.target;
  out.target.set(
    ltx + (ptx - ltx) * k,
    lty + (pty - lty) * k,
    ltz + (ptz - ltz) * k,
  );
  const phoneV = vfovFromH(v.phone.hfov, aspect);
  out.fov = v.laptop.vfov + (phoneV - v.laptop.vfov) * k;
  return out;
};
/* eslint-enable no-param-reassign */

/** A point on the harp (its own frame) in the room. */
export const onHarp = (x: number, y: number, z: number) =>
  new Vector3(x, y, z).applyQuaternion(HARP.quat).add(HARP.pos);

/**
 * The points a view keeps on screen. Front: the whole harp (its base, the
 * crown, the soundbox top). Player and Close: the strings where you play;
 * the rest may run off, as when you sit at a harp.
 */
export const keepPoints = (view: View): Vector3[] => {
  if (view === "close")
    return [onHarp(0.44, 0.7, 0), onHarp(0.6, 0.7, 0), onHarp(0.5, 0.95, 0)];
  if (view === "player")
    return [onHarp(0.36, 0.62, 0), onHarp(0.7, 0.9, 0), onHarp(0.5, 1.0, 0)];
  return [
    onHarp(0.04, 0.02, 0),
    onHarp(0.95, 0.02, 0),
    onHarp(0.09, 1.57, 0),
    onHarp(0.9, 1.2, 0),
  ];
};

// ---------------------------------------------------------------- page UI

/** The page gutter (CSS px). */
export const GUTTER = 16;
/** The corner camera's corner radius (CSS px). */
export const FRAME_RADIUS = 16;
/** The dock's distance from the bottom edge, and its height (CSS px). */
export const DOCK_BOTTOM = 22;
export const DOCK_HEIGHT = 58;
/** The note strip sits this far above the dock, and is this tall (CSS px). */
export const STRIP_GAP = 10;
export const STRIP_HEIGHT = 36;

/** Where the corner camera sits (CSS px): top right. */
export const frameRect = (width: number, height: number) => {
  // Portrait-ish on a phone, landscape-ish on a laptop, never extreme.
  const aspect = Math.min(1.33, Math.max(0.75, width / Math.max(1, height)));
  const h = Math.min(220, Math.max(110, height * 0.24));
  const w = Math.round(h * aspect);
  return {
    left: width - GUTTER - w,
    top: GUTTER,
    width: w,
    height: Math.round(h),
  };
};

/**
 * The screen's edges the view keeps clear (NDC, 1 = the edge): the top, and
 * under the corner camera right of its left edge (`frameLeft`); the dock and
 * the note strip below.
 */
export const viewMargins = (width: number, height: number) => {
  const h = Math.max(1, height);
  const w = Math.max(1, width);
  const frame = frameRect(width, height);
  const bottomPx = DOCK_BOTTOM + DOCK_HEIGHT + STRIP_GAP + STRIP_HEIGHT + 12;
  return {
    side: 0.96,
    top: 1 - (2 * 24) / h,
    under: Math.max(0.2, 1 - (2 * (frame.top + frame.height + 12)) / h),
    frameLeft: (2 * (frame.left - 8)) / w - 1,
    bottom: Math.max(0.3, 1 - (2 * bottomPx) / h),
  };
};

/**
 * For drei's `<Html fullscreen>`: pin the page UI to the screen. By default
 * it follows the scene's origin, which moves on screen with the camera.
 */
export const pinToScreen = (
  _el: unknown,
  _camera: unknown,
  size: { width: number; height: number },
) => [size.width / 2, size.height / 2];
