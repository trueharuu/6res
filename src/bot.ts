import {
  ChildProcessWithoutNullStreams,
  execSync,
  spawn,
  spawnSync,
} from "node:child_process";
import { Engine, Key, KeyPress, Room } from "./ty";
import { tracing } from "./tracing";
import { Types } from "@haelp/teto";
import { check_settings } from "./check";
import { ty } from "./util";

export enum FinesseStyle {
  Human = "human",
  Instant = "instant",
}

export enum Pace {
  Normal,
  Burst,
  Slack,
}

export interface BotOptions {
  pps: number;
  burst: number;
  slack: number;
  vision: number;
  foresight: number;
  can180: boolean;
  finesse: FinesseStyle;
  start_threshold: number;
  break_threshold: number;
  garbage_threshold: number;
  gb_weight: number;
  pace: boolean;
  upstack: boolean;
}

export const option_descriptions: Record<keyof BotOptions, string> = {
  pps: "pieces per second during [normal] pace",
  burst: "pieces per second during [burst] pace",
  slack: "pieces per second during [slack] pace",
  vision: "amount of pieces in the queue to consider",
  foresight:
    "the amount of pieces after [vision] to guess for in order to break ties",
  can180: "whether to do 180s",
  finesse: 'style of placements; either "human" or "instant"',
  start_threshold:
    "amount of pieces at the start of the round to stay in [burst]",
  break_threshold:
    "the amount of pieces after breaking combo to stay in [slack]",
  garbage_threshold:
    "amount of incoming garbage to be okay with before changing pace",
  gb_weight:
    "determines behaviour for when recieving garbage. negative to enter [slack], positive to enter [burst].",
  pace: "whether to enable pacing with [burst], [slack], and any threshold options",
  upstack: "whether to stack up ever",
};

export class Bot {
  public fps: number = 60;
  public spool!: ChildProcessWithoutNullStreams;
  private buffer = "";
  private resolver: ((s: string) => void) | null = null;

  public options: BotOptions = {
    pps: 4,
    burst: 4,
    slack: 4,
    vision: 7,
    foresight: 1,
    can180: true,
    finesse: FinesseStyle.Human,
    start_threshold: 100,
    break_threshold: 10,
    garbage_threshold: 260,
    gb_weight: -1,
    pace: false,
    upstack: true,
  };

  // dawg what the fuckkkkkkkkk
  public local_pps(c: Types.Game.Tick.In): number {
    if (!this.options.pace) {
      return this.options.pps;
    }

    if (c.engine.garbageQueue.size > this.options.garbage_threshold) {
      if (this.options.gb_weight > 0) {
        return (
          this.options.pps +
          this.options.gb_weight * (this.options.burst - this.options.pps)
        );
      }

      if (this.options.gb_weight < 0) {
        return (
          this.options.pps +
          this.options.gb_weight * (this.options.slack - this.options.pps)
        );
      }
    }

    if (c.engine.stats.pieces < this.options.start_threshold) {
      return this.options.burst;
    }

    if (c.engine.stats.combo < this.options.break_threshold) {
      return this.options.slack;
    }

    return this.options.pps;
  }

  public mino_count(c: Types.Game.Tick.In): number {
    return c.engine.board.state.flat().filter((x) => x !== null).length;
  }

  public should_upstack(c: Types.Game.Tick.In): boolean {
    if (!this.options.upstack) {
      return false;
    }

    const ctr = this.mino_count(c);

    // // if (c.engine.garbageQueue.size > this.room.options.garbagecap) {
    // //   return false;
    // // }

    if (c.engine.stats.combo > 7) {
      return false;
    }

    if (ctr >= 12) {
      return false;
    }

    return true;
  }

  public constructor(public room: Room) {
    this.reset();
  }

  private acc: number = 0;
  public async tick(c: Types.Game.Tick.In) {
    this.acc += this.local_pps(c) / this.fps;

    const keys: Array<KeyPress> = [];

    while (this.acc >= 1) {
      let ks = await this.key_queue(c);
      ks.push("hardDrop");
      ks = ks.flatMap((x) => ["softDrop", x]);
      keys.push(...this.key_presses(ks, c));
      // tracing.info(ks, keys);

      this.acc -= 1;
    }

    return { keys };
  }

  public key_presses(ks: Array<Key>, c: Types.Game.Tick.In): Array<KeyPress> {
    const keys: Array<KeyPress> = [];
    // keys.push({ frame: c.frame, data: { key: "softDrop", subframe: 0.0 }, type: 'keydown' });
    if (this.options.finesse === FinesseStyle.Human) {
      // if playing at `p` pps then each input should take `fps/pps/n` frames for a piece that needs `n` inputs
      let delta = this.fps / this.local_pps(c) / ks.length;
      for (let i = 0; i < ks.length; i++) {
        const whole = c.frame + Math.floor(i * delta);
        const fract = i * delta - Math.floor(i * delta);
        keys.push({
          frame: whole,
          data: { key: ks[i], subframe: fract },
          type: "keydown",
        });
        keys.push({
          frame: whole,
          data: { key: ks[i], subframe: fract + 0.1 },
          type: "keyup",
        });
      }
    } else if (this.options.finesse === FinesseStyle.Instant) {
      let r_subframe = 0;
      for (const key of ks) {
        keys.push({
          frame: c.frame,
          type: "keydown",
          data: { key, subframe: r_subframe },
        });

        if (key === "softDrop") {
          r_subframe += 0.1;
        }

        keys.push({
          frame: c.frame,
          type: "keyup",
          data: { key, subframe: r_subframe },
        });
      }
    }

    return keys;
  }

  public async reset() {
    this.acc = 0;
    this.spool = spawn("py", ["./tetris-4w-solver/cio.py"]);
    this.spool.stdout.setEncoding("utf-8");
    this.spool.stderr.setEncoding("utf-8");
    this.spool.stdout.on("data", (data) => {
      this.buffer += data;
      const lines = this.buffer.split("\n");
      if (lines.length > 1) {
        const line = lines[0].trim();
        this.buffer = lines.slice(1).join("\n");
        if (this.resolver) {
          this.resolver(line);
          this.resolver = null;
        }
      }
    });
  }

  public async send(input: string): Promise<string> {
    // tracing.debug("send", input);

    return new Promise<string>((resolve) => {
      this.resolver = resolve;
      this.spool.stdin.write(input + "\n", "utf-8");
    });
  }

  public async key_queue(c: Types.Game.Tick.In): Promise<Array<Key>> {
    const b = c.engine.board.state
      .map((x) => x.map((y) => (y === null ? "_" : "X")).join(""))
      .toReversed()
      .join("|");
    const q = (
      c.engine.falling.symbol + c.engine.queue.value.join("")
    ).toUpperCase();
    const h = c.engine.held?.toUpperCase() || "_";
    const z = this.options.can180 ? 1 : 0;
    const input = `ren ${b} ${q} ${h} ${this.options.vision} ${this.options.foresight} ${z} ${+this.should_upstack(c)}`;
    tracing.debug("send", input);
    const t = await this.send(input);
    tracing.debug("recv", t);
    if (t) {
      const [piece, fin] = t.split(" ");
      const finesse = (fin || "").split(",").filter((x) => !!x) as Key[];
      // tracing.debug(piece, finesse);
      return finesse;
    }
    return [];
  }

  public async save(): Promise<void> {
    await this.send("ex");
  }
}
