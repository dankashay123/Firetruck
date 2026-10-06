# Fire Station

A pixel-art toy for a toddler who loves fire trucks. One page, no build step, no assets to download: the art and every sound are generated in code.

## How to play
- **Tap a vehicle** (fire truck, police car, ambulance). It says its name, turns on its lights and siren, drives around the block and parks itself again. Tap it while it's driving to honk.
- **Tap a paint pot** to repaint the vehicle with the yellow arrow over it. A recorded voice says the color name. Colors are remembered on the device.
- **Upstairs** the crew lives their day: eating at the table, watching TV, sleeping in the bunk room, sliding down the fire pole. Tap anyone to make them hop and wave; tap the sleeper to wake them.
- **Tap the sun** for night (the sun rolls away over the top and the moon rises in from the right); tap the moon for morning.
- **Mini-game buttons** (top left):
  - **Flame: Spray the Fire.** The fire truck races to a burning house. Drag or tap to spray; every fire goes out the moment the water touches it. Neighbors and kitties wave from the windows.
  - **Red cross: ambulance mission.** Help a hurt kid, hold the go button to drive to the hospital.
  - **Star: police mission.** Stop the traffic so ducks and people can cross.
  - **Heart: Who Comes to Help?** Pick the right vehicle for each problem.
  - **Moon: bedtime.** Night falls; tap each vehicle to roll its garage door down. Then the lights go out, the dog curls up and a lullaby plays. Tap the sun button or the moon to wake everyone up.
- Hidden surprises: the **bell** on the tower, the **dog**, the **fire hydrant** and the **helicopter**.

There is no way to lose and nothing to read.

## Code layout
- `js/core.js`: shared engine (canvas, sprites, sound, day/night sky, scene system, input).
- `js/station.js`, `js/fire.js`, `js/help.js`, `js/amb.js`, `js/police.js`: one file per scene, each registering `SCENES.<name>`.
- `js/main.js`: boot and main loop. `index.html#fire` (or `#help`, `#amb`, `#police`) jumps straight into a scene after Play.

## Run it
Open `index.html` in a browser, or serve the folder (`python3 -m http.server`) and open it on the phone or iPad on the same Wi-Fi. When it's hosted (e.g. GitHub Pages), use Safari's **Share → Add to Home Screen** to get a full-screen app icon.

Tip: turn on **Guided Access** (Settings → Accessibility → Guided Access, then triple-click the side button in the game) so little hands can't leave the app.

## Offline (planes, cars)
`sw.js` caches everything on the first visit over Wi-Fi, so the home-screen app works in airplane mode. Bump `VERSION` in `sw.js` whenever files change. After an update, open the app once online, close it fully, and reopen to get the new version.

## Voice clips
Recorded lines live in `audio/` as `<phrase>.mp3` (e.g. `fire-truck.mp3`, `red.mp3`) and are listed in `LINES` / `CLIP_NAMES` in `index.html`. Missing clips are simply skipped. To add new ones, trim and level them the same way:

```sh
ffmpeg -i in.mp3 -af "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.08,areverse,loudnorm=I=-16:TP=-1.5" -ac 1 -b:a 64k audio/name.mp3
```
