// The songs' page UI, on Night glass like the rest:
//   - the songs card (from the dock's note button): each song with its best
//     stars, Learn and Play, and a Slower toggle for Play
//   - while a song runs, the note card top left: the step to play now (a
//     string's note, a rolled chord or a glissando) in its string's colour,
//     the next three, and the song's progress; in Play the count-in beats
//     first. A right step sparkles gold; a wrong string glows the card softly.
//   - at the end, the stars (Play) or a little celebration (Learn), with
//     Again and Next
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { DOCK_BOTTOM, DOCK_HEIGHT, frameRect, GUTTER } from "./layout";
import { KIND_COLOR } from "./NoteStrip";
import { bestStars, closeFinish, startSong } from "./SongPlayer";
import { nextSongId, SONGS, songById, stepName, type SongStep } from "./songs";
import { harp } from "./state";
import { STRINGS } from "./strings";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const ACCENT = "#f4d968";
/** The finish card stays up this long (ms). */
const FINISH_FOR = 6000;

/** What each kind of step is called on the note card. */
const KIND_NAME: Record<SongStep["kind"], string> = {
  note: "Pluck",
  roll: "Roll, low to high",
  gliss: "Glissando",
};
/** The next steps' short names (a note shows its own). */
const SHORT: Partial<Record<SongStep["kind"], string>> = {
  roll: "roll",
  gliss: "gliss",
};
/** A step's colour: its first string's. */
const stepColor = (x: SongStep) => KIND_COLOR[STRINGS[x.strings[0]].kind];

export const SONG_CSS = `
.vl-card { position: absolute; pointer-events: auto; border-radius: 18px; padding: 10px;
  display: flex; flex-direction: column; gap: 6px; animation: vl-in 260ms ${EASE} both; }
@keyframes vl-in { from { opacity: 0; transform: translate(-50%, 6px); } to { opacity: 1; transform: translate(-50%, 0); } }
.vl-row { display: flex; align-items: center; gap: 8px; }
.vl-row .vl-title { flex: 1; font: 600 14px/1.2 system-ui, -apple-system, sans-serif; padding-left: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vl-small { pointer-events: auto; border: 1px solid rgb(235 246 253 / .22); background: rgb(255 255 255 / .08);
  color: #fff; border-radius: 999px; height: 32px; padding: 0 12px; cursor: pointer; flex: none;
  font: 600 12px/1 system-ui, -apple-system, sans-serif; transition: transform 160ms ease-out; }
.vl-small:active { transform: scale(0.95); }
.vl-small:focus-visible { box-shadow: 0 0 0 2px ${ACCENT}; outline: none; }
.vl-small.play { background: ${ACCENT}; color: #232528; border-color: transparent; }
.vl-small.on { box-shadow: inset 0 0 0 1.5px ${ACCENT}; }
.vl-best { display: flex; gap: 1px; margin-right: 2px; flex: none; }
.vl-lane { position: absolute; left: ${GUTTER}px; top: ${GUTTER}px; width: 196px; pointer-events: none;
  border-radius: 20px; padding: 12px 14px 12px; display: flex; flex-direction: column; gap: 8px;
  animation: vl-fade 260ms ${EASE} both; transition: box-shadow 500ms ${EASE}; }
.vl-lane.hint { box-shadow: 0 0 0 2px rgb(92 176 255 / .75), 0 0 28px rgb(47 140 255 / .45); transition: none; }
.vl-lane-head { display: flex; align-items: center; gap: 12px; }
.vl-lane-pic { position: relative; width: 64px; height: 64px; border-radius: 16px; flex: none; display: grid; place-items: center;
  background: rgb(255 255 255 / .08); color: #fff; }
.vl-lane-pic svg { transition: transform 420ms ${EASE}; }
.vl-lane.hint .vl-lane-pic svg { transform: scale(1.12); transition: none; }
.vl-lane-name { font: 700 24px/1 system-ui, -apple-system, sans-serif; letter-spacing: -0.01em; }
.vl-lane-sign { margin-top: 4px; font: 600 13px/1.1 system-ui, -apple-system, sans-serif; color: rgb(255 255 255 / .72); }
.vl-lane-dot { width: 22px; height: 22px; border-radius: 50%; box-shadow: 0 0 14px currentColor; }
.vl-countin { font: 700 40px/1 system-ui, -apple-system, sans-serif; color: ${ACCENT}; width: 64px; text-align: center; }
.vl-upnext { display: flex; gap: 6px; align-items: center; color: rgb(255 255 255 / .55); }
.vl-upnext span { display: flex; flex-direction: column; align-items: center; gap: 1px;
  font: 600 11px/1 system-ui, -apple-system, sans-serif; }
.vl-bar { height: 4px; border-radius: 4px; background: rgb(255 255 255 / .14); overflow: hidden; }
.vl-bar > div { height: 100%; background: ${ACCENT}; transform-origin: 0 50%; transition: transform 200ms linear; }
.vl-spark { position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px; border-radius: 50%;
  background: ${ACCENT}; box-shadow: 0 0 8px ${ACCENT}; pointer-events: none; opacity: 0;
  animation: vl-spark 620ms ${EASE} both; }
@keyframes vl-spark { from { opacity: 1; transform: rotate(var(--a)) translateX(10px) scale(1); }
  to { opacity: 0; transform: rotate(var(--a)) translateX(var(--d)) scale(.4); } }
.vl-flash { position: absolute; inset: 0; border-radius: inherit; background: ${ACCENT}; pointer-events: none;
  animation: vl-flash 520ms ${EASE} both; }
@keyframes vl-flash { from { opacity: .55; } to { opacity: 0; } }
.vl-finish { position: absolute; left: 50%; transform: translateX(-50%); pointer-events: auto;
  display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-radius: 22px;
  animation: vl-pop 420ms ${EASE} both; }
@keyframes vl-pop { from { opacity: 0; transform: translate(-50%, 10px) scale(.92); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
.vl-finish .vl-sparks { position: absolute; left: 50%; top: 50%; pointer-events: none; }
.vl-icon { pointer-events: auto; width: 40px; height: 40px; border-radius: 50%; border: 0;
  background: rgb(255 255 255 / .1); color: #fff; display: grid; place-items: center; cursor: pointer;
  transition: transform 160ms ease-out; }
.vl-icon:active { transform: scale(0.94); }
.vl-icon:focus-visible { box-shadow: 0 0 0 2px ${ACCENT}; outline: none; }
@media (prefers-reduced-motion: reduce) { .vl-card, .vl-finish, .vl-lane, .vl-spark, .vl-flash { animation: none; } }
`;

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width={20}
    height={20}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);
