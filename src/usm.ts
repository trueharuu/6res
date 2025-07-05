// UTILITY FUNCTIONS

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Key } from "./ty";

// Rotations, used for debugging
const ROTATIONS = ["N", "E", "S", "W"];
const ROTATION_MOVES = ["0", "CW", "180", "CCW"];

// File names
const PIECES_FILENAME = "data/pieces.txt";
const KICKS_FILENAME = "data/kicks.txt";
const PC_QUEUES_FILENAME = "data/pc-queues.txt";

// Type definitions
type Piece = string;
type Coordinate = [number, number]; // [y, x]
type PieceData = Record<string, Record<number, Coordinate[]>>;
type KickData = Record<string, Record<number, Record<number, Coordinate[]>>>;
type Board = number[][];

// Reads piece data from txt file.
// Returns {piece: {orientation: [squares relative to center]}}
// Stored as (y, x)
export function getPieces(filename: string): PieceData {
  const pieces: PieceData = {};
  const content = readFileSync(filename, "utf-8");
  const lines = content.trim().split("\n");

  const pieceList = lines[0].trim();
  let lineIndex = 1;

  for (const piece of pieceList) {
    pieces[piece] = {};
    const squares: Coordinate[] = [];
    const row1 = lines[lineIndex++].trim();
    const row0 = lines[lineIndex++].trim();

    for (let i = 0; i < 4; i++) {
      if (row0[i] !== ".") squares.push([0, i - 1]);
      if (row1[i] !== ".") squares.push([1, i - 1]);
    }

    for (let rotation = 0; rotation < 4; rotation++) {
      pieces[piece][rotation] = [...squares];
      // Rotate squares: (y, x) -> (-x, y)
      for (let i = 0; i < squares.length; i++) {
        const [y, x] = squares[i];
        squares[i] = [-x, y];
      }
    }
  }

  return pieces;
}

const PIECES = getPieces(PIECES_FILENAME);
const PIECE_WIDTH: Record<string, number> = {};
for (const piece in PIECES) {
  PIECE_WIDTH[piece] = piece === "O" ? 2 : piece === "I" ? 4 : 3;
}

// Reads kick data from txt file.
// Returns {piece: {orientation: {input: [offset order]}}}
export function getKicks(filename: string): KickData {
  const kicks: KickData = {};
  const content = readFileSync(filename, "utf-8");
  const lines = content.trim().split("\n");
  let lineIndex = 0;

  for (let p = 0; p < 7; p++) {
    const piece = lines[lineIndex++].trim();
    kicks[piece] = {};

    for (let orientation = 0; orientation < 4; orientation++) {
      kicks[piece][orientation] = {};
      for (let rotationInput = 1; rotationInput < 4; rotationInput++) {
        lineIndex++; // Skip empty line
        const offsetsStr = lines[lineIndex++].trim();
        const offsets = offsetsStr.split("; ");
        const pieceKicks = offsets.map((offset) => {
          const [y, x] = offset.split(", ").map(Number);
          return [y, x] as Coordinate;
        });
        kicks[piece][orientation][rotationInput] = pieceKicks;
      }
    }
  }

  return kicks;
}

const KICKS = getKicks(KICKS_FILENAME);

// Converts a board state to an integer.
// Treats board state like binary string.
// Bits are read top to bottom, and right to left within each row.
export function hashBoard(board: Board): bigint {
  let boardHash = 0n;
  for (let i = board.length - 1; i >= 0; i--) {
    const row = board[i];
    for (let j = row.length - 1; j >= 0; j--) {
      boardHash *= 2n;
      boardHash += BigInt(row[j]);
    }
  }
  return boardHash;
}

// Converts an integer to a board state.
export function unhashBoard(boardHash: bigint): Board {
  const board: Board = [];
  while (boardHash > 0n) {
    let rowHash = boardHash % 16n;
    boardHash = boardHash / 16n;
    const row: bigint[] = [];
    for (let squareNum = 0; squareNum < 4; squareNum++) {
      row.push(rowHash % 2n);
      rowHash = rowHash / 2n;
    }
    board.push(row.map(Number));
  }
  return board;
}

// Obtains list of squares in the board.
export function getSquareList(board: Board): Coordinate[] {
  const squareList: Coordinate[] = [];
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < 4; x++) {
      if (board[y][x]) {
        squareList.push([y, x]);
      }
    }
  }
  return squareList;
}

