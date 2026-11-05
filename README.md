# Harp

A concert harp in a recording studio, played with your fingertips in the air. Its strings are
drawn across your camera picture: pass a fingertip across them to pluck, sweep for a glissando.
A gold ghost hand plays the harp with you, the strings you play glow gold and shake, and the
studio's LED strips glow with the music. Your camera sits small in the top right corner.

- **Start:** the home page shows while the studio, the harp and the sounds load; Start turns
  the sound on and asks for the camera. Without a camera the studio opens anyway and you play
  by dragging across the strings or with the keyboard.
- **Plucking:** 22 strings, C3 to C6 (C strings red, F strings blue, as on a real harp). Pass a
  fingertip across a string in the camera to pluck it; faster is louder. Sweep across many for
  a glissando. Both hands play.
- **Fingers:** the first dock button chooses which fingertips play: the index, the index and
  middle (the default), or all five.
- **Stopping:** make a fist with either hand to stop every string.
- **Songs:** the music-note button opens the songs (Twinkle Twinkle, Ode to Joy, Brahms'
  Lullaby, Amazing Grace, with rolled chords and glissandos). The next strings glow gold.
  **Learn** waits for each note; **Play** keeps time with a soft backing and gives 1 to 3
  stars; **Slower** plays at three-quarter speed.
- **Without hands:** drag across the strings or tap one; keys A–K play C4 to C5, Shift an
  octave up, Space a glissando, Esc stops.
- **The dock:** Songs, Fingers, View (Front, Player, Close), Day / Night, How to play.

## Files

```
src/harp/
  HarpScene.tsx     the scene, loaded after the home page shows
  Home.tsx          the home page
  Hud.tsx           the dock and the how-to-play card
  CameraRig.tsx     the views, fitted to the screen (layout.ts)
  Studio.tsx        the room, its baked day / night light and the LEDs (led.ts)
  Harp.tsx          the harp, the glowing, shaking strings and the sparks (strings.ts)
  GhostHand.tsx     the gold hand (ghost.ts)
  Hands.tsx         hand tracking: the air strings (air.ts, fingers.ts, oneEuro.ts)
  NoteStrip.tsx     the last notes played
  SongUI.tsx, SongPlayer.tsx, session.ts, songs.ts, backing.ts   Learn and Play
  audio.ts, sampler.ts, synth.ts   the recorded harp, with a made-in-code voice as fallback
  PointerInput.tsx  drags, taps and keys
  CameraFrame.tsx   your camera in the corner, with the air strings drawn over it
public/models/      the studio and its bakes, the harp and the gold hand
public/sounds/      the harp samples (harp.json lists them)
```

Credits are in `CREDITS.md`.
