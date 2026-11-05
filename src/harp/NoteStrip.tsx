// The note strip: the notes of the strings plucked lately, in a row of small
// glass chips just above the dock, oldest on the left. Each chip carries its
// string's colour (C red, F blue, the rest gut) and flashes gold as its
// string sounds, then settles. It shows what you just played, and is not a
// control.
import { useEffect, useRef } from "react";

import { harp, RECENT, useHarpVersion } from "./state";
import { STRINGS, type StringKind } from "./strings";

/** The strings' colours on the chips (as in the harp's strings). */
export const KIND_COLOR: Record<StringKind, string> = {
  c: "#E0392B",
  f: "#3557D6",
  gut: "#E9C489",
};
/** A chip's gold flash fades at this rate (1/s). */
const GLOW_RATE = 4;

export const STRIP_CSS = `
.vl-strip { position: absolute; left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + var(--vl-strip-bottom));
  display: flex; gap: 4px; pointer-events: none; height: 36px; align-items: center;
  animation: vl-fade 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.vl-note { position: relative; min-width: 38px; height: 32px; padding: 0 8px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; gap: 5px; overflow: hidden;
  font: 650 13px/1 system-ui, -apple-system, sans-serif; color: rgb(255 255 255 / .92);
  background: rgb(35 37 40 / .64); border: 1px solid rgb(235 246 253 / .18);
  backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5);
  box-shadow: inset 0 1px 1px rgb(255 255 255 / .22), 0 8px 24px rgb(0 0 0 / .22);
  animation: vl-note-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.vl-note-dot { position: relative; width: 6px; height: 6px; border-radius: 50%; flex: none; }
.vl-note-name { position: relative; }
.vl-note-glow { position: absolute; inset: 0; opacity: 0; pointer-events: none; background: #F2B21C; }
.vl-note.old { opacity: .55; }
.vl-strip-hint { font: 600 12px/1 system-ui, -apple-system, sans-serif; color: rgb(255 255 255 / .7);
  padding: 9px 12px; border-radius: 999px; background: rgb(35 37 40 / .5); }
@keyframes vl-note-in { from { opacity: 0; transform: translateY(4px) scale(.94); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .vl-note { animation: none; } }
`;

type ChipRef = { seq: number; el: HTMLSpanElement | null; k: number };

export const NoteStrip = () => {
  useHarpVersion();
  const chips = useRef(new Map<number, ChipRef>());

  // Each chip flashes gold when its string sounds (a glissando's in turn).
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const now = t / 1000;
      chips.current.forEach((c) => {
        /* eslint-disable no-param-reassign */
        const e = harp.events.find((ev) => ev.seq === c.seq);
        if (e && now >= e.at && now - e.at < 0.05 && c.k < 0.5) c.k = 0.75;
        else c.k *= Math.exp(-GLOW_RATE * dt);
        if (c.el) c.el.style.opacity = c.k.toFixed(3);
        /* eslint-enable no-param-reassign */
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const list = harp.recent;
  const keep = new Set(list.map((r) => r.seq));
  chips.current.forEach((_, seq) => {
    if (!keep.has(seq)) chips.current.delete(seq);
  });
  return (
    <div className="vl-strip" data-hud="strip" aria-label="Notes played">
      {list.length === 0 ? (
        <span className="vl-strip-hint">Drag across the strings</span>
      ) : null}
      {list.map((r, i) => {
        const s = STRINGS[r.string];
        let ref = chips.current.get(r.seq);
        if (!ref) {
          ref = { seq: r.seq, el: null, k: 0 };
          chips.current.set(r.seq, ref);
        }
        const chip = ref;
        const old = i < list.length - RECENT / 2;
        return (
          <span key={r.seq} className={`vl-note ${old ? "old" : ""}`}>
            <span
              className="vl-note-glow"
              ref={(el) => {
                chip.el = el;
              }}
            />
            <span
              className="vl-note-dot"
              style={{ background: KIND_COLOR[s.kind] }}
            />
            <span className="vl-note-name">{s.note}</span>
          </span>
        );
      })}
    </div>
  );
};
