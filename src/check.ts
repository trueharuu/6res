import { Room } from "@haelp/teto/dist/types/classes";

export function check_settings(room: Room) {
    const fixes = [];
    if (room.options.boardwidth !== 4) {
        fixes.push('options.boardwidth=4');
    }

    return fixes;
}