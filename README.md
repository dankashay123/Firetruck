# Fire Station

A pixel-art toy for a toddler who loves fire trucks. One page, no build step, no assets to download: the art and every sound are generated in code.

## How to play
- **Tap a vehicle** (fire truck, police car, ambulance). It says its name, turns on its lights and siren, drives around the block and parks itself again. Tap it while it's driving to honk.
- **Tap a paint pot** to repaint the vehicle with the yellow arrow over it. A recorded voice says the color name. Colors are remembered on the device.
- **Upstairs** the crew lives their day: eating at the table, watching TV, sleeping in the bunk room, sliding down the fire pole. Tap anyone to make them hop and wave; tap the sleeper to wake them.
- **Tap the sun** for night (the sun rolls away over the top and the moon rises in from the right); tap the moon for morning.
- **Mini-game menu** (top left): the yellow toy-box button opens a full-screen page of big picture tiles with names; tap a tile to play, or the red X to go back.
  - **Flame: Spray the Fire.** The fire truck races to a burning house. Drag or tap to spray; every fire goes out the moment the water touches it. Neighbors and kitties wave from the windows.
  - **Red cross: ambulance mission.** Help a hurt kid, hold the go button to drive to the hospital.
  - **Star: police mission.** Stop the traffic so ducks and people can cross.
  - **Heart: Who Comes to Help?** Pick the right vehicle for each problem.
  - **Movie screen: the cinema.** Short cartoons to watch: the fire truck, the police car, the ambulance, and a sing-along of *Little Blue Truck* (Blue, the big dump truck, the toad, the goat and the farm animals) drawn from our own copy of the book. Plus *The Big Bone Adventure*, starring our two dogs (the Vizsla and the white husky) on a hike past an owl, a bear and a snake, up a snowy mountain and down to a giant bone.
  - **Ice cream: the Ice Cream Truck.** People (and sometimes our two dogs, for a pup cup) line up at the window; each dreams of one of ten treats, and a tap anywhere hands it over. Tap a dog in the park to make it bark. The pink swirl button (top left) opens the **kitchen**: tap a soft-serve machine and press and hold to pour a swirl, switch to the scoop counter to stack scoops from six tubs, add sprinkles, chocolate sauce, whipped cream, candy stars and a cherry, then ring the bell to serve it.
  - **Moon: bedtime.** Night falls; tap each vehicle to roll its garage door down. Then the lights go out, the dog curls up and a lullaby plays. Tap the sun button or the moon to wake everyone up.
- Hidden surprises: the **bell** on the tower, the **dog**, the **fire hydrant** and the **helicopter**.

There is no way to lose and nothing to read.

## Code layout
- `js/core.js`: shared engine (canvas, sprites, sound, day/night sky, scene system, input).
- `js/station.js`, `js/fire.js`, `js/help.js`, `js/amb.js`, `js/police.js`: one file per scene, each registering `SCENES.<name>`.
- `js/book_art.js`, `js/movie_book.js`: the *Little Blue Truck* sing-along. The story runs one beat per sung page; a parent's recording in `audio/movie-book.mp3` (one take, a short pause at each page turn) plays along when present, and the page start times go in `SONG_PAGES`. Without it the cartoon plays with little beeps and animal noises. Tap the picture for the player controls: a pause button and a timeline (one tick per page) that can be dragged.
- `js/movie_dogs.js`: *The Big Bone Adventure*, a one-minute cartoon with its own little tune; tap for pause and the timeline.
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

## Sound credits
The Big Bone Adventure uses free public-domain (CC0) sounds from OpenGameArt.org; no attribution is required, but thank you:
- Music: "Happy Adventure (Loop)" by TinyWorlds (`audio/dogs-music.mp3`)
- Barks: "Dog Sounds" pack and "80 CC0 creature SFX" (`audio/dog-bark.mp3`, `audio/dog-bark-2.mp3`)
- Bear: "Bear Growls" (`audio/bear-roar.mp3`)
- Splash: "6 Short Water Splashes" (`audio/splash.mp3`)
- Crunch: "Crunchy Bite" (`audio/crunch.mp3`)

Little Blue Truck uses CC0 sounds from OpenGameArt.org too:
- Music: "Apple Cider" by Zane Little Music (`audio/bt-music.mp3`); it plays only while there's no sung recording
- Farm animals: "Baby Animals Sounds Pack" (moo, baa, goat, pig, chick, horse) and "Frog Croaks"
- Horns: the car horn from "Car Sound Effects Pack", pitched up for Blue's beep and down for the dump truck's honk
- Mud: "25 CC0 mud SFX"