// Obtains list of ways to insert at most maxLines lines into a board
export function* linesToInsert(
  boardHeight: number,
  maxLines: number
): Generator<number[]> {
  if (maxLines === 1) {
    yield [];
    for (let height = 0; height <= boardHeight; height++) {
      yield [height];
    }
  } else {
    for (const lineSet of linesToInsert(boardHeight, maxLines - 1)) {
      yield [...lineSet, boardHeight];
    }
    if (boardHeight > 0) {
      for (const lineSet of linesToInsert(boardHeight - 1, maxLines)) {
        yield lineSet;
      }
    } else {
      yield [];
    }
  }
}

// Obtains all possible ways to play a queue given one hold.
export function* getQueueOrders(queue: string): Generator<string> {
  if (queue.length === 1) {
    yield queue[0];
    return;
  }

  for (const queueOrder of getQueueOrders(queue.slice(1))) {
    yield queue[0] + queueOrder;
  }

  for (const queueOrder of getQueueOrders(queue[0] + queue.slice(2))) {
    yield queue[1] + queueOrder;
  }
}

// Displays a board
export function displayBoard(boardHash: bigint): void {
  const board = unhashBoard(boardHash);
  console.log("|    |");
  for (let i = board.length - 1; i >= 0; i--) {
    const row = board[i];
    const rowStr = row.map((cell) => (cell ? "#" : " ")).join("");
    console.log(`|${rowStr}|`);
  }
  console.log("+----+");
}

// Displays a list of boards
export function displayBoards(boardHashList: bigint[]): void {
  for (const boardHash of boardHashList) {
    displayBoard(boardHash);
    console.log();
  }
}

// MAIN FUNCTIONS

// Computes all possible piece placements given board and piece
// Returns a list of all possible boards.
// Assume 100g.
interface Result {
  board: number;
  finesse: Array<string>;
}
export function getNextBoards(
  boardHash: bigint,
  piece: string
): [bigint, Array<Key>][] {
  // Obtain board
  const board = unhashBoard(boardHash);
  const squareSet = new Set(getSquareList(board).map(([y, x]) => `${y},${x}`));

  // Detect starting position of piece, assuming 100g
  let y = board.length - 1;
  while (true) {
    if (y < 0) {
      y = 0;
      break;
    }
    let good = true;
    for (const [offsetY, offsetX] of PIECES[piece][0]) {
      if (squareSet.has(`${y + offsetY},${1 + offsetX}`)) {
        good = false;
        break;
      }
    }
    if (!good) {
      y += 1;
      break;
    }
    y -= 1;
  }

  // State is (y, x, rotation, finesse)
  const queue: [number, number, number, Array<Key>][] = [[y, 1, 0, []]];
  const visited = new Map<string, Array<Key>>();

  // BFS on all possible ending locations for piece, assuming 100g
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = current.join(",");
    console.log(currentKey);

    if (!visited.has(currentKey)) {
      const [y, x, rotation, finesse] = current;
      visited.set(currentKey, finesse);

      // test movement
      for (const xMove of [-1, 1]) {
        let newYOffset = 1;
        let good = true;

        while (good) {
          newYOffset -= 1;
          for (const [offsetY, offsetX] of PIECES[piece][rotation]) {
            const newY = y + offsetY + newYOffset;
            const newX = x + offsetX + xMove;
            if (
              squareSet.has(`${newY},${newX}`) ||
              !(0 <= newY && 0 <= newX && newX < 4)
            ) {
              good = false;
              newYOffset += 1;
              break;
            }
          }
        }

        // todo
        if (newYOffset <= 0) {
          const moved = newYOffset !== 0;
          const nf: Array<Key> = [...finesse];
          if (xMove === -1) {
            nf.push("moveLeft");
          }

          if (xMove === 1) {
            nf.push("moveRight");
          }

          if (moved) {
            nf.push("softDrop");
          }

          queue.push([y + newYOffset, x + xMove, rotation, nf]);
        }
      }

      // test rotation
      for (const rotationMove of [1, 2, 3]) {
        const newRotation = (rotation + rotationMove) % 4;

        for (const [kickOffsetY, kickOffsetX] of KICKS[piece][rotation][
          rotationMove
        ]) {
          let newYPosition = kickOffsetY + y;
          let newXPosition = kickOffsetX + x;
          let good = true;

          for (const [offsetY, offsetX] of PIECES[piece][newRotation]) {
            const newY = newYPosition + offsetY;
            const newX = newXPosition + offsetX;
            if (
              squareSet.has(`${newY},${newX}`) ||
              !(0 <= newY && 0 <= newX && newX < 4)
            ) {
              good = false;
              break;
            }
          }

          if (good) {
            // gravity
            while (good) {
              newYPosition -= 1;
              for (const [offsetY, offsetX] of PIECES[piece][newRotation]) {
                const newY = newYPosition + offsetY;
                const newX = newXPosition + offsetX;
                if (
                  squareSet.has(`${newY},${newX}`) ||
                  !(0 <= newY && 0 <= newX && newX < 4)
                ) {
                  good = false;
                  newYPosition += 1;
                  break;
                }
              }
            }
            const nf: Array<Key> = [...finesse];
            nf.push(
              (["rotateCW", "rotate180", "rotateCCW"] as const)[rotationMove]
            );

            if (newYPosition < kickOffsetY + y) {
              nf.push("softDrop");
            }

            queue.push([newYPosition, newXPosition, newRotation, nf]);
            break;
          }
        }
      }
    }
  }

  // Obtain board states
  const boards = new Map<bigint, Array<Key>>();
  for (const [visitedState, finesse] of visited) {
    const [y, x, rotation] = visitedState.split(",").map(BigInt);
    let newHash = boardHash;

    for (const [offsetY, offsetX] of PIECES[piece][Number(rotation)]) {
      newHash += 2n ** (4n * (y + BigInt(offsetY)) + x + BigInt(offsetX));
    }

    const newBoard = unhashBoard(newHash);

    // Remove completed lines
    const clearedBoard = newBoard.filter((row) => row.includes(0));

    boards.set(hashBoard(clearedBoard), finesse);
  }

  return Array.from(boards);
}

