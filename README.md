# Fire Station

A pixel-art toy for a toddler who loves fire trucks. One page, no build step, no assets to download: the art and every sound are generated in code.

## How to play
- **Tap a vehicle** (fire truck, police car, ambulance). It says its name, turns on its lights and siren, drives around the block and parks itself again. Tap it while it's driving to honk.
- **Tap a paint pot** to repaint the vehicle with the yellow arrow over it. A recorded voice says the color name. Colors are remembered on the device.
- Hidden surprises: the **bell** on the tower, the **dog**, the **fire hydrant**, the **sun** and the **helicopter**.

There is no way to lose and nothing to read.

## Run it
Open `index.html` in a browser, or serve the folder (`python3 -m http.server`) and open it on the phone or iPad on the same Wi-Fi. When it's hosted (e.g. GitHub Pages), use Safari's **Share → Add to Home Screen** to get a full-screen app icon.

Tip: turn on **Guided Access** (Settings → Accessibility → Guided Access, then triple-click the side button in the game) so little hands can't leave the app.

## Voice clips
Recorded lines live in `audio/` as `<phrase>.mp3` (e.g. `fire-truck.mp3`, `red.mp3`) and are listed in `LINES` / `CLIP_NAMES` in `index.html`. Missing clips are simply skipped. To add new ones, trim and level them the same way:

```sh
ffmpeg -i in.mp3 -af "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.08,areverse,loudnorm=I=-16:TP=-1.5" -ac 1 -b:a 64k audio/name.mp3
```
