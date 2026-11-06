# 視覺傳達設計丙級 (201003A12) source QA

Status: **staged only; do not publish**. The staged 608 answer markers agree with the source PDF, but 21 figure questions still lack approved question-specific image crops.

Run `node scripts/build-staged-image-review.mjs 201003A12` and open `tmp/import-batch/201003A12/image-review.html` locally. The gallery shows 27 flagged questions beside their official PDF pages. It does **not** present source pages as finished question images.

- `20100-05-001` through `020` each need the base three-dimensional object and four complete sets of orthographic projections. A page screenshot or a single narrow crop would hide or mix options.
- `20100-03-040` is another figure question requiring its own crop review.
- Six deletion candidates (`20100-02-069`, `20100-03-045`, `20100-04-029/036/085`, `20100-05-053`) need confirmation from the printed source before being marked inactive.

Keep `publishable: false` until every image is cropped, visually checked against its corresponding source question, the deletion markers are resolved, and the separate WDA source-drift gate passes. Matching answer keys alone is insufficient for publication.