// Computes all possible board states at the end of the given queue
// export function getNextBoardsGivenQueue(
//   boardHash: number,
//   queue: string
// ): number[] {
//   let boards = new Set([boardHash]);

//   for (const piece of queue) {
//     const newBoards = new Set<number>();
//     for (const board of boards) {
//       const nextBoards = getNextBoards(board, piece);
//       nextBoards.forEach((b) => newBoards.add(b));
//     }
//     boards = newBoards;
//   }

//   return Array.from(boards).sort((a, b) => a - b);
// }

// Computes all possible previous piece placements given board and previous piece
// Returns a list of all possible previous boards.
// Assume 100g.
// export function getPreviousBoards(
//   boardHash: number,
//   piece: string,
//   forwardsSavedTransitions: Map<string, number[]> = new Map()
// ): number[] {
//   // Obtain board
//   const board = unhashBoard(boardHash);

//   // Obtain potential board states such that adding the given piece would result in current board state
//   const candidatePreviousBoards = new Set<number>();

//   for (const lineList of linesToInsert(board.length, PIECE_WIDTH[piece])) {
//     const candidatePreviousBoard: Board = [];
//     let previousIndex = 0;

//     for (const lineIndex of lineList) {
//       for (let row = previousIndex; row < lineIndex; row++) {
//         candidatePreviousBoard.push(board[row]);
//       }
//       candidatePreviousBoard.push([1, 1, 1, 1]);
//       previousIndex = lineIndex;
//     }

//     for (let row = previousIndex; row < board.length; row++) {
//       candidatePreviousBoard.push(board[row]);
//     }

//     // Look for positions where the given piece fits
//     const candidatePreviousBoardHash = hashBoard(candidatePreviousBoard);
//     const squareSet = new Set(
//       getSquareList(candidatePreviousBoard).map(([y, x]) => `${y},${x}`)
//     );

//     for (let y = 0; y < candidatePreviousBoard.length; y++) {
//       for (let x = 0; x < 4; x++) {
//         for (let rotation = 0; rotation < 4; rotation++) {
//           let good = true;
//           let pieceHash = 0;

//           for (const [offsetY, offsetX] of PIECES[piece][rotation]) {
//             const newY = y + offsetY;
//             const newX = x + offsetX;
//             if (!squareSet.has(`${newY},${newX}`)) {
//               good = false;
//               break;
//             }
//             pieceHash += 2 ** (4 * newY + newX);
//           }

//           // Compute hash and check for lack of filled in lines
//           if (good) {
//             const processedPreviousBoardHash =
//               candidatePreviousBoardHash - pieceHash;
//             const processedPreviousBoard = unhashBoard(
//               processedPreviousBoardHash
//             );
//             const hasIncompleteLines = processedPreviousBoard.some(
//               (row) => !row.includes(0)
//             );

//             if (!hasIncompleteLines) {
//               candidatePreviousBoards.add(processedPreviousBoardHash);
//             }
//           }
//         }
//       }
//     }
//   }

//   const candidatePreviousBoardsList = Array.from(candidatePreviousBoards).sort(
//     (a, b) => a - b
//   );

