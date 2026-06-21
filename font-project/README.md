# Michal Handwriting — OTF font

A handwriting font built from two scanned sheets of Michal's handwriting:

- **Sheet 1** (`work/source.jpeg`) — the 22 Hebrew letters + 5 final forms.
- **Sheet 2** (`work/source2.jpeg`) — digits `0–9` and a full set of
  punctuation / symbols.

The single missing glyph on the sheets, **ז (zayin)**, was synthesised in the
same monoline style and pen weight as the rest of the alphabet.

## Output

- `dist/MichalHandwriting-Regular.otf` — the font (CFF/OpenType, 75 glyphs).
- `dist/proof.png` — every glyph in the font.
- `dist/words.png` — sample words/numbers for spacing and shaping.

### Glyph coverage
- Hebrew: `א ב ג ד ה ו ז ח ט י כ ל מ נ ס ע פ צ ק ר ש ת` and finals `ך ם ן ף ץ`
- Digits: `0 1 2 3 4 5 6 7 8 9`
- Punctuation & symbols: `. , : ; ! ? ' " ( ) [ ] { } - + = < > ~ | / \ _ ^ *
  & @ # % $ · £ € ₪` (plus Unicode aliases for curly quotes, en-dash, etc.)

## How it was built

`build_font.py` runs the whole pipeline:

1. **Segment** each sheet into individual letter cells (vertical/horizontal
   projection profiles); the blue cursor mark on sheet 2 is filtered out by
   colour.
2. **Vectorise** every glyph: the ink mask is up-sampled and traced with
   [`potrace`](http://potrace.sourceforge.net/) into cubic Bézier outlines.
3. **Normalise** into font units with a single shared baseline and scale
   (`SCALE = 9` units/px), so Hebrew letters, digits and punctuation all sit
   on a consistent baseline with correct ascenders/descenders.
4. **Assemble** (`build_assemble.py`) into a CFF OpenType font with
   `fontTools`, including `cmap`, metrics, `name`, `OS/2` and `post` tables.

### Reproduce

```bash
pip install fonttools pillow numpy scipy matplotlib
sudo apt-get install -y potrace
cd font-project
python3 build_font.py      # -> dist/MichalHandwriting-Regular.otf + proof.png
python3 render_words.py    # -> dist/words.png
```

## Notes & possible next steps

- Currency symbols (`£ € ₪`) and brackets were drawn larger than the letters
  on the original sheet; that proportion is preserved faithfully.
- The font is monoline and unhinted. Natural next steps would be kerning, a
  bold weight, or Nikud (Hebrew vowel points), none of which were on the
  source sheets.
