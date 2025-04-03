export interface Placement {
    piece: Piece,
    x: number,
    y: number,
    rotation: Rotation,
}

export enum Piece {
    I, J, O, L, Z, S, T
}

export enum Rotation { North, East, South, West }

export enum Key { MoveLeft, MoveRight, SoftDrop, SonicDrop, HardDrop, CW, CCW, Flip, Hold }

export type Board = Array<Array<boolean>>;