import { Placement } from "./input";
import { permutations } from "./util";
import { Bot, State } from "./bot";
import { Cell, Mino } from "./ty";
import { Board, Tetromino, tetrominoes } from "@haelp/teto/engine";
// gl!
// TODO: if there is a board with LESS THAN 6 minos, build up to a 6residual (haha get it the bot is named 6res) spot
// ideally, this "opener phase" does NOT clear lines
// "opener phase" also should ONLY apply when we are currently not in combo
//
// if there is MORE THAN (or equal to) 6 minos, read from top-down
// to get a relevant board state and then search all combo continuations until one works
//
// for combo pathfinding:
// query all combo continuations and keep track of *all* of the ones that work with `queue`
// ONLY consider up to `vision` pieces of the queue.
// then, out of all the paths, select the longest one.
// if there is a tie, which is common, take the final board state of each candidate
// and then run this function with every permutation of IJOLZST up to length `foresight` on that board
// the candidate that supports the MOST foreseen permutations is chosen
// if a tie is made from this, just take the first one.
export function path(bot: Bot, state: State): Array<Placement> {
  const board = state.board.state;
  const queue: Array<Mino> = [];
  if (state.hold !== null) {
    queue.push(state.hold);
  }
  queue.push(state.current);
  queue.push(...state.queue);

  const minocount = board.flat().filter((x) => x !== null).length;
  const relevance = queue.slice(0, bot.vision);
  const guesses = permutations("IJOLZST", bot.foresight);

  return move(bot, state, board, queue[0]);
  return [];
}

// returns all valid placements of a `piece`
// THIS IS EXTREMELY UNOPTIMIZED.
export function move(
  bot: Bot,
  state: State,
  board: Array<Array<Cell>>,
  mino: Mino,
) {
  const zz = cells(board)
    .filter((x) => x.value === null)
    .toArray();
  return zz
    .flatMap(({ x, y }) =>
      ([0, 1, 2, 3] as const).map(
        (r) => ({ x, y, mino, rotation: r }) satisfies Placement,
      ),
    )
    .filter((c) => {
      const tc = cells_of(c);
      const fills_empty = tc.every((c) =>
        zz.some((z) => z.x === c[0] && z.y === c[1]),
      );
      const grounded = tc.some(
        (c) => !zz.some((z) => z.x === c[0] && z.y === c[1] - 1),
      );
      return fills_empty && grounded;
    })
    .sort((a, b) => a.y - b.y)
    .map((x) => (console.log(x), x))
    .filter((x) => bot.get_finesse(x, state, false, board) !== null);
}

export function cells_of(c: Placement) {
  return tetrominoes[c.mino].matrix.data[c.rotation].map(
    (x) => [x[0] + c.x, x[1] + c.y] as const,
  );
}

// gets the cell located at `(x, y)` where `(0, 0)` is the bottom left
export function at(board: Array<Array<Cell>>, x: number, y: number) {
  return board[board.length - y - 1][x];
}

export interface LocatedCell {
  x: number;
  y: number;
  value: Cell;
}
export function* cells(
  board: Array<Array<Cell>>,
): Generator<LocatedCell, void, unknown> {
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[board.length - y - 1].length; x++) {
      yield { x, y, value: board[board.length - y - 1][x] };
    }
  }
}
