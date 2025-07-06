import { Bot, State } from "./bot";
import { Placement } from "./input";
import { Cell } from "./ty";

export function path(bot: Bot, state: State): Array<Placement> {
    const board = state.board.state;
    const minocount = board.flat().filter((x) => x !== null).length;

    if (state.engine.stats.combo < 1 && minocount < 6) {
        console.log('entered opener phase');
        // :stare:
        
    }
    return [];
}