The Ice Cream Truck uses CC0 sounds from OpenGameArt.org:
- Music: "Ice Cream Truck Theme (Childhood Flavors)" (`audio/ic-music.mp3`)
- Bell: "Bell Dings/Chimes"; scoop: "Bubbles Pop"; happy nom: "80 CC0 creature SFX" (`audio/ic-*.mp3`)

The Digger, Dog Bath and Garbage Truck games use CC0 sounds from OpenGameArt.org:
- Music: "Brassy Bubbles" (digger), "Puppy playing in the garden" by Spring Spring (dog bath), "Wish Wash Bish Bash" (garbage truck)
- Digging: "Shovel Sound", "100 CC0 SFX #2" stones, "75 CC0 breaking/falling/hit SFX" rocks, "Generator Loop" engine, "100 CC0 SFX" spring (`audio/dig-*.mp3`)
- Bath: "Squeak Toy Sounds", "Bubble sound effects", "Bubbles Pop", "40 CC0 water/splash/slime SFX", "100 CC0 SFX #2" water loop (`audio/bath-*.mp3`)
- Garbage: "75 CC0 breaking/falling/hit SFX", "27 Metal Audio Samples", "100 CC0 SFX #2" air brake, "100 CC0 SFX" paper (`audio/trash-*.mp3`)

The family cat's meows and purr are CC0 from OpenGameArt.org: "Meow" by Crystal Games and "Cat purr & meow" (`audio/cat-*.mp3`).

Sprinkles and the Ice Cream Mountain (cartoon) and the station's background music use CC0 sounds from OpenGameArt.org:
- Station music: "Quaint Town" (`audio/station-music.mp3`)
- Chime: "Bell Dings/Chimes"; plop: "Wet squish slurp impacts" (`audio/mv-*.mp3`); the cartoon's tune is "Childhood Flavors" (`audio/ic-music.mp3`)

The Choo Choo Train game uses CC0 sounds from OpenGameArt.org: music "The Rainbow Train" by Spring Spring (`audio/train-music.mp3`); "Steam whistle" (`audio/train-whistle*.mp3`); "Steam release sounds" (`audio/train-hiss.mp3`); "Steamboat Engine Sound" (`audio/train-chug.mp3`). The farm animals reuse the Little Blue Truck sounds.

Fireboat Rescue uses CC0 sounds from OpenGameArt.org: music "A sailor's chant" by Thimras (`audio/boat-music.mp3`); "Steam whistle" pitched down for the horn (`audio/boat-horn.mp3`, `audio/boat-toot.mp3`); "Steamboat Engine Sound" (`audio/boat-motor.mp3`); "Beach Ocean Waves" (`audio/boat-waves.mp3`); "Solo Seagull Sound Effects" (`audio/boat-gull*.mp3`); "Steam release sounds" (`audio/boat-steam.mp3`).

Build a Fire Truck uses CC0 sounds from OpenGameArt.org: music "Happy Clappy Loop" (`audio/bd-music.mp3`); hammer, clunk, tools and spring from "100 CC0 metal and wood SFX" (`audio/bd-*.mp3`).

The station's thunderstorms use CC0 sounds from OpenGameArt.org: thunder from "100 CC0 SFX #2" (`audio/wx-thunder.mp3`) and "Rain (loopable)" (`audio/wx-rain.mp3`). The alarm bell is synthesized.

The Cat Who Got Stuck in a Tree (cartoon) uses CC0 sounds from OpenGameArt.org: music "Catsong" by josepharaoh99 (`audio/mc-music.mp3`); "Sirens and Alarm Noise" (`audio/mc-siren.mp3`); "Tree Creaking" (`audio/mc-creak.mp3`); "100 CC0 metal and wood SFX" (`audio/mc-ratchet.mp3`); harp from "Magic Words / Healing Sound Effect" by Spring Spring (`audio/mc-twinkle.mp3`); "Swishes Sound Pack" (`audio/mc-swish.mp3`).

The Dogs' Big Bath Day (cartoon) uses CC0 sounds from OpenGameArt.org: music "Children's March Theme" by Cleyton Kauffman (`audio/bathday-music.mp3`); mud from "25 CC0 mud sfx" (`audio/bathday-splat.mp3`, `audio/bathday-squish.mp3`); towel "Fabric Rustling" (`audio/bathday-rub.mp3`).

Goodnight, Fire Station (cartoon) uses CC0 sounds from OpenGameArt.org: music box "cute tune" from "4 Music Box Tracks" (`audio/night-music.mp3`); "Crickets Ambient Noise (Loopable)" by Ted Kerr (`audio/night-crickets.mp3`); harp from "Magic Words / Healing Sound Effect" by Spring Spring (`audio/night-harp.mp3`).
