export const ORIGIN = { lat: 38.27982, lon: 27.15226 };
const R = 6378137;
const DEG = Math.PI / 180;
const COS = Math.cos(ORIGIN.lat * DEG);
const ox = R * ORIGIN.lon * DEG;
const oy = R * Math.log(Math.tan(Math.PI / 4 + ORIGIN.lat * DEG / 2));
export function local(lat: number, lon: number): [number, number] {
  return [(R * lon * DEG - ox) * COS, (oy - R * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2))) * COS];
}
export function geographic(x: number, z: number) {
  return { lon: (x / COS + ox) / R / DEG, lat: (2 * Math.atan(Math.exp((oy - z / COS) / R)) - Math.PI / 2) / DEG };
}
export function tileOf(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom, r = Math.max(-85, Math.min(85, lat)) * DEG;
  return { x: (lon + 180) / 360 * n, y: (1 - Math.asinh(Math.tan(r)) / Math.PI) / 2 * n };
}
export function tileCorner(x: number, y: number, zoom: number) {
  const n = 2 ** zoom;
  return local(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) / DEG, x / n * 360 - 180);
}
export const AIRPORT_CENTER = local(38.289, 27.1518);
export const FACILITY_CENTER: [number, number] = local(38.27982, 27.15222);
export const TILE_URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';
