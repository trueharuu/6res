import { execSync, spawnSync } from "node:child_process";
import { Engine, Key, Room } from "./ty";

export class Bot {
  public fps: number = 60;
  public pps: number = 2;
  public vision: number = 6;
  public foresight: number = 1;

  public constructor(public room: Room) {}

  public key_queue(engine: Engine): Array<Key> {
    const board = engine.board.state
      .map((x) => x.map((y) => (y === null ? "_" : "X")).join("")).reverse()
      .join("|");
    const queue = engine.falling.symbol.toUpperCase() + engine.queue.value.join("").toUpperCase();
    const hold = engine.held?.toUpperCase() || "_";
    const cmd = `py C:\\Users\\mina\\projects\\6res\\tetris-4w-solver\\cio.py "${board}" "${queue}" "${hold}" ${this.vision} ${this.foresight}`;
    // console.log(cmd);
    const t = execSync(cmd).toString().trim();

    
    // console.log(e);
    console.log(t);
    const [piece, f] = t.split("\n");
    // console.log(piece, f);
    const finesse = (f ?? "").split(",").filter((x) => !!x);

    return finesse as Array<Key>;
  }
}
