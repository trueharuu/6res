import { Classes, Client } from "@haelp/teto";
import { Room } from "./ty";
import { check_settings } from "./check";
import { tracing } from "./tracing";
import { Bot } from "./bot";

export class Instance {
  private cl!: Client;
  private room!: Room;
  private bot!: Bot;
  public constructor(
    private options: Classes.ClientOptions,
    private code: string
  ) {}
  public async spawn() {
    this.cl = await Client.connect(this.options);
    tracing.info("created a client for", tracing.tag(this.code));
  }

  public async join() {
    this.room = await this.cl.rooms.join(this.code);

    if (check_settings(this.room.options).length === 0) {
      try {
        this.room.switch("player");
      } catch {}
    }

    this.bot = new Bot(this.room);
  }

  public async kill() {
    try {
      await this.room.chat(":crying:");
      await this.room.leave();
    } catch {}

    try {
      await this.cl.destroy();
    } catch {}
    tracing.warn(tracing.tag(this.code), "was killed");
  }
}
