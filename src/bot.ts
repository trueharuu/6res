import { execSync, spawn, spawnSync } from "node:child_process";
import { Engine, Key, Room } from "./ty";
import { tracing } from "./tracing";

export class Bot {
  public fps: number = 60;
  public pps: number = 2;
  public vision: number = 6;
  public foresight: number = 1;
  private spool;
  private buffer = "";
  private resolver: ((s: string) => void) | null = null;

  public constructor(public room: Room) {
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

  public async send(input: string): Promise<string | null> {
    tracing.info('send', input);
    if (this.resolver) {
      return null;
    }

    // const input = "";
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.spool.stdin.write(input + "\n", "utf-8", (c) => {});
      return;
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
    const input = `${b} ${q} ${h} ${this.vision} ${this.foresight}`;
    const t = await this.send(input);
    tracing.info('recv', t)
    if (t) {
      const [piece, fin] = t.split(" ");
      const finesse = (fin || "").split(",").filter(x=>!!x) as Key[];
      tracing.info(piece, finesse);

      return finesse;
    }
    return [];
  }
}
