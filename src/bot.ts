import type { Room } from "@haelp/teto/dist/types/classes";
import type { Board } from "@haelp/teto/dist/types/engine";
import type { Game } from "@haelp/teto/dist/types/types";
import type { Placement } from "./input";
import { permutations } from "./util";
import { Engine } from "@haelp/teto";
import { path } from "./path";

export enum FinesseStyle {
  SRS = "srs",
  SRS180 = "srs180",
  SRSX = "srsx",
  Instant = "instant",
}

export interface State {
  board: Board;
  hold: Engine.Mino | null;
  current: Engine.Mino;
  queue: Array<Engine.Mino>;
  engine: Engine.Engine;
  frame: number;
}

export enum Phase {
  Opener,
  Midgame,
}

export class Bot {
  public finesse: FinesseStyle = FinesseStyle.SRSX;
  // number of pieces to look ahead in queue
  public vision: number = 7;
  // number of pieces to guess about after `vision`
  public foresight: number = 2;
  public pps: number = 2;
  public fps: number = 60; // ?

  public constructor(public readonly room: Room) {}

  public best_placement(state: State): Placement {
    const p = path(
      state.board.state,
      state.queue,
      this.vision,
      this.foresight,
    );
    if (p.length > 0) {
      return p[0];
    }
    
    fallback: {
      const s = state.engine.snapshot();
      state.engine.press("softDrop");
      const p = state.engine.falling.symbol;
      const x = state.engine.falling.x;
      const y = state.engine.falling.y;
      const r = state.engine.falling.rotation;
      state.engine.fromSnapshot(s);
      return { mino: p, rotation: r, x, y };
    }
  }

  public usable_inputs(): Set<Game.Key> {
    const t: Set<Game.Key> = new Set();
    t.add("moveLeft");
    t.add("moveRight");
    t.add("rotateCCW");
    t.add("rotateCW");
    t.add("softDrop");

    if (this.finesse !== FinesseStyle.SRS) {
      t.add("rotate180");
    }

    return t;
  }

  public max_kpp(): number {
    return 6;
  }

  public get_finesse(
    placement: Placement,
    state: State,
    should_hold: boolean,
  ): Array<Game.Key> {
    const t: Array<Game.Key> = [];

    const ui = this.usable_inputs();
    a: for (let n = 1; n <= this.max_kpp(); n++) {
      for (const seq of permutations(ui, n)) {
        if (should_hold) {
          seq.unshift("hold");
        }
        const prev = state.engine.snapshot();
        for (const key of seq) {
          state.engine.press(key);
        }
        // console.log(
        //   "seq",
        //   seq,
        //   "->",
        //   "x",
        //   state.engine.falling.x,
        //   "y",
        //   state.engine.falling.y,
        //   "r",
        //   state.engine.falling.rotation,
        // );

        const falling = state.engine.falling;
        if (
          falling.x === placement.x &&
          falling.y === placement.y &&
          falling.rotation === placement.rotation
        ) {
          t.push(...seq);
          state.engine.fromSnapshot(prev);
          break a;
        }

        state.engine.fromSnapshot(prev);
      }
    }
    t.push("hardDrop");

    return t;
  }

  public should_place(state: State): boolean {
    return state.frame % (this.fps / this.pps) === 0;
  }

  public tick(state: State): Game.Tick.Out {
    if (this.should_place(state)) {
      const placement = this.best_placement(state);
      const should_hold = placement.mino !== state.current;
      const inputs = this.get_finesse(placement, state, should_hold);
      console.log("inputs", inputs);
      return { keys: this.frame_inputs(state, inputs) };
    }

    return {};
  }

  public frame_inputs(
    state: State,
    inputs: Array<Game.Key>,
  ): Game.Tick.Keypress[] {
    // if playing at N pps it should take `fps/n` frames per piece
    const total_frames = this.fps / this.pps;

    // if finesse takes T steps then each step should take `total_frames/T` frame per input
    const input_step = total_frames / inputs.length;
    let current = 0;
    const frames: Game.Tick.Keypress[] = [];
    for (const input of inputs) {
      const whole = Math.trunc(current);
      const fract = current - whole;
      frames.push({
        data: { key: input, subframe: fract },
        frame: whole + state.frame,
        type: "keydown",
      });
      frames.push({
        data: { key: input, subframe: fract },
        frame: whole + state.frame + 1,
        type: "keyup",
      });
      current += input_step;
    }

    return frames;
  }
}
