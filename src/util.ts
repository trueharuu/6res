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

/*
givenQueue = "IJOLZST"  # what the randomizer gives us
targetQueue = "IOLZJTS"  # what we want to play

givenQueueIndex = 0
targetQueueIndex = 0
hold = "X"  # filler
while givenQueueIndex < len(givenQueue):
  if givenQueue[givenQueueIndex] == targetQueue[targetQueueIndex]:
    print(f"Playing {givenQueue[givenQueueIndex]} normally")
    givenQueueIndex += 1
    targetQueueIndex += 1
  else:
    if hold == "X":
      hold = givenQueue[givenQueueIndex]
      print(f"Holding for the first time, holding {hold}")
      givenQueueIndex += 1
    else:
      print(f"Playing {hold} from hold")
      hold = givenQueue[givenQueueIndex]
      print(f"Now holding {hold}")
      targetQueueIndex += 1
      givenQueueIndex += 1
if targetQueueIndex < len(targetQueue):
  print(f"Playing {hold} from hold")
*/

