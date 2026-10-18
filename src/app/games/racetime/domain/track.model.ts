// Track geometry types used by the physics engine and renderers.
// Independent of any framework or rendering technology.

export interface TrackWaypoint {
  readonly x: number;
  readonly y: number;
  readonly radius: number; // curve radius at this point, 0 = straight
}

export interface TrackInfo {
  readonly x: number;
  readonly y: number;
  readonly tangentAngle: number;
  readonly curvature: number;
  readonly outwardX: number;
  readonly outwardY: number;
  readonly isCurve: boolean;
}

export interface RailPosition {
  readonly x: number;
  readonly y: number;
  readonly tangentAngle: number;
  readonly curvature: number;
  readonly outwardX: number;
  readonly outwardY: number;
}

export interface TrackConfig {
  readonly id: string;
  readonly name: string;
  readonly waypoints: readonly TrackWaypoint[];
  readonly totalLaps: number;
  readonly railSpacing: number;
  readonly wallMargin: number;
}