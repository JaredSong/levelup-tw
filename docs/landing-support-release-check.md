# Landing, study home and support release checks

## Verified locally — 2026-10-23

- All 367 tests pass; production build and 39-pack publication gate pass.
- Lint reports no errors, with two existing Fast Refresh warnings in `QrCode.tsx`.
- Existing `/app`, `/app/`, legacy standalone `/`, and iOS standalone entry render the saved subject and paused-session summary in integration tests.
- Browser checks confirm saved practice resumes, completed answers persist, and the support prompt does not repeat after an impression.
- Reminder cooldown is 14 days per browser/device, across subjects. Eligibility requires 20 recorded attempts in the active subject and at least five answers in the completed session. Install instructions take priority over the support prompt.
- Landing, exam, study-home and support layouts checked in light/dark themes and mobile widths.
- Both receiving-detail copy buttons verified: institution `396`, account `910699497`.
- Desktop and mobile screenshots of the displayed QR decode to exactly the payload in the supplied receiving image, including its original timestamp and checksum. The SVG changes presentation only; it does not alter the receiving data or invent a payment URL.
- The display QR is precached; the original JPG is available as a download. Original JPG download requires connectivity unless already cached by the browser.
- Manifest start URL, storage schema, saved-data keys, and question packs remain unchanged.
- Built `/app` HTML is `noindex, follow`; the sitemap excludes `/app` and synthetic build-date `lastmod` values.

## Before production release

- Scan the saved receiving QR in a real payment app. Check recipient recognition and same-phone image import without submitting a transfer. Confirm reusability/expiry with the provider; decoding alone cannot establish this.
- Test an installed PWA upgrade on the same HTTPS origin: record subject, progress and paused question; update; relaunch from the home-screen icon; resume; then check offline launch with an already-downloaded bank. Do not clear website data or uninstall during the test.
- A new preview origin has independent storage, so it does not prove migration of an existing `levelup.tw` install. Automated entry checks supplement this test, not replace it.
- After deployment, verify Cloudflare's actual `/welcome` redirect, `/app` response, exam metadata, sitemap, and support events. Copying/downloading are intent events, never donation-success events.

The receiving QR requires no merchant API credentials. No payment has been submitted during verification.
