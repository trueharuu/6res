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
export function path(bot: Bot, state: State): Array<[Mino, Array<Key>]> {
  const board = state.board.state;
  const queue: Array<Mino> = [];
  // if (state.hold !== null) {
  //   queue.push(state.hold);
  // }
  queue.push(state.current);
  queue.push(...state.queue);

  const minocount = board.flat().filter((x) => x !== null).length;
  const guesses = permutations("IJOLZST", bot.foresight);

  const style =
    minocount < 6 && state.engine.stats.combo < 1 ? Style.Upstack : Style.Combo;
  const relevance = queue.slice(0, style === Style.Upstack ? 2 : bot.vision);
  const path = move(bot, style, board, relevance, state.hold ?? undefined);
  // console.log(path.map((x) => [x[0].map((x) => x.join("")).join("\n"), x[1]]));
  console.log(
    queue,
    path.map((x) => [x[2], x[1]])
  );
  return path.map((x) => [x[2], x[1]]);

  return [];
}

type B = Array<Array<number>>;
type mov = [BoardState, Array<Key>, Mino];
enum Style {
  Combo,
  Upstack,
  // Downstack,
}
import * as usm from "./usm";
import { reachable_placements } from "./all_placements";
export function move(
  bot: Bot,
  style: Style,
  a: BoardState,
  queue: Array<Mino>,
  hold?: Mino
): Array<mov> {
  if (queue.length === 0) {
    if (hold) {
      return move(bot, style, a, [hold]);
    }

    return [];
  }
  const possible_continuations: Array<[Used, mov]> = [];
  // all combinations for current piece
  possible_continuations.push(
    ...move_single(bot, a, queue[0]).map(
      (x) => [Used.Current, x] as [Used, mov]
    )
  );

  // all combinations for hold piece
  if (hold) {
    possible_continuations.push(
      ...move_single(bot, a, hold).map((x) => [Used.Hold, x] as [Used, mov])
    );
  }

  if (queue[1] && hold === undefined) {
    possible_continuations.push(
      ...move_single(bot, a, queue[1]).map((x) => [Used.Next, x] as [Used, mov])
    );
  }

  let max: Array<mov> = [];
  for (const [use, cont] of possible_continuations) {
    // we went up
    if (style === Style.Combo && count(cont[0]) > count(a)) {
      continue;
    }

    // we didnt go up
    if (style === Style.Upstack && count(cont[0]) <= count(a)) {
      continue;
    }

    // console.log(use, cont);
    const q = queue.slice(use === Used.Current ? 2 : 1);
    const h = use === Used.Current ? hold : queue[0];
    const af = after_line_clear(cont[0]);
    const sf = move(bot, style, af, q, h);
    const nw: Array<mov> = [cont, ...sf];
    if (nw.length > max.length) {
      max = nw;
    }
  }

  if (max.length > 0) {
    return max;
  }

  // fallback!
  const mov = move_single(bot, a, queue[0]);

  return [mov[~~(Math.random() * mov.length)]];
}

// hacky.
export function after_line_clear(a: BoardState): BoardState {
  let m = a.length;
  a = a.filter((x) => x.every((z) => z !== null));
  while (a.length < m) {
    a.unshift([null, null, null, null]);
  }

  return a;
}

export function count(a: BoardState): number {
  return a.flat().filter((x) => x !== null).length;
}

export function move_single(bot: Bot, a: BoardState, piece: Mino): Array<mov> {
  reachable_placements(
    a,
    piece,
    4,
    bot.usable_inputs(),
    bot.kicktable(),
    bot.piecetable()
  );
  return [];
}

export enum Used {
  Current = "curr",
  Hold = "hold",
  Next = "next",
}
