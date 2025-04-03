import { Board, Piece, Placement, Key, Rotation } from "./defs";
import { opener_db } from "./opener_db";
import { call } from "./tools";

export interface EngineSettings {
  // the base speed the engine will play at.
  pps: number;

  // frames per second.
  fps: number;

  // the maximum amount of piece previews the bot is allowed to use for combo.
  previews: number;

  // the maximum amount of *extra* previews that the bot could consider for later combos
  // this does NOT use the actual queue, and will instead try all possible bags of this size as an extra consideration
  guesses: number;

  // whether or not the bot should use SRS-X 180 rotation teleports. keep this enabled for swag points.
  teleports: boolean;
}

export interface Context {
  board: Board;
  queue: Array<Piece>;
  hold: Piece | undefined;
  opener_phase: boolean;
  bursting: boolean;
  frame: number;
}

export class Engine {
  public constructor(
    public settings: EngineSettings,
    public context: Context,
  ) {}

  // these should *eventually* be performed. all `HardDrop` inputs should be sent to fit exactly `pps` (pieces per second)
  // all inputs in-between `HardDrop` inputs should be spaced evenly between the `pps` intervals.
  // ie. if `pps=1`, and `[CW, CW, HardDrop, CW, HardDrop]`, the whole sequence up to the first `HardDrop` should take 1 second
  // but each input within it should be 0.333 seconds apart. the same is true for the second series of inputs up to the 2nd `HardDrop`
  // with each input being 0.5s apart.
  public input_queue: Array<Key> = [];
  public rel_input_pos: number = 0;
  public last_drop_frame: number = 0;

  public async loop() {
    console.log("frame", this.context.frame);
    // console.log(this.input_queue);
    if (this.input_queue.length === 0) {
      const placement = this.best_placement();
      if (placement) {
        this.input_queue = this.finesse(placement);
        console.log(placement);
        console.log(this.input_queue);
        this.context.queue.shift();
      } else {
        return;
      }
    }

    const frames_per_drop = this.settings.fps / this.settings.pps;
    const frames_per_input = frames_per_drop / this.input_queue.length;

    const rel_frame = this.context.frame - this.last_drop_frame;

    if (rel_frame % frames_per_input === 0) {
      const key = this.input_queue[this.rel_input_pos++];
      this.send(key);

      if (key === Key.HardDrop) {
        console.log("placed piece!");
        this.last_drop_frame = this.context.frame;
        this.rel_input_pos = 0;
        this.input_queue = [];
      }
    }
  }

  public async start() {
    while (true) {
      if (this.context.frame > 60) {
        break;
      }
      this.loop();
      this.context.frame++;
      this.sync(this.context);
    }
  }

  // determine the objective best placement for the piece in either the current or hold queue.
  public best_placement(): Placement | undefined {
    const allowed_pieces = this.context.queue.slice(0, this.settings.previews);

    if (allowed_pieces.length === 0) { 
        return undefined;
    }

    const z = call(
      `C:\\Users\\mina\\projects\\sfce\\target\\debug\\sfce.exe -w4 -h20 --raw --no-hold -k ${this.settings.teleports ? "srsx" : "srs"} -y move -t "${this.context.board
        .map((x) => x.map((y) => (y ? "G" : "E")).join(""))
        .join("|")}" -p ${allowed_pieces.join("")} -q 1`,
    );
    const options = z.trim().split("\n");

    // combo broke.
    if (options.length === 0) {
      return undefined;
    }

    const placements = options[0].trim().split(";").filter(x=>x);
    if (placements.length === 0) {
        return undefined;
    }
    const first_placement = placements[0];
    const [piece, x, y, rotation] = first_placement.split(",");

    return { piece: piece as Piece, x: Number(x), y: Number(y), rotation: rotation as Rotation };
  }

  // combo calculations are significantly easier whne you only have 3/4/5/6 minos
  public relevant_board_state(): Board {
    const highest_nonair_spot = this.context.board.findIndex((x) =>
      x.some((y) => y),
    );
    const nb = this.context.board.slice(
      highest_nonair_spot,
      highest_nonair_spot + 2,
    );
    return nb;
  }

  public finesse(placement: Placement): Array<Key> {
    return [
      ...(call(
        `C:\\Users\\mina\\projects\\sfce\\target\\debug\\sfce.exe -w4 -k ${this.settings.teleports ? "srsx" : "srs"} -y inputs -t "${this.context.board
          .map((x) => x.map((y) => (y ? "G" : "E")).join(""))
          .join(
            "|",
          )}" -p${placement.piece} -x${placement.x} -y${placement.y} -r${placement.rotation}`,
      )
        .trim()
        .split(",") as Array<Key>),
      Key.HardDrop,
    ];
  }

  // sends a single input to the game
  public async send(key: Key) {
    console.log(`sending ${key}`);
  }

  // attempt to recieve the current board and next/hold queues
  public async sync(context: Context) {
    this.context = context;
  }

  // finds a recommended set of placements during the opener phase
  public opener(queue: Array<Piece>): Array<Placement> {
    return opener_db.find((x) =>
      x.queues.some((x) => x.join("") === queue.join("")),
    )!.placements;
  }
}
