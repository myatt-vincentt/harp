// The harp, standing still in the middle of the studio (only the camera
// moves between views). Its strings: every C red, every F blue, the rest
// gut, each glowing faintly in its own colour. A plucked string:
//   - glows gold with a soft halo, fading as its note dies away
//   - vibrates: still at both ends, widest in the middle, longer strings
//     swinging wider and slower; a damp stops them all at once
//   - a small spark shows where the fingertip crossed it
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  Matrix3,
  Mesh,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  type BufferAttribute,
  type MeshStandardMaterial,
  type Object3D,
} from "three";

import { HARP } from "./layout";
import { dressModel } from "./look";
import { MODELS, useOptionalModel } from "./models";
import { harp, plucksSince } from "./state";
import { STRINGS, stringName } from "./strings";
import { ringTime } from "./synth";

/** Everything the ghost hand and the pointer follow. */
export const rig = {
  /** The harp (placed once); its children are in the harp's own frame. */
  harp: new Group(),
};
rig.harp.position.copy(HARP.pos);
rig.harp.quaternion.copy(HARP.quat);

/** A played string's glow and its halos (linear colours, as in the mockup). */
const PLAYED = {
  emissive: new Color(1.0, 0.36, 0.0).multiplyScalar(2.2),
  inner: new Color(1.0, 0.5, 0.06),
  outer: new Color(1.0, 0.4, 0.02),
  /** The halos' strength, and how far they reach out round the string (m). */
  innerStrength: 0.9,
  outerStrength: 0.32,
  innerWidth: 0.0022,
  outerWidth: 0.0065,
  /** The glow fades with this time constant (s; the note rings longer). */
  fade: 0.9,
};
/**
 * A plucked string's vibration: how far it swings at full strength (m, plus
 * a share of its length), how fast it seems to shake (Hz: as seen at the
 * screen's frame rate, low strings slower), and how fast a damp stops it (s).
 */
const SHAKE = {
  reach: 0.0012,
  perLength: 0.0035,
  hzLow: 17,
  hzHigh: 38,
  damp: 0.05,
};
/** The spark: its colour, size (m, from … to) and life (s). */
const SPARK = {
  color: new Color(1.0, 0.7, 0.25),
  from: 0.016,
  to: 0.05,
  life: 0.32,
};
const SPARKS = 8;

/** A soft round glow (for the sparks). */
const glowTexture = () => {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
};

