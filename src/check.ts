import { RoomOptions } from "./ty";

export function check_settings(room: RoomOptions) {
  const fixes = [];
  if (room.boardwidth !== 4) {
    fixes.push("options.boardwidth=4");
  }

  if (room.gincrease !== 0) {
    fixes.push("options.gincrease=0");
  }

  return fixes;
}