export const NoteIcon = () => (
  <Icon>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </Icon>
);
export const StopIcon = () => (
  <Icon>
    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
  </Icon>
);
const AgainIcon = () => (
  <Icon>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4.5h4.5" />
  </Icon>
);
const NextIcon = () => (
  <Icon>
    <path d="M6 5.5l9 6.5-9 6.5z" fill="currentColor" />
    <path d="M18 5v14" />
  </Icon>
);
const STAR =
  "M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z";
const Star = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" width={34} height={34} aria-hidden="true">
    <path
      d={STAR}
      fill={on ? ACCENT : "rgb(255 255 255 / .18)"}
      stroke={on ? ACCENT : "rgb(255 255 255 / .45)"}
      strokeWidth={1.2}
      strokeLinejoin="round"
    />
  </svg>
);
const SmallStar = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" width={11} height={11} aria-hidden="true">
    <path d={STAR} fill={on ? ACCENT : "rgb(255 255 255 / .22)"} />
  </svg>
);

/** A burst of gold sparks (replayed when `seq` changes). */
const Sparks = ({
  seq,
  count = 10,
  reach = 46,
}: {
  seq: number;
  count?: number;
  reach?: number;
}) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <span
        key={`${seq}-${i}`}
        className="vl-spark"
        style={
          {
            "--a": `${(360 * i) / count + (seq % 2) * 18}deg`,
            "--d": `${reach * (0.75 + 0.25 * ((i * 7) % 3))}px`,
            animationDelay: `${(i % 3) * 30}ms`,
          } as CSSProperties
        }
      />
    ))}
  </>
);

/** Redraws the caller a few times a second while `on`. */
const useTicker = (on: boolean, ms = 100) => {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!on) return undefined;
    const t = window.setInterval(() => tick((n) => n + 1), ms);
    return () => window.clearInterval(t);
  }, [on, ms]);
};

/** The note card: the step to play now, while a song runs. */
const NoteCard = () => {
  const s = harp.session;
  useTicker(!!s);
  const [hint, setHint] = useState(false);
  const { hintSeq, goodSeq } = harp.fx;
  const firstHint = useRef(hintSeq);
  useEffect(() => {
    if (hintSeq === firstHint.current) return undefined;
    setHint(true);
    const t = window.setTimeout(() => setHint(false), 60);
    return () => window.clearTimeout(t);
  }, [hintSeq]);
  const firstGood = useRef(goodSeq);
  if (!s) return null;
  const now = performance.now() / 1000;
  const i = s.current(now);
  const step = i < s.song.steps.length ? s.song.steps[i] : null;
  const upNext = s.song.steps.slice(i + 1, i + 4);
  const countIn = s.mode === "play" ? Math.ceil(-s.beatAt(now)) : 0;
  const sparkled = goodSeq !== firstGood.current;
  return (
    <div
      className={`vl-lane vl-glass ${hint ? "hint" : ""}`}
      data-hud="note-card"
      role="status"
      aria-label={
        step ? `${KIND_NAME[step.kind]} ${stepName(step)}` : s.song.title
      }
    >
      <div className="vl-lane-head">
        {countIn > 0 ? (
          <span className="vl-countin">{countIn}</span>
        ) : (
          <span className="vl-lane-pic">
            {step ? (
              <span
                className="vl-lane-dot"
                style={{ background: stepColor(step), color: stepColor(step) }}
              />
            ) : null}
            {sparkled ? <span key={goodSeq} className="vl-flash" /> : null}
            {sparkled ? <Sparks seq={goodSeq} /> : null}
          </span>
        )}
        <div>
          <div className="vl-lane-name">{step ? stepName(step) : ""}</div>
          <div className="vl-lane-sign">
            {step ? KIND_NAME[step.kind] : s.song.title}
          </div>
        </div>
      </div>
      {upNext.length ? (
        <div className="vl-upnext" aria-hidden="true">
          {upNext.map((x, k) => (
            // eslint-disable-next-line react/no-array-index-key
            <span key={k}>
              <i
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: stepColor(x),
                }}
              />
              {SHORT[x.kind] ?? stepName(x)}
            </span>
          ))}
        </div>
      ) : null}
      <div className="vl-bar" aria-hidden="true">
        <div style={{ transform: `scaleX(${s.progress(now)})` }} />
      </div>
    </div>
  );
};

