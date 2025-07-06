import { Placement } from "./input";
import { permutations } from "./util";
import { Bot, State } from "./bot";
import { BoardState, Cell, Key, Mino } from "./ty";
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
export function path(bot: Bot, state: State): Array<Array<Key>> {
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

  const b = board.map(x=> x.map(y=>y === null ? 0 : 1));
  const path = move(b, relevance, state.hold ?? undefined)
  path

  return [];
}

type B = Array<Array<number>>;
import * as usm from "./usm";
export function move(a: B, queue: Array<Mino>, hold?: Mino): Array<[B, Array<Key>]> {
  return [move_single(a, queue[0])[0]]
  return [];
}

export function move_single(
  a: B,
  piece: Mino
): Array<[B, Array<Key>]> {
  const hash = usm.hashBoard(a);
  const minocount = a.flat().filter((x) => x !== null).length;
  const paths = usm
    .getNextBoards(hash, piece.toUpperCase())
    .map(([b, k]) => [usm.unhashBoard(b), k] as [B, Array<Key>]);
  return paths;
}

export enum Used {
  Current,
  Hold,
  Next,
}
