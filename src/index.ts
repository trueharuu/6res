import { Piece } from "./defs";
import { Context } from "./engine";

const initial: Context = {
    board: Array(26).fill(Array(4).fill(false)),
    bursting: false,
    frame: 0,
    hold: undefined,
    opener_phase: false,
    queue: [Piece.I, Piece.O, Piece.Z],
}