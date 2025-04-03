import { Piece, Placement } from "./defs"

export interface Opener {
    placements: Array<Placement>,
    queues: Array<Array<Piece>>;
}
export const opener_db: Array<Opener> = []