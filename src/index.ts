import { Piece, Rotation } from "./defs";
import { Context, Engine, EngineSettings } from "./engine";

const initial: Context = {
  board: [],
  bursting: false,
  frame: 0,
  hold: undefined,
  opener_phase: false,
  queue: [],
};

const settings: EngineSettings = {
  guesses: 0,
  fps: 60,
  pps: 3,
  previews: 0,
  teleports: false,
};

const engine = new Engine(settings, initial);

engine.start();
