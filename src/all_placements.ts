import { Input, Kick, PieceDef, Placement } from "./input";
import { Cell, Engine, Key, Mino } from "./ty";
import { permutations } from "./util";

export function reachable_placements(
  board: Array<Array<Cell>>,
  piece: Mino,
  max_kpp: number,
  keyboard: Set<Key>,
  kicks: Array<Kick>,
  pieces: Array<PieceDef>
) {
  // @usm optimize this so we dont go through all sizes
  // or at least dont do significant computation for them
  const seen = new Map<string, string>(); // <[ x, y, rotation ], Finesse>
  const input = new Input(4, board.length, 4, board, piece, kicks, pieces);
  for (let i = 0; i <= max_kpp; i++) {
    for (const seq of permutations(keyboard, i)) {
      const snap = input.snapshot();

      for (const key of seq) {
        input.press(key);
      }

      const p = input.snapshot().placement;
      const f = `${p.x},${p.y},${p.rotation}`;
      if (seen.has(f)) {
        continue;
      }
      seen.set(f, seq.join(","));

      input.restore(snap);
    }
  }

  return seen;
}

function startsWith<T>(haystack: Array<T>, needle: Array<T>): boolean {
  for (let i = 0; i < needle.length; i++) {
    if (haystack[i] !== needle[i]) {
      return false;
    }
  }

  return true;
}
