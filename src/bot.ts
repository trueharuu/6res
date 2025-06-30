import { Room } from "@haelp/teto/dist/types/classes";
import { Board, Mino } from "@haelp/teto/dist/types/engine";
import { Game } from "@haelp/teto/dist/types/types";

export enum FinesseStyle {
  SRS,
  SRS180,
  SRSX,
  Instant,
}

export interface State {
  board: Board;
  hold: Mino | null;
  queue: Array<Mino>;
}

export interface Placement {
  x: number;
  y: number;
  rotation: Rotation;
  mino: Mino;
}

export enum Rotation {
  North,
  East,
  South,
  West,
}

export class Bot {
  public finesse: FinesseStyle = FinesseStyle.Instant;
  public vision: number = 7; // please lower. bot is invincible otherwise.
  public pps: number = 2;
  public fps: number = 60; // ?

  public constructor(public readonly room: Room) {}

  public best_placement(state: State): Placement {
    throw new Error("unimplemented!");
  }
  public get_finesse(placement: Placement) {
    throw new Error("unimplemented!");
  }

  public should_place(frame: number): boolean {
    return frame % (this.fps / this.pps) === 0;
  }

  public tick(n: number, state: State): Game.Tick.Out {
    // @usMath: do things here
    return {};
  }

  public frame_inputs(
    inputs: Array<Game.Key>,
    base: number,
  ): Game.Tick.Keypress[] {
    if (this.finesse === FinesseStyle.Instant) {
      return inputs.flatMap((x) => [
        { data: { key: x, subframe: 0.0 }, frame: base, type: "keydown" },
        { data: { key: x, subframe: 0.0 }, frame: base, type: "keyup" },
      ]);
    }
    // if playing at N pps it should take `fps/n` frames per piece
    const total_frames = this.pps / this.pps;

    // if finesse takes T steps then each step should take `total_frames/T` frame per input
    const input_step = total_frames / inputs.length;
    let current = 0;
    const frames: Game.Tick.Keypress[] = [];
    for (const input of inputs) {
      const whole = Math.trunc(current);
      const fract = current - whole;
      frames.push({
        data: { key: input, subframe: fract },
        frame: whole + base,
        type: "keydown",
      });
      frames.push({
        data: { key: input, subframe: fract + 0.1 },
        frame: whole + base,
        type: "keyup",
      });
      current += input_step;
    }

    return frames;
  }
}
