# CampusMove (OAU Edition) — Live Rider Map

A zero-login campus map for **Obafemi Awolowo University (OAU), Ile-Ife**. Tap one button, share your GPS, and everyone sees your green dot and the path you are moving along — like a live location share on Google Maps.

> **Status:** working prototype. There is no demo data and no simulated fleet. The map is empty until a real rider starts sharing.

---

## What it does

- **Zero login.** Open the page and the campus map loads immediately.
- **One button.** Tap `I'M ON A SHUTTLE` and allow location access. Nothing else to fill in.
- **Green dot + movement trail.** Your position shows as one pulsing green marker; every 5 m of movement adds a point to your emerald trail.
- **Precise fixes only.** The browser uses high-accuracy GPS and the app waits for a fix within **50 m** before drawing anything. The panel shows the reported accuracy (`±8 m`).
- **OAU campus only.** The server checks every ping against the real OAU campus boundary. A position outside the university is rejected and never appears on the map.
- **Live for everyone.** All open maps update over SSE every 1.5 s.
- **Stop anytime.** Tap `STOP` and your dot and trail disappear immediately.
- **Local preview.** On a device without GPS, `Preview a sample ride (no GPS)` animates a green dot and trail on your own screen so you can see the design. It is labelled `PREVIEW`, never calls the API, and is never visible to anyone else.
- **Real riders only.** No routes, stops, ETAs, bus numbers, queue reports, or seeded buses.

That is the whole product. There is intentionally nothing else on the map.

---

## How it works

| Piece | Behaviour |
| --- | --- |
| **Location source** | The browser's `navigator.geolocation.watchPosition` with `enableHighAccuracy: true` and `maximumAge: 0`. |
| **Precision filter** | Client and server both require an accuracy of **50 m or better**. Fuzzy fixes are sent only for the boundary check and are never stored or drawn. |
| **OAU check** | Every fix — even a fuzzy one — is tested against a 94-point OpenStreetMap polygon of the OAU campus. Outside pings get `403 outside_oau` immediately, so the app never sits on “getting GPS fix” for someone outside campus. |
| **Ping interval** | A ping is sent on every accepted GPS fix, plus a 5 s heartbeat so a stationary rider stays on the map. |
| **Trail points** | The server appends a point only when the rider has moved at least **5 m** from the previous one, and keeps the latest **300** points. |
| **Live feed** | `GET /api/stream` pushes the rider snapshot over SSE every **1.5 s**. |
| **Stale cleanup** | A rider disappears after **90 s** without a ping, or instantly on `STOP`. |
| **Storage** | In memory only. Restarting the API clears every rider. |

---

## Run it

Requires Node.js 18+ (tested on Node 24).

```bash
cd /home/blackwrld04/.gemini/antigravity/scratch/campusmove
node start.js
```

- **App:** <http://localhost:5173>
- **API:** <http://localhost:3001>
- **SSE stream:** <http://localhost:3001/api/stream>

`start.js` launches the Express API and the Vite dev server together. Stop both with `Ctrl+C`.

The map opens empty by design. Tap the green button to put yourself on it.

Production build of the client:

```bash
cd client
npm run build
```

### Preview ride (local only)

If the device has no GPS — a laptop, a VM, or a browser without a working location provider — the empty map offers **Preview a sample ride (no GPS)**.

- It animates a green dot along a 3.2 km road loop through the centre of campus, at 29 km/h, with the same emerald trail as a real rider.
- The top bar shows a `PREVIEW` badge and the panel says **“Not shared — visible only on this screen.”**
- It makes **no geolocation calls and no API requests**. The preview rider lives only in React state, so it never reaches the server, other users, or the trail store.
- `STOP` clears the dot and trail immediately and returns the normal empty map.

The route geometry is bundled in `client/src/previewRoute.ts` (generated once from OSRM/OpenStreetMap), so preview mode also works with no network beyond the map tiles. It is a design demo, not a way to fake a real location.

### Styling (no CDN)

The UI uses Tailwind compiled into `client/src/tailwind.generated.css`, and Leaflet's CSS is imported from `node_modules`. Neither is loaded from a CDN at runtime. The generated CSS is committed so the app works offline.

If you add or change utility classes, regenerate it:

```bash
cd client
npx tailwindcss@3.4.17 -c tailwind.config.js -i src/tailwind.css -o src/tailwind.generated.css --minify
```

---

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check and number of sharing riders |
| `GET` | `/api/riders` | Snapshot of every rider and their trail |
| `GET` | `/api/stream` | SSE stream of the same snapshot |
| `POST` | `/api/ping` | Rider location update |
| `POST` | `/api/exit` | Stop sharing and remove the rider immediately |

### Ping body

```json
{
  "riderId": "rider-abc123",
  "lat": 7.5186,
  "lng": 4.5273,
  "speed": 30,
  "heading": 343,
  "accuracy": 8
}
```

