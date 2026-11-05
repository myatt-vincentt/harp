// The studio's LED strips flash in colour when you play: the colour is the
// string's (a C red, an F blue, the gut strings warm amber, as the harp's
// own strings are coloured). A pluck lights it at once (as hard as it was
// played) and it eases away over about half a second. Plucks close together
// (a glissando) mix their colours, and while you keep playing the colours slowly sway a
// little either side so it never sits still. Plain code (no scene).
import { Color } from "three";

import { STRINGS } from "./strings";

/** A string's LED colour (a hue, 0..1): C red, F blue, gut amber. */
export const HUE = { c: 0.995, f: 0.62, gut: 0.085 };
export const stringHue = (i: number) => HUE[STRINGS[i]?.kind ?? "gut"];

/** A flash fades with this time constant (s): about 5% is left after 0.5 s. */
export const LED_DECAY = 0.17;
/** While you play the colours sway this far either side (hue turns)… */
export const LED_SWAY = 0.06;
/** …once every this long (s of playing). */
export const LED_SWAY_PERIOD = 40;
/** No channel holds more than this (a fast glissando stays a colour). */
const CAP = 1.5;

export class LedFlash {
  /** The flash's light (linear RGB; 0 when dark). */
  readonly color = new Color(0, 0, 0);

  /** How lit the strips are by the flash, 0..1. */
  amount = 0;

  /** The colours' sway now (hue turns, ± LED_SWAY). */
  drift = 0;

  private phase = 0;

  private readonly c = new Color();

  /** Played in this colour (a hue, 0..1), `velocity` 0..1. */
  hit(hue: number, velocity: number) {
    const v = Math.min(1, Math.max(0.15, velocity)) ** 0.8;
    this.c.setHSL((hue + this.drift + 1) % 1, 1, 0.5);
    this.color.r = Math.min(CAP, this.color.r + this.c.r * v);
    this.color.g = Math.min(CAP, this.color.g + this.c.g * v);
    this.color.b = Math.min(CAP, this.color.b + this.c.b * v);
    this.amount = Math.min(
      1,
      Math.max(this.color.r, this.color.g, this.color.b),
    );
  }

  /** Moves the flash on by `dt` (s). */
  update(dt: number) {
    this.color.multiplyScalar(Math.exp(-dt / LED_DECAY));
    if (Math.max(this.color.r, this.color.g, this.color.b) > 0.05) {
      this.phase += (dt * 2 * Math.PI) / LED_SWAY_PERIOD;
      this.drift = LED_SWAY * Math.sin(this.phase);
    }
    this.amount = Math.min(
      1,
      Math.max(this.color.r, this.color.g, this.color.b),
    );
  }
}
