/**
 * A short road-following loop through the centre of OAU, used only by the
 * local preview ride. It is never sent to the API.
 * Geometry generated with OSRM from OpenStreetMap road data.
 */
export const PREVIEW_ROUTE: [number, number][] = [
  [7.519037, 4.527393],
  [7.519203, 4.5266],
  [7.519271, 4.526609],
  [7.519358, 4.526619],
  [7.519576, 4.526629],
  [7.520823, 4.526913],
  [7.520722, 4.527448],
  [7.520738, 4.52783],
  [7.521755, 4.528087],
  [7.521822, 4.528126],
  [7.521857, 4.528198],
  [7.521866, 4.528246],
  [7.52184, 4.528403],
  [7.521812, 4.528565],
  [7.521787, 4.528716],
  [7.521758, 4.528883],
  [7.521733, 4.529033],
  [7.5216, 4.529353],
  [7.520609, 4.529194],
  [7.52052, 4.529142],
  [7.52052, 4.529142],
  [7.520489, 4.529068],
  [7.520563, 4.528962],
  [7.520631, 4.528569],
  [7.520738, 4.52783],
  [7.520722, 4.527448],
  [7.520823, 4.526913],
  [7.519576, 4.526629],
  [7.519358, 4.526619],
  [7.519271, 4.526609],
  [7.519203, 4.5266],
  [7.519147, 4.526591],
  [7.519075, 4.526579],
  [7.518893, 4.526574],
  [7.518064, 4.526408],
  [7.517415, 4.526298],
  [7.517353, 4.526688],
  [7.517284, 4.527131],
  [7.517159, 4.5279],
  [7.517255, 4.527913],
  [7.517355, 4.527953],
  [7.517428, 4.528032],
  [7.517374, 4.528969],
  [7.517374, 4.529857],
  [7.517409, 4.529948],
  [7.517539, 4.530011],
  [7.517748, 4.530031],
  [7.518528, 4.530118],
  [7.518878, 4.530155],
  [7.519465, 4.530213],
  [7.519443, 4.530358],
  [7.51939, 4.530697],
  [7.519369, 4.530836],
  [7.519684, 4.530854],
  [7.519735, 4.530828],
  [7.519767, 4.530774],
  [7.519767, 4.530774],
  [7.519772, 4.530737],
  [7.519826, 4.530325],
  [7.519825, 4.530285],
  [7.519807, 4.530254],
  [7.519781, 4.530241],
  [7.519465, 4.530213],
  [7.518878, 4.530155],
  [7.518528, 4.530118],
  [7.518608, 4.529516],
  [7.518601, 4.529449],
  [7.518513, 4.529202],
  [7.518471, 4.529152],
  [7.518413, 4.529124],
  [7.517837, 4.529052],
  [7.517788, 4.529041],
  [7.517502, 4.528991],
  [7.517374, 4.528969],
  [7.517428, 4.528032],
  [7.517355, 4.527953],
  [7.517255, 4.527913],
  [7.517159, 4.5279],
  [7.517284, 4.527131],
  [7.517353, 4.526688],
  [7.517415, 4.526298],
  [7.518064, 4.526408],
  [7.518893, 4.526574],
  [7.519075, 4.526579],
  [7.519147, 4.526591],
  [7.519203, 4.5266],
  [7.519037, 4.527393]
];

export const PREVIEW_ROUTE_METERS = 3214;
export const PREVIEW_SPEED_KMH = 29;
export const PREVIEW_STEP_METERS = 8;

function distanceMeters(a: [number, number], b: [number, number]): number {
  const R = 6371e3;
  const phi1 = (a[0] * Math.PI) / 180;
  const phi2 = (b[0] * Math.PI) / 180;
  const deltaPhi = ((b[0] - a[0]) * Math.PI) / 180;
  const deltaLambda = ((b[1] - a[1]) * Math.PI) / 180;

  const h =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function bearingDegrees(
  a: [number, number],
  b: [number, number]
): number {
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const deltaLambda = ((b[1] - a[1]) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLambda);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Resample the loop into points roughly PREVIEW_STEP_METERS apart so the
 * preview dot moves at a steady, realistic pace.
 */
export function buildPreviewTrack(): [number, number][] {
  const track: [number, number][] = [];

  for (let i = 0; i < PREVIEW_ROUTE.length - 1; i += 1) {
    const a = PREVIEW_ROUTE[i];
    const b = PREVIEW_ROUTE[i + 1];
    const steps = Math.max(
      1,
      Math.round(distanceMeters(a, b) / PREVIEW_STEP_METERS)
    );

    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      track.push([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t
      ]);
    }
  }

  track.push(PREVIEW_ROUTE[PREVIEW_ROUTE.length - 1]);
  return track;
}
