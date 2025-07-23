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
  public vision: number = 14;
  public foresight: number = 1;
  private spool!: ChildProcessWithoutNullStreams;
  private buffer = "";
  private resolver: ((s: string) => void) | null = null;
  public can180: boolean = true;
  public finesse: string = "human";

  public constructor(public room: Room) {
    this.reset();
  }

  private acc: number = 0;
  public async tick(c: Types.Game.Tick.In) {
    this.acc += this.pps / this.fps;

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
      let delta = this.fps / this.pps / ks.length;
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
    tracing.debug("send", input);

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
    tracing.debug("recv", t);
    if (t) {
      const [piece, fin] = t.split(" ");
      const finesse = (fin || "").split(",").filter((x) => !!x) as Key[];
      tracing.debug(piece, finesse);
      return finesse;
    }
    return [];
  }

  public async save(): Promise<void> {
    await this.send("ex");
  }

  public async handle_command(room: Room, command: Array<string>) {
    if (command[0] === "check") {
      const results = check_settings(room.options);

      if (results.length === 0) {
        await room.chat("all ok!");
        return;
      }

      await room.chat("something is bad! paste the following to apply fixes:");
      await room.chat("/set " + results.join(";"));
    }

    if (command[0] === "pps") {
      const n = Number(command[1]);
      if (Number.isNaN(n)) {
        return await room.chat("not a number");
      }

      if (n > 30) {
        return await room.chat("no! (pps must be <= 30)");
      }

      this.pps = n;
    }

    if (command[0] === "vision") {
      const n = Number(command[1]);
      if (Number.isNaN(n)) {
        return await room.chat("not a number");
      }

      if (n > 35 || n < 0) {
        return await room.chat("no! (vision must be <= 35)");
      }

      this.vision = n;
    }

    if (command[0] === "foresight") {
      const n = Number(command[1]);
      if (Number.isNaN(n)) {
        return await room.chat("not a number");
      }

      if (n > 7 || n < 0) {
        return await room.chat("no! (foresight must be <= 7)");
      }

      this.foresight = n;
    }

    if (command[0] === "can180") {
      const y = ["true", "1", "yes", "y"];
      const n = ["false", "0", "no", "n"];

      if (y.includes(command[1]?.toLowerCase())) {
        this.can180 = true;
      } else if (n.includes(command[1]?.toLowerCase())) {
        this.can180 = false;
      } else {
        return await room.chat("not a boolean");
      }
    }

    if (command[0] === "finesse") {
      if (command[1] === "human") {
        this.finesse = "human";
      } else if (command[1] === "instant") {
        this.finesse = "instant";
      } else {
        return await room.chat('no! (finesse must be one of: "human", "instant")')
      }
    }

    if (command[0] === "settings") {
      return await room.chat(
        `pps=${this.pps}; vision=${this.vision}; foresight=${this.foresight}; can180=${this.can180}; finesse=${this.finesse}`
      );
    }
  }
}
