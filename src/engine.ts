import { Board, Piece, Placement, Key } from "./defs";
import { opener_db } from "./opener_db";

export interface EngineSettings {
    // the base speed the engine will play at.
    pps: number;

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
    public constructor(public settings: EngineSettings, public context: Context) {}
    // these should *eventually* be placed.
    public queued_placements: Array<Placement> = [];

    public async loop() {
        if (this.queued_placements.length === 0) {
            if (this.context.opener_phase) {
                this.queued_placements.push(...this.opener(this.context.queue));
            } else {
                this.queued_placements.push(this.best_placement());
            }
        }
        
        if (this.queued_placements.length > 0) {
            const placement = this.queued_placements.shift()!;
            const finesse_keys = this.finesse(placement);
            
            for (const key of finesse_keys) {
                await this.send(key);
            }
        }
        
        if (this.context.frame % Math.ceil(60 / this.settings.pps) === 0) {
            await this.sync();
        }
    }
    

    public async start() {
        while(true) {
            this.sync();
            this.loop();
        }
    }

    // determine the objective best placement for the piece in either the current or hold queue.
    public best_placement(): Placement {
        throw 'unimplemented! this is hard as fuck!';
    }

    // combo calculations are significantly easier whne you only have 3/4/5/6 minos
    public relevant_board_state(): Board {
        throw 'unimplemented';
    }

    public finesse(placement: Placement): Array<Key> {
        // todo! this is not how you place pieces man!
        return [Key.HardDrop];
    }

    // sends a single input to the game
    public async send(key: Key) {
        throw 'unimplemented';
    }

    // attempt to recieve the current board and next/hold queues
    public async sync() {}

    // finds a recommended set of placements during the opener phase
    public opener(queue: Array<Piece>): Array<Placement> {
        return opener_db.find(x=>x.queues.some(x=>x.join('') === queue.join('')))!.placements;
    }
}