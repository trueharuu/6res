import { Mino, Rotation } from "@haelp/teto/dist/types/engine";

export interface Placement {
  x: number;
  y: number;
  rotation: Rotation;
  mino: Mino;
  should_hold: boolean;
}

export interface Coordinate {
  x: number;
  y: number;
}
export interface Kick {
  piece: Mino;
  initial: Rotation;
  final: Rotation;
  kicks: Array<Coordinate>;
}

export enum Key {
  HardDrop,
  SoftDrop,
  CW,
  CCW,
  Flip,
  MoveLeft,
  MoveRight,
  Hold,
}
