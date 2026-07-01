# とげにゃんWeb Source Notes

Source inspected on 2026-07-01:

- `https://togenyanweb.appspot.com/Yokai/yw1/calc.html`
- `https://togenyanweb.appspot.com/Yokai/yw1/js/calc.js`

## Linked Calculator Assets

`calc.html` links these external browser libraries:

- `https://code.jquery.com/jquery-2.1.4.min.js`
- `https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.0/css/select2.min.css`
- `https://maxcdn.bootstrapcdn.com/bootstrap/3.3.2/css/bootstrap.min.css`
- `https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.0/js/select2.min.js`

The Yo-kai Watch 1 calculator logic/data is in:

- `js/calc.js`

No separate Yo-kai data file was linked by `calc.html`; the inspected `calc.js` embeds `yokaiData`, `characteristicsData`, growth names, class IV_A eligibility, stat labels, and `calcStatus`.

## License / Attribution

Both `calc.html` and `calc.js` contain this attribution/license notice:

```text
Status Calculator for Yokai Watch
Copyright 2015 IVC ◆HePDgfYKMA
Released under the conditions of the MIT License
http://opensource.org/licenses/mit-license.php
```

The local port preserves that attribution in files that use source-derived formula/data:

- `src/engine/calculationEngine.ts`
- `src/engine/yokaiData.ts`

## What Was Ported

The local `togenyanPortedEngine` ports `calcStatus` from `calc.js`, including the source's `Float32Array` constants and assignment order so single-precision coercion points are preserved.

The local data file now ports the full `yokaiData` array from the inspected `calc.js` source:

- Source rows parsed: 245
- Source numbering: contiguous `num` values from 1 through 245
- Local exported count: `SOURCE_YOKAI_DATA_LENGTH = 245`
- Preserved fields per row: source number, Japanese name, furigana, base stats (`bs`), growth patterns (`growPat`), class (`class`), and class-derived IV_A eligibility
- Local IDs: existing MVP IDs were kept for compatibility; all other rows use stable ASCII `yw1-###` IDs based on source number

The compatibility IDs kept from the MVP subset are:

- くさなぎ
- ブシニャン
- 山吹鬼
- ししコマ
- とらじろう
- ジバニャン
- コマさん
- コマじろう

No source rows were dropped. Boss rows with growth pattern `5` and class `0` are included because they are present in the source `yokaiData`.

The source class table was ported to enforce which stat may use IV_A. The source personality/characteristic bonuses were ported into the app's personality mode choices.

## Verification Status

Status: `ported from togenyan source`.

The formula is no longer provisional for normal UI/reverse searches, but it has not been independently verified against in-game captures or published example outputs. Tests lock local behavior to source-derived fixtures generated from the inspected `calcStatus` function. No standalone worked examples were found in `calc.html` or `calc.js`.

TODO: Add independent fixture cases if reliable in-game examples are found. Keep the engine boundary swappable until those fixtures exist.
