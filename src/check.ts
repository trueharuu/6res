import { RoomOptions } from "./ty";

export function check_settings(room: RoomOptions) {
    const fixes = [];
    if (room.boardwidth !== 4) {
        fixes.push('options.boardwidth=4');
    }

    return fixes;
}