//   // Ensure it is possible to reach current board state from each candidate previous board state
//   const boards: number[] = [];
//   for (const candidatePreviousBoard of candidatePreviousBoardsList) {
//     const key = `${candidatePreviousBoard},${piece}`;
//     if (!forwardsSavedTransitions.has(key)) {
//       forwardsSavedTransitions.set(
//         key,
//         getNextBoards(candidatePreviousBoard, piece)
//       );
//     }
//     if (forwardsSavedTransitions.get(key)!.includes(boardHash)) {
//       boards.push(candidatePreviousBoard);
//     }
//   }

//   return boards;
// }

// Computes all possible board states that at the end of the given queue results in the given board
// export function getPreviousBoardsGivenQueue(
//   boardHash: number,
//   queue: string
// ): number[] {
//   let boards = new Set([boardHash]);
//   const forwardsSavedTransitions = new Map<string, number[]>();

//   for (let i = queue.length - 1; i >= 0; i--) {
//     const piece = queue[i];
//     const prevBoards = new Set<number>();

//     for (const board of boards) {
//       const previousBoards = getPreviousBoards(
//         board,
//         piece,
//         forwardsSavedTransitions
//       );
//       previousBoards.forEach((b) => prevBoards.add(b));
//     }

//     boards = prevBoards;
//   }

//   return Array.from(boards).sort((a, b) => a - b);
// }

// Generate all PC queues for any possible queue up to length N.
// Limits max height to H.
// Reads from output file if one exists.
// Otherwise, saves to output file because this is gonna take FOREVER.
// export function generateAllPcQueues(
//   filename: string,
//   n: number = 7,
//   h: number = 8,
//   override: boolean = false
// ): string[] {
//   if (!override && existsSync(filename)) {
//     const content = readFileSync(filename, "utf-8");
//     const lines = content.trim().split("\n");
//     const N = parseInt(lines[0].trim());
//     const pcs = lines.slice(1, N + 1).filter((line) => line.length <= n);
//     return pcs;
//   }

//   h = Math.min(n, h);
//   const pcs = new Set<string>();

//   const maxBoard = 2 ** (4 * h) - 1; // max hash

//   // Optimization: use BFS forwards and backwards
//   const nBackwards = Math.floor(n / 4) + 1;
//   const nForwards = n - nBackwards;

//   // Backwards direction
//   const backwardsQueue: [number, string][] = [[0, ""]]; // [board_hash, history]
//   const backwardsReachableStates = new Map<number, Set<string>>(); // board_hash -> queue_set
//   const backwardsSavedTransitions = new Map<string, number[]>(); // (board_hash, piece) -> next_board_list
//   const forwardsSavedTransitions = new Map<string, number[]>(); // (board_hash, piece) -> next_board_list

//   let visited = new Set<string>();
//   while (backwardsQueue.length > 0) {
//     const current = backwardsQueue.shift()!;
//     const currentKey = `${current[0]},${current[1]}`;

//     if (!visited.has(currentKey)) {
//       visited.add(currentKey);
//       const [boardHash, history] = current;

//       // Check each possible next piece
//       for (const piece in PIECES) {
//         const newHistory = piece + history;
//         const key = `${boardHash},${piece}`;

//         if (!backwardsSavedTransitions.has(key)) {
//           backwardsSavedTransitions.set(
//             key,
//             getPreviousBoards(boardHash, piece, forwardsSavedTransitions)
//           );
//         }

//         for (const previousBoard of backwardsSavedTransitions.get(key)!) {
//           // Track reachable board states
//           if (previousBoard !== 0 && previousBoard < maxBoard) {
//             if (!backwardsReachableStates.has(previousBoard)) {
//               backwardsReachableStates.set(previousBoard, new Set());
//             }
//             backwardsReachableStates.get(previousBoard)!.add(newHistory);

//             if (newHistory.length < nBackwards) {
//               backwardsQueue.push([previousBoard, newHistory]);
//             }
//           }
//         }
//       }
//     }
//   }

//   // Forwards direction
//   const forwardsQueue: [number, string][] = [[0, ""]]; // [board_hash, history]
//   const forwardsReachableStates = new Map<number, Set<string>>(); // board_hash -> queue_set

//   visited = new Set<string>();
//   while (forwardsQueue.length > 0) {
//     const current = forwardsQueue.shift()!;
//     const currentKey = `${current[0]},${current[1]}`;

//     if (!visited.has(currentKey)) {
//       visited.add(currentKey);
//       const [boardHash, history] = current;

