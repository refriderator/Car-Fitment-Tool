# To do

## Next session

- **Colors.** Revisit the palette. Current state: red field with an indigo fade on the banner and in the top-right corner of the 3D frame; paint options are grey, red and black.
- **Track width limit.** Make it larger. Today the page caps offset at -70 to +70 mm, spacer at 0 to 60 mm and lower arm length at -15 to +70 mm (`src/page.html`), and the fender scan only reaches 1070 mm out from the car's centerline (`MAP` in `src/core.js`). Both need widening together.

## Open from the first build

- GitHub Pages: not confirmed working on the live site. Tested only on a local copy served under `/Car-Fitment-Tool/`.
- GT86: the supplied model was scrambled and was dropped. Needs a cleaner file.
- Car bodies are placeholders made from third-party mods, and `fonts/STXingkai-Latin.woff2` is a commercial font. The repository is public.
- Starting wheels on the Roadster and IS300 are estimates. The Roadster's factory 15x6 +40 wheel and the IS300's 17x7 +50 are not verified from a primary source.
- Not modelled: inner wheel well, strut, caliper, camber change with ride height, tire squash.
