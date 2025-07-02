import { Mino } from "@haelp/teto/dist/types/engine";

export function* permutations<T>(t: Iterable<T>, n: number): Generator<T[]> {
  const items = Array.from(t);
  const current: T[] = [];

  function* backtrack(depth: number): Generator<T[]> {
    if (depth === n) {
      yield [...current];
      return;
    }
    for (const item of items) {
      current.push(item);
      yield* backtrack(depth + 1);
      current.pop();
    }
  }

  yield* backtrack(0);
}