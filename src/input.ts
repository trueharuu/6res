import { Mino, Rotation } from "./ty";

export type Placement = {
  x: number;
  y: number;
  rotation: Rotation;
  mino: Mino;
};

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