//       // Check each possible next piece
//       for (const piece in PIECES) {
//         const newHistory = history + piece;
//         const key = `${boardHash},${piece}`;

//         if (!forwardsSavedTransitions.has(key)) {
//           forwardsSavedTransitions.set(key, getNextBoards(boardHash, piece));
//         }

//         for (const nextBoard of forwardsSavedTransitions.get(key)!) {
//           // Track reachable board states
//           if (nextBoard < maxBoard && nextBoard !== 0) {
//             if (backwardsReachableStates.has(nextBoard)) {
//               if (!forwardsReachableStates.has(nextBoard)) {
//                 forwardsReachableStates.set(nextBoard, new Set());
//               }
//               forwardsReachableStates.get(nextBoard)!.add(newHistory);
//             }

//             if (newHistory.length < nForwards) {
//               forwardsQueue.push([nextBoard, newHistory]);
//             }
//           }
//         }
//       }
//     }
//   }

//   // Merge forwards and backwards
//   for (const [boardHash, forwardsSet] of forwardsReachableStates) {
//     if (backwardsReachableStates.has(boardHash)) {
//       const backwardsSet = backwardsReachableStates.get(boardHash)!;
//       for (const firstHalf of forwardsSet) {
//         for (const secondHalf of backwardsSet) {
//           pcs.add(firstHalf + secondHalf);
//         }
//       }
//     }
//   }

//   pcs.add("I"); // Edge case

//   // Save to output file
//   const pcsArray = Array.from(pcs).sort((a, b) =>
//     a.length !== b.length ? a.length - b.length : a.localeCompare(b)
//   );
//   const content = pcsArray.length + "\n" + pcsArray.join("\n");
//   writeFileSync(filename, content);

//   return pcsArray;
// }

// Determines the set of saves for a given pc queue ("X" if no save), given set of pcs.
// export function getPcSaves(
//   pieceQueue: string,
//   pcs: Set<string>
// ): Record<string, string> {
//   const saves: Record<string, string> = {};

//   for (const queueOrder of getQueueOrders(pieceQueue)) {
//     const prefix = queueOrder.slice(0, -1);
//     if (pcs.has(prefix)) {
//       saves[queueOrder[queueOrder.length - 1]] = prefix;
//     }
//     if (pcs.has(queueOrder)) {
//       saves["X"] = queueOrder;
//     }
//   }

//   return saves;
// }

// Computes the maximum number of pcs that can be obtained in a queue.
// export function maxPcsInQueue(pieceQueue: string): [number, string[]] {
//   const pcsArray = generateAllPcQueues(PC_QUEUES_FILENAME);
//   const pcs = new Set(pcsArray); // set of all pcs
//   const maxN = Math.max(...pcsArray.map((pc) => pc.length)); // longest pc
//   const queue = pieceQueue + "X"; // terminator character

//   // (index, hold piece) -> [num pcs, previous state, previous solve]
//   const dp = new Map<string, [number, string | null, string | null]>();
//   dp.set(`1,${queue[0]}`, [0, null, null]);

//   for (let index = 1; index < queue.length; index++) {
//     for (const hold in PIECES) {
//       const currentState = `${index},${hold}`;
//       if (dp.has(currentState)) {
//         const currentDp = dp.get(currentState)!;

//         for (
//           let piecesUsed = 1;
//           piecesUsed <= Math.min(queue.length - index, maxN);
//           piecesUsed++
//         ) {
//           const pcQueue = hold + queue.slice(index, index + piecesUsed);
//           const saves = getPcSaves(pcQueue, pcs);

//           for (const save in saves) {
//             const nextState = `${index + piecesUsed},${save}`;
//             const newScore = currentDp[0] + 1;

//             if (!dp.has(nextState) || newScore > dp.get(nextState)![0]) {
//               dp.set(nextState, [newScore, currentState, saves[save]]);
//             }
//           }
//         }
//       }
//     }
//   }

//   let maxPcs = 0;
//   let bestState: string | null = null;

//   for (const [state, [score]] of dp) {
//     if (score > maxPcs) {
//       maxPcs = score;
//       bestState = state;
//     }
//   }

//   if (maxPcs === 0 || !bestState) {
//     return [0, []];
//   }

//   const reversedHistory: string[] = [];
//   let currentState: string | null = bestState;

//   while (currentState && dp.get(currentState)![2] !== null) {
//     reversedHistory.push(dp.get(currentState)![2]!);
//     currentState = dp.get(currentState)![1];
//   }

//   const history = reversedHistory.reverse();
//   return [maxPcs, history];
// }
