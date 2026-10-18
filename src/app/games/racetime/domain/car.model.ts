// Car state and configuration types.
// Sprite data uses a string grid where each character maps to a color key.

export interface CarColors {
  readonly body: string;
  readonly bodyDark: string;
  readonly accent: string;
  readonly outline: string;
  readonly wheels: string;
  readonly glass: string;
  readonly glassGlint: string;
  readonly taillight: string;
}

export interface CarSprite {
  readonly width: number;
  readonly height: number;
  readonly pixels: readonly string[];
  readonly colorMap: Record<string, string>;
}

export interface CarConfig {
  readonly id: string;
  readonly name: string;
  readonly colors: CarColors;
  readonly sprite: CarSprite;
}

export interface CarState {
  distance: number;
  speed: number;
  railPosition: number;
  isAccelerating: boolean;
  isGlued: boolean;
  steerInput: number;
  lapCount: number;
}

export interface CarPhysicsConfig {
  readonly maxSpeed: number;
  readonly acceleration: number;
  readonly deceleration: number;
  readonly steerSpeed: number;
  readonly centrifugalForceBase: number;
  readonly recoverySpeed: number;
  readonly frictionCurve: number;
  readonly wallSpeedPenalty: number;
  readonly gripStrength: number;
}