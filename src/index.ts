import { Piece, Rotation } from "./defs";
import { Context, Engine, EngineSettings } from "./engine";
import { ribbon } from "./ribbon";

const engine = new Engine(
  {
    fps: 60,
    guesses: 1,
    pps: 1,
    previews: 7,
    teleports: true,
  },
  {
    board: [
        [false, false, false, false],
        [false, false, false, false],
        [false, false, false, false],
        [false, false, false, false],
        [ true,  true,  true, false],
        [ true,  true, false,  true],
        [ true, false,  true,  true],
        [ true, false,  true,  true],
        [ true, false,  true,  true],
        [ true, false,  true,  true],
    ],
    bursting: false,
    frame: 0,
    hold: undefined,
    opener_phase: false,
    queue: [Piece.L, Piece.Z],
  },
);

engine.start();

console.log(engine.best_placement());