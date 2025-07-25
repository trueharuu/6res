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

export class Bot {
  public fps: number = 60;
  public pps: number = 4;
  public burst: number = 6;
  public vision: number = 7;
  public foresight: number = 0;
  public spool!: ChildProcessWithoutNullStreams;
  private buffer = "";
  private resolver: ((s: string) => void) | null = null;
  public can180: boolean = true;
  public finesse: string = "human";

  public bursting: boolean = false;

  public local_pps(): number {
    if (this.bursting) {
      return this.burst;
    }

    return this.pps;
  }

  public constructor(public room: Room) {
    this.reset();
  }

  private acc: number = 0;
  public async tick(c: Types.Game.Tick.In) {
    if (c.engine.stats.combo < 100) {
      this.bursting = true;
    } else {
      this.bursting = false;
    }

    this.acc += this.local_pps() / this.fps;

    const keys: Array<KeyPress> = [];

    while (this.acc >= 1) {
      let ks = await this.key_queue(c.engine);
      ks.push("hardDrop");
      ks = ks.flatMap((x) => ["softDrop", x]);
      keys.push(...this.key_presses(ks, c.frame));
      // tracing.info(ks, keys);

      this.acc -= 1;
    }

    return { keys };
  }

  public key_presses(ks: Array<Key>, frame: number): Array<KeyPress> {
    const keys: Array<KeyPress> = [];
    if (this.finesse === "human") {
      // if playing at `p` pps then each input should take `fps/pps/n` frames for a piece that needs `n` inputs
      let delta = this.fps / this.local_pps() / ks.length;
      for (let i = 0; i < ks.length; i++) {
        const whole = frame + Math.floor(i * delta);
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
    } else if (this.finesse === "instant") {
      let r_subframe = 0;
      for (const key of ks) {
        keys.push({
          frame,
          type: "keydown",
          data: { key, subframe: r_subframe },
        });

        if (key === "softDrop") {
          r_subframe += 0.1;
        }

        keys.push({
          frame,
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

  public async key_queue(engine: Engine): Promise<Array<Key>> {
    const b = engine.board.state
      .map((x) => x.map((y) => (y === null ? "_" : "X")).join(""))
      .toReversed()
      .join("|");
    const q = (
      engine.falling.symbol + engine.queue.value.join("")
    ).toUpperCase();
    const h = engine.held?.toUpperCase() || "_";
    const z = this.can180 ? 1 : 0;
    const input = `${b} ${q} ${h} ${this.vision} ${this.foresight} ${z}`;
    const t = await this.send(input);
    // tracing.debug("recv", t);
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
