# Sudodoku

A polished, installable Sudoku game that runs entirely in the browser. Sudodoku is a dependency-free static site, works offline after the first visit, remembers games and preferences locally, and is ready for GitHub Pages.

## Features

- Four difficulty levels with uniquely solvable generated puzzles
- Visible coached hints, smart candidate notes, undo, mistake tracking, keyboard controls, and pause mode
- Deterministic daily challenges shared by every player for that date
- Focus scoring, 40 progress-tracked achievements across five rarity tiers, daily streaks, best times, and richer lifetime statistics
- Auto-save, celebration effects, sound feedback, and theme preferences
- A clear first-launch language gate plus persistent switching between English, Lithuanian, Spanish, German, and Ukrainian
- Guided first-run onboarding, mobile haptics, automatic pause preferences, and shareable results
- A quick Sudoku rules primer and 12-lesson Technique Academy covering singles, locked candidates, pairs, triples, fish patterns, XY-Wing, and Skyscraper
- Classic, Killer, Hyper, Mini 6×6, Zen, and deterministic Daily modes
- Weekly quests, XP levels, replay timelines, generated result cards, and unlockable visual styles
- Technique-based puzzle grading, adaptive skill ratings, solve reviews, turning-point practice, and a persistent Technique Journal
- An eight-week activity dashboard, per-difficulty performance, a replayable Daily archive, guided practice plans, and earned streak shields
- Offline asynchronous challenge links with custom rules, benchmark comparison, QR sharing, and compact progress QR transfer
- Responsive layout, reduced-motion support, light/dark themes, and subtle sound effects
- Installable PWA with full offline support, explicit install controls, app badges, share-target support, and richer shortcuts

## Run locally

Service workers require HTTP rather than opening `index.html` directly:

```bash
npm run serve
```

The server starts at `http://127.0.0.1:4173`. If that port is occupied, it automatically tries `4174`, `4175`, and so on until it finds a free port. Set `PORT` to choose a different starting port.

Run the puzzle engine tests with `npm test`.

## Deploy to GitHub Pages

Push to `main`. The included GitHub Actions workflow publishes the repository as a static Pages site. In the repository settings, set **Pages → Source** to **GitHub Actions**.

No build step or repository-specific base path is required.
