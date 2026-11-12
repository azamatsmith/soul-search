# Photo placeholder

## Why

On first load, Home's last photo showed a broken image while the (full-size) photo downloaded. Photos should show the striped placeholder until they arrive and never a broken-image icon.

## Goals

- Home last photo, Sightings cards, flagged-photo cards and the review screen photo show `--stripes` until the image loads, then fade in (no fade with reduced motion).
- On error the stripes stay; no broken icon, no alt text flash.

## Non-goals

- Smaller image files: separate follow-up (generate a 480 thumbnail and a 1600px display version at upload, plus a backfill).
- Camera capture screens: they show a local photo already on the device.

## Approaches

1. **Shared `Photo` component (picked):** one place for the load/error state and the stripes; each caller keeps its own size via `className`.
2. CSS-only background stripes behind each `img`: can't hide the broken icon or alt text on error.

## Decisions

- The photo viewer keeps its existing thumbnail-then-full behavior on its dark stage; it only stops showing a broken full image (hidden until loaded, as today) and gets no stripes, which would clash with the camera-dark viewer.
