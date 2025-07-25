import { Classes, Client, Types } from "@haelp/teto";
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
      await this.room.switch("player").catch((c) => {});
    }

    this.bot = new Bot(this.room);
    this.cl.on("room.chat", async (c) => {
      await this.onRoomChat(c);
    });

    this.cl.on("client.game.round.start", async (c) => {
      await this.onGameRoundStart(c);
    });

    this.cl.on("client.game.end", async (c) => {
      await this.onGameRoundEnd(c);
    });

    this.cl.on("client.game.abort", async () => {
      await this.onGameAbort();
    });

    this.cl.on("room.player.remove", async () => {
      const humans = this.room.players.filter((x) => !x.bot);
      if (humans.length === 0) {
        await this.kill();
      }
    });

    this.cl.on("room.update.bracket", async (c) => {
      if (c.uid === this.cl.user.id && c.bracket === "player") {
        const set = check_settings(this.room.options);
        if (set.length > 0) {
          await this.room.switch("spectator");
          await this.room.chat("something is bad! paste the following to fix:");
          await this.room.chat(`/set ${set.join(";")}`);
        }
      }
    });

    this.cl.on("room.update", async (c) => {
      if (check_settings(c.options).length > 0) {
        await this.room.switch("spectator");
      }
    });

    this.cl.on("client.game.start", async (c) => {
      await this.room.chat("glhf");
    });
  }

  public async kill() {
    try {
      this.bot.spool.kill();
      await this.room.chat(":crying:");
      await this.room.leave().catch(tracing.safe);
    } catch {}

    try {
      await this.cl.destroy();
    } catch {}
    tracing.warn(tracing.tag(this.code), "was killed");
  }

  public async onRoomChat(c: Types.Events.in.all["room.chat"]) {
    if (c.system || c.user.role === "bot") {
      return;
    }

    if (!c.content.startsWith(process.env.PREFIX!)) {
      return;
    }

    if (
      this.room.owner !== c.user._id &&
      !process.env.HOSTS?.split(",").includes(c.user._id)
    ) {
      return await this.room.chat("no! (unauthorized)");
    }

    const argv = c.content
      .slice(1)
      .split(" ")
      .map((x) => x.toLowerCase());

    if (argv[0] === "pps") {
      const n = Number(argv[1]);
      if (Number.isNaN(n)) {
        return await this.room.chat("no! (not a number)");
      }

      if (n > 30 || n <= 0) {
        return await this.room.chat("no! (must be 0 < pps <= 30)");
      }

      await this.room.chat(`ok pps=${n}`);

      this.bot.pps = n;
    }

    if (argv[0] === "vision") {
      const n = Number(argv[1]);
      if (Number.isNaN(n)) {
        return await this.room.chat("no! (not a number)");
      }

      if (n > 35 || n < 2) {
        return await this.room.chat("no! (must be 2 < vision <= 35)");
      }

      await this.room.chat(`ok vision=${n}`);

      this.bot.vision = n;
    }

    if (argv[0] === "foresight") {
      const n = Number(argv[1]);
      if (Number.isNaN(n)) {
        return await this.room.chat("no! (not a number)");
      }

      if (n > 7 || n < 0) {
        return await this.room.chat("no! (must be 0 <= foresight <= 7)");
      }

      await this.room.chat(`ok foresight=${n}`);

      this.bot.foresight = n;
    }

    if (argv[0] === "finesse") {
      if (argv[1] === "human" || argv[1] === "instant") {
        this.bot.finesse = argv[1];
        await this.room.chat(`ok finesse=${argv[1]}`);
      } else {
        return await this.room.chat(
          'no! (finesse must be one of "human", "finesse")'
        );
      }
    }

    if (argv[0] === "can180") {
      if (argv[1] === "true") {
        this.bot.can180 = true;
      } else if (argv[1] === "false") {
        this.bot.can180 = false;
      } else {
        return await this.room.chat(
          'no! (can180 must be one of "true" | "false")'
        );
      }
    }

    if (argv[0] === "burst") {
      const n = Number(argv[1]);
      if (Number.isNaN(n)) {
        return await this.room.chat("no! (not a number)");
      }

      if (n > 30 || n < 0) {
        return await this.room.chat("no! (must be 0 <= burst <= 30)");
      }

      await this.room.chat(`ok burst=${n}`);

      this.bot.burst = n;
    }

    if (argv[0] === "preset") {
      const presets = {
        algebruh: [3.5, 3.5, 6, 2, false, "human"],
        madkiwi: [4.0, 5.5, 7, 1, true, "human"],
        usm: [1.5, 2.5, 5, 2, true, "human"],
        mina: [4.0, 6, 5, 1, true, "human"],
        marqueese: [5, 8, 4, 1, false, "human"],
        bot: [5.0, 10.0, 14, 1, true, "instant"],
      };

      if (argv[1] in presets) {
        const [pps, burst, vision, foresight, can180, finesse] = presets[
          argv[1] as never
        ] as [number, number, number, number, boolean, string];
        this.bot.pps = pps;
        this.bot.burst = burst;
        this.bot.vision = vision;
        this.bot.foresight = foresight;
        this.bot.can180 = can180;
        this.bot.finesse = finesse;
        return await this.sendSettings();
      } else {
        return await this.room.chat(
          `no! (unknown preset; presets are ${Object.keys(presets).map((x) => `"${x}"`)})`
        );
      }
    }

    if (argv[0] === "settings") {
      return await this.sendSettings();
    }
  }

  public async sendSettings() {
    return await this.room.chat(
      `set to pps=${this.bot.pps}; burst=${this.bot.burst}; vision=${this.bot.vision}; foresight=${this.bot.foresight}; finesse=${this.bot.finesse}; can180=${this.bot.can180}`
    );
  }

  public async onGameRoundStart([
    tick,
  ]: Types.Events.in.all["client.game.round.start"]) {
    await this.bot.save();
    await this.bot.reset();

    tick(async (c) => {
      return await this.bot.tick(c);
    });
  }

  public async onGameRoundEnd(c: Types.Events.in.all["client.game.end"]) {
    await this.bot.save();
    await this.bot.reset();

    if (this.room.players.some((x) => x._id === this.cl.user.id)) {
      const won = c.players.filter((x) => x.won);
      if (won.length) {
        if (won.some((x) => x.id === this.cl.user.id)) {
          return await this.room.chat(":happy:");
        } else {
          return await this.room.chat(":sad:");
        }
      }
    }
  }

  public async onGameAbort() {
    return await this.room.chat(":stare:");
  }
}
