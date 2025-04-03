export interface Placement {
  piece: Piece;
  x: number;
  y: number;
  rotation: Rotation;
}

export enum Piece {
  I = 'I',
  J = 'J',
  O = 'O',
  L = 'L',
  Z = 'Z',
  S = 'S',
  T = 'T',
}

export enum Rotation {
  North = 'N',
  East = 'E',
  South = 'S',
  West = 'W',
}

export enum Key {
  HardDrop = "hd",
  SoftDrop = "sf",
  MoveLeft = "l",
  DasLeft = "dl",
  MoveRight = "r",
  DasRight = "dr",
  CW = "cw",
  CCW = "ccw",
  SonicDrop = "sd",
  Flip = "f",
}

export type Board = Array<Array<boolean>>;