/** The songs card, the note card and the finish card. */
export const SongUI = ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => {
  const frame = frameRect(width, height);
  const tall = height > width;
  const fin = harp.finish;
  const finishedAt = fin?.at ?? null;
  const [, tick] = useState(0);
  useEffect(() => {
    if (finishedAt === null) return undefined;
    const t = window.setTimeout(() => {
      closeFinish();
      tick((n) => n + 1);
    }, FINISH_FOR);
    return () => window.clearTimeout(t);
  }, [finishedAt]);
  const best = harp.songCard ? bestStars() : {};
  const above = `calc(env(safe-area-inset-bottom, 0px) + ${DOCK_BOTTOM + DOCK_HEIGHT + 12}px)`;

  return (
    <>
      {harp.session ? <NoteCard /> : null}

      {harp.songCard && !harp.session ? (
        <div
          className="vl-card vl-glass"
          data-hud="song-card"
          role="dialog"
          aria-label="Songs"
          style={{
            left: "50%",
            transform: "translateX(-50%)",
            ...(tall
              ? {
                  top: frame.top + frame.height + 12,
                  width: "calc(100% - 32px)",
                  maxWidth: 380,
                }
              : { bottom: above, minWidth: 340 }),
          }}
        >
          {SONGS.map((c) => (
            <div className="vl-row" key={c.id}>
              <span className="vl-title">{c.title}</span>
              <span
                className="vl-best"
                aria-label={`Best: ${best[c.id] ?? 0} of 3 stars`}
              >
                {[1, 2, 3].map((k) => (
                  <SmallStar key={k} on={k <= (best[c.id] ?? 0)} />
                ))}
              </span>
              <button
                type="button"
                className="vl-small"
                data-hud={`learn-${c.id}`}
                onClick={() => startSong(c.id, "learn")}
              >
                Learn
              </button>
              <button
                type="button"
                className="vl-small play"
                data-hud={`play-${c.id}`}
                onClick={() => startSong(c.id, "play")}
              >
                Play
              </button>
            </div>
          ))}
          <div className="vl-row" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className={`vl-small ${harp.slow ? "on" : ""}`}
              data-hud="slower"
              aria-pressed={harp.slow}
              onClick={() => {
                harp.slow = !harp.slow;
                harp.changed();
              }}
            >
              Slower
            </button>
          </div>
        </div>
      ) : null}

      {fin ? (
        <div
          data-hud="finish"
          className="vl-finish vl-glass"
          role="status"
          // Up beside the corner camera (where the note card was); on a tall
          // screen under it.
          style={
            tall
              ? { top: frame.top + frame.height + 24 }
              : {
                  top: GUTTER,
                  left: GUTTER,
                  transform: "none",
                  animation: "vl-fade 420ms both",
                }
          }
        >
          <span className="vl-sparks" aria-hidden="true">
            <Sparks seq={fin.at} count={16} reach={110} />
          </span>
          <span
            className="vl-row"
            style={{ gap: 4 }}
            aria-label={
              fin.mode === "play"
                ? `${fin.stars} of 3 stars`
                : `${songById(fin.id)?.title ?? ""}: learnt`
            }
          >
            {[1, 2, 3].map((k) => (
              <Star key={k} on={k <= fin.stars} />
            ))}
          </span>
          <button
            type="button"
            className="vl-icon"
            data-hud="again"
            aria-label="Again"
            onClick={() => startSong(fin.id, fin.mode)}
          >
            <AgainIcon />
          </button>
          <button
            type="button"
            className="vl-icon"
            data-hud="next"
            aria-label="Next song"
            onClick={() => startSong(nextSongId(fin.id), fin.mode)}
          >
            <NextIcon />
          </button>
        </div>
      ) : null}
    </>
  );
};