/** A halo shell round a string: its own shape puffed out, adding light, softer at its edges. */
const haloMaterial = (width: number) =>
  new ShaderMaterial({
    uniforms: {
      color: { value: new Color(0, 0, 0) },
      width: { value: width },
    },
    vertexShader: /* glsl */ `
      uniform float width;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec3 p = position + normalize(normal) * width;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float k = abs(dot(normalize(vNormal), normalize(vView)));
        gl_FragColor = vec4(color * k * k, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });

/** One string: its material, halos, resting shape and how it vibrates. */
type Str = {
  m: MeshStandardMaterial;
  rest: Color;
  halos: Array<{
    mesh: Mesh;
    mat: ShaderMaterial;
    color: Color;
    strength: number;
  }>;
  pos: BufferAttribute;
  restPos: Float32Array;
  /** How far each vertex swings: 0 at both ends, 1 midway. */
  shape: Float32Array;
  /** The swing's directions in the mesh's own units: across the strings (x), and out of their plane (z). */
  across: Vector3;
  out: Vector3;
  reach: number;
  hz: number;
  ring: number;
  /** The latest pluck: when (s), how hard; and when it was damped. */
  at: number;
  amp: number;
  dampedAt: number;
  still: boolean;
};

const makeString = (empty: Object3D, i: number): Str | null => {
  const mesh = empty.children.find((c) => (c as Mesh).isMesh) as
    | Mesh
    | undefined;
  if (!mesh) return null;
  const s = STRINGS[i];
  const length = s.top - s.bottom;
  const m = (mesh.material as MeshStandardMaterial).clone();
  mesh.material = m;
  // Its own copy of the shape (it is moved every frame while it rings).
  mesh.geometry = mesh.geometry.clone();
  const pos = mesh.geometry.attributes.position as BufferAttribute;
  const restPos = new Float32Array(pos.array as ArrayLike<number>);
  // Each vertex's height in the string's own frame (the empty: y up from
  // the tie point), so how far it swings.
  mesh.updateMatrix();
  const p = new Vector3();
  const shape = new Float32Array(pos.count);
  for (let v = 0; v < pos.count; v += 1) {
    p.fromArray(restPos, v * 3).applyMatrix4(mesh.matrix);
    const u = p.y / length;
    shape[v] = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
  }
  // The string frame's x and z, in the mesh's own units.
  const toMesh = new Matrix3().setFromMatrix4(mesh.matrix).invert();
  const across = new Vector3(1, 0, 0).applyMatrix3(toMesh);
  const out = new Vector3(0, 0, 1).applyMatrix3(toMesh);
  const unit = across.length();
  const halos = [
    {
      w: PLAYED.innerWidth,
      color: PLAYED.inner,
      strength: PLAYED.innerStrength,
    },
    {
      w: PLAYED.outerWidth,
      color: PLAYED.outer,
      strength: PLAYED.outerStrength,
    },
  ].map((h, k) => {
    const mat = haloMaterial(h.w * unit);
    const hm = new Mesh(mesh.geometry, mat);
    hm.position.copy(mesh.position);
    hm.quaternion.copy(mesh.quaternion);
    hm.scale.copy(mesh.scale);
    hm.renderOrder = 3 + k;
    hm.visible = false;
    hm.castShadow = false;
    hm.receiveShadow = false;
    empty.add(hm);
    return { mesh: hm, mat, color: h.color, strength: h.strength };
  });
  const t = i / (STRINGS.length - 1);
  return {
    m,
    rest: m.emissive.clone(),
    halos,
    pos,
    restPos,
    shape,
    across,
    out,
    reach: SHAKE.reach + SHAKE.perLength * length,
    hz: SHAKE.hzLow + (SHAKE.hzHigh - SHAKE.hzLow) * t,
    ring: ringTime(s.midi) / 4,
    at: -1e9,
    amp: 0,
    dampedAt: -1e9,
    still: true,
  };
};

type Spark = { sprite: Sprite; mat: SpriteMaterial; at: number };

export const Harp = () => {
  const model = useOptionalModel(MODELS.harp);
  const parts = useMemo(() => {
    const src = model?.getObjectByName("Harp") ?? null;
    if (!src) return null;
    const body = src.clone(true);
    body.position.set(0, 0, 0);
    body.quaternion.identity();
    body.scale.set(1, 1, 1);
    dressModel(body);
    const strings = STRINGS.map((_, i) => {
      const empty = body.getObjectByName(stringName(i));
      return empty ? makeString(empty, i) : null;
    });
    const map = glowTexture();
    const sparks: Spark[] = Array.from({ length: SPARKS }, () => {
      const mat = new SpriteMaterial({
        map,
        color: SPARK.color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      });
      const sprite = new Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 7;
      body.add(sprite);
      return { sprite, mat, at: -1e9 };
    });
    return { body, strings, sparks };
  }, [model]);

  const seen = useRef(harp.seq);
  const next = useRef(0);
  const tmp = useMemo(() => new Color(), []);

  useFrame(() => {
    if (!parts) return;
    const now = performance.now() / 1000;
    /* eslint-disable no-param-reassign */
    // New plucks set their strings ringing (each at its moment) and spark
    // where they were plucked.
    plucksSince(seen.current).forEach((e) => {
      seen.current = e.seq;
      const st = parts.strings[e.string];
      if (st) {
        st.at = e.at;
        st.amp = 0.35 + 0.65 * e.velocity;
        st.dampedAt = -1e9;
      }
      const sp = parts.sparks[next.current];
      next.current = (next.current + 1) % parts.sparks.length;
      sp.at = e.at;
      sp.sprite.position.set(STRINGS[e.string].x, e.y, 0.004);
    });
    if (harp.dampedAt > 0)
      parts.strings.forEach((st) => {
        if (st && st.at < harp.dampedAt && st.dampedAt < harp.dampedAt)
          st.dampedAt = harp.dampedAt;
      });

    parts.strings.forEach((st) => {
      if (!st) return;
      const t = now - st.at;
      let ring = 0;
      let glow = 0;
      if (t >= 0) {
        ring = st.amp * Math.exp(-t / st.ring);
        glow = st.amp * Math.exp(-t / PLAYED.fade);
        if (st.dampedAt > st.at) {
          const k = Math.exp(-Math.max(0, now - st.dampedAt) / SHAKE.damp);
          ring *= k;
          glow *= k;
        }
      }
      // Its glow: its own colour at rest, gold while it rings.
      const g = Math.min(1, glow);
      st.m.emissive.copy(st.rest).lerp(PLAYED.emissive, g);
      st.halos.forEach((h) => {
        h.mesh.visible = g > 0.01;
        (h.mat.uniforms.color.value as Color).copy(
          tmp.copy(h.color).multiplyScalar(h.strength * g),
        );
      });
      // Its vibration, mostly across the strings and a little out of their plane.
      const a = st.reach * ring;
      if (a < 2e-5) {
        if (!st.still) {
          (st.pos.array as Float32Array).set(st.restPos);
          st.pos.needsUpdate = true;
          st.still = true;
        }
        return;
      }
      st.still = false;
      const w = 2 * Math.PI * st.hz * now;
      const x = a * Math.sin(w);
      const z = a * 0.3 * Math.cos(w * 1.07);
      const arr = st.pos.array as Float32Array;
      for (let v = 0; v < st.pos.count; v += 1) {
        const k = st.shape[v];
        const j = v * 3;
        arr[j] = st.restPos[j] + (st.across.x * x + st.out.x * z) * k;
        arr[j + 1] = st.restPos[j + 1] + (st.across.y * x + st.out.y * z) * k;
        arr[j + 2] = st.restPos[j + 2] + (st.across.z * x + st.out.z * z) * k;
      }
      st.pos.needsUpdate = true;
    });

    // The sparks flare and fade.
    parts.sparks.forEach((sp) => {
      const k = (now - sp.at) / SPARK.life;
      const on = k >= 0 && k < 1;
      sp.sprite.visible = on;
      if (!on) return;
      const e = 1 - (1 - k) ** 3;
      const size = SPARK.from + (SPARK.to - SPARK.from) * e;
      sp.sprite.scale.set(size, size, size);
      sp.mat.opacity = (1 - k) ** 2;
    });
    /* eslint-enable no-param-reassign */
  });

  // The harp goes into its holder once it is on screen (a render that is
  // thrown away while something else loads leaves none behind).
  useLayoutEffect(() => {
    if (!parts) return undefined;
    rig.harp.add(parts.body);
    return () => {
      rig.harp.remove(parts.body);
    };
  }, [parts]);

  return <primitive object={rig.harp} />;
};
