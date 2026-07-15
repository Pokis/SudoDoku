# Sudodoku

A polished, installable Sudoku game that runs entirely in the browser. Sudodoku is a dependency-free static site, works offline after the first visit, remembers games and preferences locally, and is ready for GitHub Pages.

## Features

- Four difficulty levels with uniquely solvable generated puzzles
- Visible coached hints, smart candidate notes, undo, mistake tracking, keyboard controls, and pause mode
- Deterministic daily challenges shared by every player for that date
- Focus scoring, 28 progress-tracked achievements across five rarity tiers, daily streaks, best times, and richer lifetime statistics
- Auto-save, celebration effects, sound feedback, and theme preferences
- Persistent language selection with English, Lithuanian, Spanish, German, and Ukrainian
- First-run onboarding, mobile haptics, automatic pause preferences, and shareable results
- Technique coaching for singles, pairs, and X-Wings
- Classic, Killer, Hyper, Mini 6×6, Zen, and deterministic Daily modes
- Weekly quests, XP levels, replay timelines, generated result cards, and unlockable visual styles
- Responsive layout, reduced-motion support, light/dark themes, and subtle sound effects
- Installable PWA with full offline support

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
