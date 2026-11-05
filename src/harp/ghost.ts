// The ghost hand's look: harp gold, a little metallic so it catches the
// studio's light like the harp's own gilding, a little see-through, lit
// softly from within, with a warm glowing rim where the surface turns away
// from you. (The harp's gold is its own: more metal and less self-glow than
// the other instruments' ghost hands, so it reads as gold, not as light.)
import {
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Mesh,
  type Object3D,
} from "three";

/** The harp's ghost gold. */
export const GOLD = {
  base: "#F2B21C",
  rim: "#FFB000",
  opacity: 0.9,
  metalness: 0.55,
  roughness: 0.35,
  /** Self-glow: the base colour times this. */
  emissive: 0.28,
  /** The rim's strength. */
  rimStrength: 0.9,
};

export const ghostMaterial = () => {
  const c = new Color(GOLD.base);
  const m = new MeshStandardMaterial({
    color: c,
    metalness: GOLD.metalness,
    roughness: GOLD.roughness,
    transparent: true,
    opacity: GOLD.opacity,
    depthWrite: false,
    emissive: c.clone().multiplyScalar(GOLD.emissive),
    side: DoubleSide,
  });
  const rim = new Color(GOLD.rim).multiplyScalar(GOLD.rimStrength);
  m.onBeforeCompile = (shader) => {
    // eslint-disable-next-line no-param-reassign
    shader.uniforms.uRim = { value: rim };
    // eslint-disable-next-line no-param-reassign
    shader.fragmentShader = `uniform vec3 uRim;\n${shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float ghostRim = 1.0 - abs(dot(normal, normalize(vViewPosition)));
      totalEmissiveRadiance += uRim * pow(ghostRim, 2.6);`,
    )}`;
  };
  m.customProgramCacheKey = () => "harp-ghost";
  return m;
};

const depthOnly = new MeshBasicMaterial({
  colorWrite: false,
  side: DoubleSide,
});

/**
 * Dresses the hand's poses in the ghost look. A depth-only copy drawn first
 * means only the hand's outer surface shows (no overlapping insides).
 */
export const dressGhost = (root: Object3D, look: MeshStandardMaterial) => {
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh) meshes.push(o as Mesh);
  });
  meshes.forEach((mesh) => {
    const depth = mesh.clone();
    depth.material = depthOnly;
    depth.renderOrder = 4;
    mesh.add(depth);
    depth.position.set(0, 0, 0);
    depth.quaternion.identity();
    depth.scale.set(1, 1, 1);
    /* eslint-disable no-param-reassign */
    mesh.material = look;
    mesh.renderOrder = 5;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    /* eslint-enable no-param-reassign */
  });
};
