export type PathPoint = [number, number];

export interface Rider {
  id: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  accuracy: number | null;
  lastUpdated: number;
  path: PathPoint[];
}
