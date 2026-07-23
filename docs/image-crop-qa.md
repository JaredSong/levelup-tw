# Question Image Crop QA

Use this checklist whenever adding or repairing `public/question-images/*`.

1. Treat the official WDA PDF as the source of truth for wording, answer keys, image role, and image order.
2. Crop from the official PDF through `scripts/build-question-crops.mjs` or the relevant importer config. Do not hand-edit generated PNGs without also making the source/importer change repeatable.
3. For visual framing, compare the learner-facing result against Techcerti for the same exam/version/question when reachable. This is a sanity reference only, not an authority over the official PDF.
4. Image-option PNGs should contain only the option drawing/symbol, not the option number, answer marker, neighboring punctuation, or surrounding question text.
5. Standalone prompt figures should be tight enough to avoid unrelated text, but should keep the full figure and enough whitespace to read thin lines.
6. Before committing, inspect a contact sheet of the changed images and run the image audit.

Do not put external comparator names in public commit subjects. Use neutral subjects such as `Fix heat treatment question crops`.