`lat` and `lng` are required and must fall inside the OAU boundary. `accuracy` is the GPS accuracy in meters; when present it must be **50 m or better**. `speed` is km/h and `heading` is degrees; both are optional and only kept for future use. A successful ping returns:

```json
{
  "status": "sharing",
  "riderId": "rider-abc123",
  "pathPoints": 12,
  "accuracy": 8,
  "insideOau": true
}
```

Failure responses:

| Status | `error` | Meaning |
| --- | --- | --- |
| `400` | `riderId and valid lat/lng are required` | Missing or malformed coordinates. |
| `403` | `outside_oau` | The position is outside the OAU campus polygon. |
| `422` | `low_accuracy` | The GPS fix is fuzzier than 50 m, so it is not stored or drawn. |

The OAU boundary is checked before accuracy, so a position outside campus always returns `403 outside_oau` even when the fix is coarse.

### Rider snapshot

```json
{
  "timestamp": 1795423766876,
  "riders": [
    {
      "id": "rider-abc123",
      "lat": 7.51935,
      "lng": 4.52805,
      "speed": 30,
      "heading": 45,
      "accuracy": 8,
      "lastUpdated": 1795423766864,
      "path": [[7.5186, 4.5273], [7.51885, 4.52755]]
    }
  ]
}
```

`path` is an ordered `[lat, lng]` list, oldest first.

---

## CLI smoke test

```bash
# Start sharing: four pings along a short path.
for i in 0 1 2 3; do
  curl -s -X POST http://localhost:3001/api/ping \
    -H "Content-Type: application/json" \
    -d "{\"riderId\":\"cli-rider\",\"lat\":$(node -e "console.log(7.5186 + $i*0.00025)"),\"lng\":$(node -e "console.log(4.5273 + $i*0.00025)"),\"speed\":30,\"heading\":45,\"accuracy\":8}"
  echo
done

# Outside OAU: rejected with 403 outside_oau and no dot.
curl -s -X POST http://localhost:3001/api/ping \
  -H "Content-Type: application/json" \
  -d '{"riderId":"cli-outside","lat":7.6000,"lng":4.6000,"accuracy":5}'

# Snapshot: one rider with four path points.
curl -s http://localhost:3001/api/riders

# Stop sharing: the rider and trail are removed.
curl -s -X POST http://localhost:3001/api/exit \
  -H "Content-Type: application/json" \
  -d '{"riderId":"cli-rider"}'
```

A repeated ping at the same coordinates does not add a path point.

---

## Project layout

```
campusmove/
├── start.js                  # runs API + Vite together
├── server/
│   └── src/
│       ├── index.js          # Express API, rider store, SSE, cleanup
│       ├── oau.js            # OAU campus polygon and inside-OAU test
│       └── geo.js            # haversine distance helper
└── client/
    ├── index.html
    ├── tailwind.config.js
    └── src/
        ├── App.tsx           # riders state, SSE, empty state, preview ride
        ├── previewRoute.ts   # bundled campus loop for the local preview
        ├── types.ts          # Rider and PathPoint types
        ├── index.css         # base styles, rider pulse, Leaflet overrides
        ├── tailwind.css      # Tailwind input directives
        ├── tailwind.generated.css  # committed, CDN-free utility build
        └── components/
            ├── MapView.tsx      # OSM map, green dots, trail polylines
            ├── TopBar.tsx       # rider count and IDLE/LIVE/PREVIEW badges
            ├── PreviewPanel.tsx # local-only preview panel and STOP
            └── RiderToggle.tsx  # geolocation watch, pings, stop sharing
```

---

## Honest limitations

- **In-memory only.** Restarting the API clears all riders and trails.
- **Coverage depends on riders.** With nobody sharing, the map is empty by design.
- **Trails are drawn from raw GPS.** There is no snapping to roads, so a noisy fix can make the line wobble; the 50 m accuracy filter keeps the worst fixes off the map.
- **The OAU boundary is mapped from OpenStreetMap.** It follows the university polygon, so a position just outside the mapped perimeter is rejected even if it is physically on university land.
- **Precision depends on the device.** A laptop using Wi-Fi positioning may never reach 50 m accuracy and will stay at “Getting a precise GPS fix”; a phone with GPS works best outdoors.
- **Some devices have no location source at all.** A desktop, VM, or laptop without GPS and without a working browser location provider cannot share. After two failures the app stops and says “No location received” instead of waiting forever.
- **No identity or moderation.** Each tap creates an anonymous random rider ID. Nothing prevents someone from spoofing a location inside campus.
- **Network dependencies.** The UI styles and Leaflet CSS are bundled locally, but OpenStreetMap **tiles** still need internet. A fully offline deployment needs local tiles.
- **HTTPS matters.** Browser geolocation requires a secure context; use `localhost` for development or serve over HTTPS on a phone.
- **No automated tests yet.** The CLI smoke test above is manual.

### Natural next steps

1. Persist riders and trails (SQLite/Postgres).
2. Smooth and simplify trails before drawing them.
3. Add rate limiting and basic abuse protection.
4. Self-host map tiles for low-data or offline use.
