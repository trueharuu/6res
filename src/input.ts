import { deepCopy, tetrominoes } from "@haelp/teto/engine";
import { BoardState, Cell, Key, Mino, Rotation, SpinBonuses } from "./ty";

export type Placement = {
  x: number;
  y: number;
  rotation: Rotation;
  mino: Mino;
};

export interface Coordinate {
  x: number;
  y: number;
}
export interface Kick {
  piece: Mino;
  initial: Rotation;
  final: Rotation;
  kicks: Array<Coordinate>;
}

export function kicktable(t: string): Array<Kick> {
  return t
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x !== "")
    .map((line) => {
      const [piece, , initial, final, , ...z] = line;
      const kicks = z
        .join("")
        .slice(1, -1)
        .split(")(")
        .map((x) => x.split(",").map(Number))
        .map(([x, y]) => ({ x, y }));
      const i = { N: 0, E: 1, S: 2, W: 3 }[initial] as Rotation;
      const f = { N: 0, E: 1, S: 2, W: 3 }[final] as Rotation;
      return {
        piece: piece.toLowerCase() as Mino,
        initial: i,
        final: f,
        kicks,
      };
    });
}

export interface PieceDef {
  piece: Mino;
  rotation: Rotation;
  cells: Array<Coordinate>;
}
export function piecetable(t: string): Array<PieceDef> {
  return t
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x !== "")
    .map((line) => {
      const [piece, , rotation, , ...z] = line;
      const r = { N: 0, E: 1, S: 2, W: 3 }[rotation] as Rotation;
      const cells = z
        .join("")
        .slice(1, -1)
        .split(")(")
        .map((x) => x.split(",").map(Number))
        .map(([x, y]) => ({ x, y }));
      return { piece: piece.toLowerCase() as Mino, rotation: r, cells };
    });
}

export interface InputSnapshot { placement: Placement, board: BoardState }
// a whole fucking tetris engine bruh ▲ slow
export class Input {
  private current: Placement;
  public constructor(
    readonly width: number,
    readonly height: number,
    readonly margin: number,
    public board: Array<Array<Cell>>,
    readonly piece: Mino,
    readonly kicktable: Array<Kick>,
    readonly piecetable: Array<PieceDef>
    // public readonly spin_detection: SpinBonuses,
  ) {
    while (board.length < height + margin) {
      board.unshift([null, null, null, null]);
    }
    // piece spawn
    this.current = {
      mino: this.piece,
      rotation: 0,
      x: Math.floor((width + 1) / 2),
      y: height,
    };
  }

  public snapshot(): InputSnapshot {
    return { placement: this.current, board: this.board }
  }

  public restore(snap: InputSnapshot) {
    this.current = snap.placement;
    this.board = snap.board;
  }

  public at(x: number, y: number) {
    const dy = this.board.length - y - 1;
    // console.log(dy);
    const result = this.board[dy]?.[x];
    if (result === undefined) {
      return "gb";
    }
    return result;
  }

  public put(x: number, y: number, piece: Mino) {
    this.board[this.board.length - y - 1][x] = piece;
  }

  public cells(): Array<readonly [number, number]> {
    const placement = this.current;
    // console.log(placement);
    const raw_cells = this.piecetable.find(
      (x) => x.piece === placement.mino && x.rotation === placement.rotation
    )!.cells;

    const cells = raw_cells.map(
      (p) => [p.x + placement.x, p.y + placement.y] as const
    );

    return cells;
  }

  public check(): boolean {
    const cells = this.cells();
    for (const [cx, cy] of cells) {
      if (this.at(cx, cy) !== null) {
        return false;
      }
    }

    return true;
  }

  public press(k: Key) {
    if (k === "moveLeft") {
      this.move_left();
    }

    if (k === "moveRight") {
      this.move_right();
    }

    if (k === "rotate180") {
      this.flip();
    }

    if (k === "rotateCCW") {
      this.ccw();
    }

    if (k === "rotateCW") {
      this.cw();
    }

    if (k === "softDrop") {
      this.sonic_drop();
    }
  }

  public move_right(): void {
    this.current.x += 1;
    if (!this.check()) {
      this.current.x -= 1;
    }
  }

  public move_left(): void {
    this.current.x += 1;
    if (!this.check()) {
      this.current.x -= 1;
    }
  }

  public soft_drop(): void {
    this.current.y -= 1;
    if (!this.check()) {
      this.current.y += 1;
    }
  }

  public sonic_drop(): void {
    while (true) {
      this.current.y -= 1;
      if (!this.check()) {
        this.current.y += 1;
        break;
      }
    }
  }

  public rotate_by(n: number): void {
    const i = this.current.rotation;
    const f = ((this.current.rotation + n + 4) % 4) as Rotation;
    // console.log(this.kicktable);
    const kt = this.kicktable.find(
      (x) => x.initial === i && x.final === f && x.piece === this.current.mino
    ) || { kicks: [{ x: 0, y: 0 }] };

    if (kt === undefined) {
      return;
    }

    let m = 0;
    // console.log(kt.kicks);
    for (const kick of kt.kicks) {
      this.current.x += kick.x;
      this.current.y += kick.y;
      this.current.rotation = f;
      m++

      if (!this.check()) {
        // console.log(`kick ${m} failed`)
        this.current.x -= kick.x;
        this.current.y -= kick.y;
        this.current.rotation = i;
        continue;
      }

      // console.log(`kick ${m} passed`)
      return;
    }
  }

  public ccw(): void {
    return this.rotate_by(-1);
  }

  public cw(): void {
    return this.rotate_by(1);
  }

  public flip(): void {
    return this.rotate_by(2);
  }

  public place(): Array<Array<Cell>> {
    for (const [x, y] of this.cells()) {
      this.put(x, y, this.current.mino);
    }

    return this.board;
  }
}
