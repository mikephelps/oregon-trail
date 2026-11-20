# The Oregon Trail — a moddable fan remake

A from-scratch browser remake of the classic wagon-trail game. It's plain HTML, CSS, and JavaScript with no build step, no dependencies, and no emulator, so it runs anywhere GitHub Pages does, including phones.

**Features:** professions, a five-person party, the outfitter's store, 18 historical stops with forks in the trail, river crossings (ford, caulk, ferry, guide), weather and seasons, illness and injury, random events, trading, a hunting minigame, the Columbia River rapids, scoring with a hall of fame, and tombstones that later wagons pass by. The game saves automatically after every day.

## Play locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

**Controls:** `Space` starts and stops the wagon · number keys pick options · `Enter`/`Esc` close messages · mouse and touch work everywhere.

## Put it on GitHub Pages

1. Push this folder to a GitHub repo.
2. In the repo, go to **Settings → Pages**, set **Source** to *Deploy from a branch*, then choose `main` and `/ (root)`.
3. The game goes live at `https://<you>.github.io/<repo>/` in about a minute.

## Modding

All game content lives in **`js/content.js`**. Edit it and reload the page. You won't need to touch the engine.

| What | Where in `content.js` |
|---|---|
| Title, subtitle, year | `title`, `subtitle`, `tagline`, `year` |
| Professions and starting money | `professions` |
| Suggested party names | `suggestedNames` |
| Store name, shopkeeper, advice | `store` |
| Prices, item limits | `items` |
| Pace and ration options | `paces`, `rations` |
| Diseases | `illnesses` |
| Random events | `events` |
| Huntable animals | `animals`, `hunting` |
| Landmarks, the route, river data, quotes | `trail.nodes` |
| Win/lose and other messages | `text` |
| Scoring, ranks, and starting hall of fame | `scoring`, `ranks`, `hallOfFame` |

### Text placeholders

Event text can include `{name}` (a random living party member), `{amount}` and `{item}` (what was gained or lost), `{days}`, and `{part}`.

### Adding an event

```js
{ id: 'ghost-wagon', weight: 1, title: 'Strange lights', tone: 'neutral',
  text: '{name} swears they saw a ghostly wagon on the ridge. Nobody sleeps. You lose {days} days.',
  when: { terrain: ['mountains'], months: [9, 10] },
  effects: [{ op: 'days', amount: [1, 2] }] },
```

**`effects`** (applied in order):

| op | fields | does |
|---|---|---|
| `item` | `item`, `amount` (number or `[min, max]`, negative = lose) | add or remove supplies |
| `itemPct` | `item`, `pct` `[min, max]` | lose a percentage of an item |
| `days` | `amount` | lose days (food is still eaten) |
| `health` | `who: 'one' \| 'all'`, `amount` | change health (negative hurts) |
| `sick` | `who: 'one'`, `illness` (id, or omit for random) | make someone sick |
| `break` | — | break a wagon part (uses a spare if you have one) |

**`when`** (all optional): `terrain` (`plains`, `hills`, `mountains`, `river`), `months` (1–12), `minMile`/`maxMile`, `pace`, `minTemp`/`maxTemp` (°F), `sky`, and `needs` (e.g. `{ food: 50 }`). Events with no `terrain` never fire on the Columbia raft trip.

`tone` colors the pop-up: `good`, `bad`, `neutral`.

### Adding or changing landmarks

Each entry in `trail.nodes` lists where you can go next:

```js
next: [{ to: 'fort-x', miles: 120, terrain: 'hills' }]
```

Give a node two or more `next` entries to create a fork (add `label`, `note`, and an optional `toll`). Add a `river` block to make it a crossing, and a `store: { priceFactor }` to make it a fort. `talk` is a list of `[speaker, quote]` pairs.

## Tests

The engine (`js/engine.js`) has no dependencies on the page, so it can play thousands of games headlessly:

```bash
node tests/simulate.js 2000 --causes
```

The simulator plays one bot that plays sensibly and one that mashes buttons. It fails on crashes, invalid state (negative supplies, NaN), or games that never end, and it reports win rate, arrival month, and causes of death. Run it after big content changes to check that the balance still feels right.

Add `?fast` to the URL to speed up travel while testing a mod.

## Project layout

```
index.html        page shell
css/style.css     all styles (light and dark)
js/content.js     ← all game content, edit this
js/engine.js      game rules and state (no DOM)
js/scene.js       animated wagon panorama
js/ui.js          screens, input, hunting, saving
tests/simulate.js headless balance and stability test
```

---

*An unofficial fan project, made for fun. It is not affiliated with or endorsed by the owners of The Oregon Trail trademark. All code and text here are original.*
