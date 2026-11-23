const express = require('express');
const cors = require('cors');
const { haversineDistanceMeters } = require('./geo');
const { isInsideOAU } = require('./oau');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// riderId -> { id, lat, lng, speed, heading, lastUpdated, path }
const riders = new Map();
const sseClients = new Set();

const STALE_MS = 90_000;
const MAX_PATH_POINTS = 300;
const MIN_PATH_METERS = 5;
const MAX_ACCURACY_METERS = 50;

function round(value) {
  return Math.round(value * 1e6) / 1e6;
}

function cleanupRiders() {
  const now = Date.now();

  for (const [id, rider] of riders.entries()) {
    if (now - rider.lastUpdated > STALE_MS) {
      riders.delete(id);
    }
  }
}

function buildSnapshot() {
  cleanupRiders();

  return {
    timestamp: Date.now(),
    riders: Array.from(riders.values()).map((rider) => ({
      id: rider.id,
      lat: rider.lat,
      lng: rider.lng,
      speed: rider.speed,
      heading: rider.heading,
      accuracy: rider.accuracy,
      lastUpdated: rider.lastUpdated,
      path: rider.path
    }))
  };
}

function broadcast() {
  const payload = JSON.stringify(buildSnapshot());

  for (const res of sseClients) {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch (error) {
      sseClients.delete(res);
    }
  }
}

setInterval(broadcast, 1500);

// Health check.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CampusMove',
    sharing: riders.size,
    time: new Date().toISOString()
  });
});

// All live riders and their movement trails.
app.get('/api/riders', (req, res) => {
  res.json(buildSnapshot());
});

// A rider's live location ping.
app.post('/api/ping', (req, res) => {
  const { riderId, lat, lng, speed = 0, heading = 0, accuracy } = req.body;
  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (
    !riderId ||
    !Number.isFinite(latNum) ||
    !Number.isFinite(lngNum) ||
    Math.abs(latNum) > 90 ||
    Math.abs(lngNum) > 180
  ) {
    return res.status(400).json({ error: 'riderId and valid lat/lng are required' });
  }

  const accuracyNum =
    accuracy === undefined || accuracy === null ? null : Number(accuracy);

  if (accuracyNum !== null && (!Number.isFinite(accuracyNum) || accuracyNum < 0)) {
    return res.status(400).json({
      error: 'invalid_accuracy',
      message: 'accuracy must be a non-negative number of meters'
    });
  }

  // The map only covers OAU. Anything outside is rejected without being
  // stored, so no dot or trail can appear outside the campus.
  if (!isInsideOAU(latNum, lngNum)) {
    return res.status(403).json({
      error: 'outside_oau',
      message: 'Location is outside OAU campus. Sharing works only inside OAU.'
    });
  }

  // Reject fuzzy fixes so the green dot is always a precise position.
  if (accuracyNum !== null && accuracyNum > MAX_ACCURACY_METERS) {
    return res.status(422).json({
      error: 'low_accuracy',
      message: `GPS accuracy must be within ${MAX_ACCURACY_METERS} m.`
    });
  }

  const now = Date.now();
  const point = [round(latNum), round(lngNum)];
  const speedKmh = Math.max(0, Number(speed) || 0);
  const headingDeg = Number(heading) || 0;
  const accuracyMeters = accuracyNum === null ? null : Math.round(accuracyNum);
  let rider = riders.get(String(riderId));

  if (!rider) {
    rider = {
      id: String(riderId),
      lat: point[0],
      lng: point[1],
      speed: speedKmh,
      heading: headingDeg,
      accuracy: accuracyMeters,
      lastUpdated: now,
      path: [point]
    };
    riders.set(rider.id, rider);
  } else {
    const lastPoint = rider.path[rider.path.length - 1];

    if (
      !lastPoint ||
      haversineDistanceMeters(lastPoint, point) >= MIN_PATH_METERS
    ) {
      rider.path.push(point);

      if (rider.path.length > MAX_PATH_POINTS) {
        rider.path.shift();
      }
    }

    rider.lat = point[0];
    rider.lng = point[1];
    rider.speed = speedKmh;
    rider.heading = headingDeg;
    rider.accuracy = accuracyMeters;
    rider.lastUpdated = now;
  }

  broadcast();
  res.json({
    status: 'sharing',
    riderId: rider.id,
    pathPoints: rider.path.length,
    accuracy: rider.accuracy,
    insideOau: true
  });
});

// Stop sharing: remove the rider and trail immediately.
app.post('/api/exit', (req, res) => {
  const { riderId } = req.body;

  if (riderId) {
    riders.delete(String(riderId));
    broadcast();
  }

  res.json({ status: 'stopped' });
});

// Live updates over SSE.
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.write('\n');
  sseClients.add(res);
  res.write(`data: ${JSON.stringify(buildSnapshot())}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CampusMove API running on http://0.0.0.0:${PORT}`);
  console.log('📡 Waiting for riders to share their location');
});

function shutdown() {
  for (const res of sseClients) {
    try {
      res.end();
    } catch (error) {
      // ignore
    }
  }

  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
