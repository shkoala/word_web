# Spider spelling · Word Web

[Play Word Web](https://shkoala.github.io/Spider_spelling/)

A simple classroom spelling game by SHKOALA. Add your own English words or short sentences, then click the letters to catch each fly. The web grows throughout the round.

## Play

1. Type one word or short sentence per line and click **Let's play!**
2. Read the word on the fly and click the matching letters.
3. Use **Space**, **.**, **,**, **-** and **'** inside the web. **⇧ A** makes the next letter a capital, then turns off.
4. **Undo** removes one character. **Reset** clears the current attempt and keeps earlier threads.
5. **Next word** brings a new fly. Your correct threads stay on the web. At the end, see your finished web or play again.

The English keyboard also works, including Shift, Space, Backspace and punctuation. Case matters. Straight and curly apostrophes are accepted and displayed as `'`. Up to 32 characters per line and 200 lines. Words and settings stay in your browser; the game does not send them to a server.

## Artwork

- Common and less common letters alternate around the frame; the five vowels span the circle.
- `assets/web-v3.svg` contains 26 large letters and their exact thread nodes. It is generated from the same coordinates used by the game.
- `assets/spider-v3.png` is the new eight-legged spider, with four visible legs on each side and no baked-in hanging thread. The game draws its thread to the top of the window.
- `assets/shkoala-logo.png` is the supplied SHKOALA logo.
- The original forest and four fly pictures are retained.

The interface is entirely in simple English. Punctuation controls are scattered inside the web and keep their positions between words.

## Run and check

The published repository serves `index.html` from its root. Keep the other files and `assets/` beside it. No build, external fonts or server are needed to play.

In the development checkout, site files are in `dist/`:

```sh
node --test tests/core.test.cjs
node scripts/build-web.cjs
```

The second command rebuilds the SVG after editing the letter coordinates in `core.js`. Publish the contents of `dist/` at the repository root, and keep `scripts/`, `tests/` and these instructions alongside them.

## Saved versions

- `final-v1-2026-10-29`: the first user-approved final version, including visible return threads.
- `before-art-refresh-2026-10-29`: the working cumulative-web version before the new artwork and English-only interface.

See `VERSIONS.md` for version notes and `ARTWORK.md` for the spider's image-generation brief.
