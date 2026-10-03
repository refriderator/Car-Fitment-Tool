# Car Fitment Tool

Fit wheels and tires to a 3D car body in the browser before buying them. Pick a car, enter wheel and tire sizes, set ride height, camber and lower arm length, pull the fenders, and read poke, lip clearance and bump travel.

Styled with the Clipping Point kit.

## Run it

`index.html` is a static page. It loads the car bodies from `cars/`, so serve the folder rather than opening the file:

```
python3 -m http.server 8000
```

GitHub Pages works too: serve the repository root.

## Layout

| Path | What it is |
| --- | --- |
| `src/core.js` | Fitment maths, no DOM: tire and rim sizes, corner position, fender lip detection, flares. Runs in the page and under Node. |
| `src/app.js` | The page: state, three.js view, read-outs, section drawings. |
| `src/page.html` | Markup and styles. |
| `build.py` | Joins `src/` and `fonts/` into `index.html` (full page) and `artifact.html` (same page without the document skeleton). |
| `cars/*.json` | Packed car bodies: 16-bit positions, 8-bit normals, gzip, base64. |
| `tools/` | Converters from Assetto Corsa `.kn5` models to `cars/*.json`, and a Node check of the maths. |

## Add a car

1. Put the car's main `.kn5` in `models/` and add it to `CARS` in `tools/export.py`.
2. `python3 tools/export.py <id>` keeps only what is visible from outside, drops wheels, brakes and interior, and writes raw groups to `tmp/`.
3. `npm install`, then `node tools/pack.js <id>` thins the mesh and writes `cars/<id>.json`.
4. Add the car to `CARS` in `src/core.js`: factory track, wheel and tire, starting fitment, suspension pivot points. `python3 tools/acd.py <car folder>` unpacks the physics data that holds the pivots.
5. `node tools/test.js <id>` prints the detected fender lip and the fitment numbers. Then `python3 build.py`.

Some mods ship a scrambled `.kn5` (the GT86 drift car did). Those come out as crumpled geometry and cannot be used.

## What the numbers are

- **Poke / tuck**: outermost tire or rim point in the top third of the wheel against the fender lip at the top of the arch.
- **Tire to lip**: smallest gap, checked only where the tire sits under the lip (lip edge to 22 mm inboard).
- **Bump to lip**: wheel travel before that gap closes.
- **At lock**: smallest tire-to-lip gap through the steering sweep.

Not checked: the inside of the wheel well, strut, caliper and arms. The liners in these game models are not true to the real cars.

## Assumptions

- Hub faces are placed from factory track and factory offset.
- Opening ride heights are chosen so the starting wheels clear; they are not taken from the models.
- Tire section width on a non-measuring rim uses a rule of thumb: about 5 mm per half inch of rim width.
- Camber does not change with ride height, and the tire is not squashed by load.

## Car bodies

The bodies in `cars/` are thinned exteriors made from third-party Assetto Corsa mods. They are placeholders and belong to their authors. Check each mod's terms before sharing this repository publicly.

## Fonts

Michroma, Chakra Petch and VT323 are open fonts. `fonts/STXingkai-Latin.woff2` is a subset of STXingkai, a commercial SinoType face: check its licence before making this repository public.
