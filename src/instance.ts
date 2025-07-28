import { Classes, Client, Types } from "@haelp/teto";
import { Room } from "./ty";
import { check_settings } from "./check";
import { tracing } from "./tracing";
import { Bot, BotOptions, FinesseStyle, option_descriptions } from "./bot";
import { ty } from "./util";

export class Instance {
  private cl!: Client;
  private room!: Room;
  private bot!: Bot;

  private readonly presets: Record<string, BotOptions> = {
    algebruh: {
      pps: 3.75,
      burst: 4.25,
      slack: 3.25,
      vision: 8,
      foresight: 0,
      can180: false,
      finesse: FinesseStyle.Human,
      start_threshold: 50,
      break_threshold: 5,
      garbage_threshold: 30,
      gb_weight: -1,
      pace: true,
      upstack: true,
    },
    slowbruh: {
      pps: 2,
      burst: 2.5,
      slack: 2,
      vision: 8,
      foresight: 2,
      can180: false,
      finesse: FinesseStyle.Human,
      start_threshold: 0,
      break_threshold: 10,
      garbage_threshold: 0,
      gb_weight: 0,
      pace: true,
      upstack: true,
    },
    madkiwi: {
      pps: 3,
      burst: 4.5,
      slack: 2.5,
      vision: 8,
      foresight: 1,
      can180: true,
      finesse: FinesseStyle.Human,
      start_threshold: 100,
      break_threshold: 10,
      garbage_threshold: 0,
      gb_weight: 1,
      pace: true,
      upstack: true,
    },
    rns: {
      pps: 2,
      burst: 4,
      slack: 0.25,
      vision: 9,
      foresight: 1,
      can180: true,
      finesse: FinesseStyle.Human,
      start_threshold: 4,
      break_threshold: 0,
      garbage_threshold: 1e9,
      gb_weight: 0,
      pace: true,
      upstack: true,
    },
    mina: {
      pps: 3.75,
      burst: 5,
      slack: 3.25,
      vision: 4,
      foresight: 1,
      can180: true,
      finesse: FinesseStyle.Human,
      start_threshold: 100,
      break_threshold: 15,
      garbage_threshold: 150,
      gb_weight: -1,
      pace: true,
      upstack: true,
    },
    bot: {
      pps: 4,
      burst: 4,
      slack: 4,
      vision: 14,
      foresight: 1,
      can180: true,
      finesse: FinesseStyle.Instant,
      start_threshold: 0,
      break_threshold: 0,
      garbage_threshold: 0,
      gb_weight: 0,
      pace: false,
      upstack: true,
    },
    impossible: {
      pps: 5,
      burst: 5,
      slack: 5,
      vision: 28,
      foresight: 1,
      can180: true,
      finesse: FinesseStyle.Instant,
      start_threshold: 0,
      break_threshold: 0,
      garbage_threshold: 0,
      gb_weight: 0,
      pace: false,
      upstack: true,
    },
    cancel: {
      pps: 1,
      burst: 20,
      slack: 1,
      vision: 4,
      foresight: 1,
      can180: true,
      finesse: FinesseStyle.Instant,
      start_threshold: 0,
      break_threshold: 0,
      garbage_threshold: 0,
      gb_weight: 1,
      pace: true,
      upstack: true,
    },
  } as const;

  public dead: boolean = false;
  public constructor(
    private options: Classes.ClientOptions,
    private code: string
  ) {
    process.on("SIGINT", async (c) => {
      tracing.error(`sigint ${this.code}`);
      await this.kill();
    });
  }
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

  private lock: boolean = false;
  public async kill() {
    this.bot.spool.kill();
    await this.room.chat(":crying:");
    await this.room.leave();

    tracing.warn(tracing.tag(this.code), "was killed");
  }

  public async onRoomChat(c: Types.Events.in.all["room.chat"]) {
    if (c.system || c.user.role === "bot") {
      return;
    }

    if (!c.content.startsWith(process.env.PREFIX!)) {
      return;
    }

    const argv = c.content
      .slice(1)
      .split(" ")
      .map((x) => x.toLowerCase());

    if (argv[0] === "help") {
      return await this.sendHelp(argv[1]);
    }

    if (argv[0] === "settings") {
      return await this.sendSettings();
    }

    if (
      this.room.owner !== c.user._id &&
      !process.env.HOSTS?.split(",").includes(c.user._id)
    ) {
      return await this.room.chat("no! (unauthorized)");
    }

    if (argv[0] === "pps") {
      const n = Number(argv[1]);
      if (Number.isNaN(n)) {
        return await this.room.chat("no! (not a number)");
      }

      if (n > 30 || n <= 0) {
        return await this.room.chat("no! (must be 0 < pps <= 30)");
      }

      await this.room.chat(`ok pps=${n}`);

      this.bot.options.pps = n;
    }

    if (argv[0] === "burst") {
      const n = Number(argv[1]);
      if (Number.isNaN(n)) {
        return await this.room.chat("no! (not a number)");
      }

      if (n > 30 || n < 0) {
        return await this.room.chat("no! (must be 0 <= burst <= 30)");
      }

      if (!this.bot.options.pace) {
        await this.paceWarning();
      }

      await this.room.chat(`ok burst=${n}`);

      this.bot.options.burst = n;
    }

    if (argv[0] === "slack") {
      const n = Number(argv[1]);
      if (Number.isNaN(n)) {
        return await this.room.chat("no! (not a number)");
      }

      if (n > 30 || n < 0) {
        return await this.room.chat("no! (must be 0 <= burst <= 30)");
      }

      if (!this.bot.options.pace) {
        await this.paceWarning();
      }

      await this.room.chat(`ok slack=${n}`);

      this.bot.options.slack = n;
    }

    if (argv[0] === "vision") {
      const n = Number(argv[1]);
      if (Number.isNaN(n)) {
        return await this.room.chat("no! (not a number)");
      }

      if (n > 35 || n < 2) {
        return await this.room.chat("no! (must be 2 <= vision <= 35)");
      }

      await this.room.chat(`ok vision=${n}`);

      this.bot.options.vision = n;
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

      this.bot.options.foresight = n;
    }

    if (argv[0] === "can180") {
      if (argv[1] === "true") {
        this.bot.options.can180 = true;
      } else if (argv[1] === "false") {
        this.bot.options.can180 = false;
      } else {
        return await this.room.chat(
          'no! (can180 must be one of "true" | "false")'
        );
      }
    }

    if (argv[0] === "upstack") {
      if (argv[1] === "true") {
        this.bot.options.upstack = true;
      } else if (argv[1] === "false") {
        this.bot.options.upstack = false;
      } else {
        return await this.room.chat(
          'no! (upstack must be one of "true" | "false")'
        );
      }
    }

    if (argv[0] === "finesse") {
      if (argv[1] === "human") {
        this.bot.options.finesse = FinesseStyle.Human;
        await this.room.chat(`ok finesse=${argv[1]}`);
      } else if (argv[1] === "instant") {
        this.bot.options.finesse = FinesseStyle.Instant;
        await this.room.chat(`ok finesse=${argv[1]}`);
      } else {
        return await this.room.chat(
          'no! (finesse must be one of "human", "instant")'
        );
      }
    }

    if (argv[0] === "start_threshold") {
      const n = Number(argv[1]);
      if (Number.isNaN(n)) {
        return await this.room.chat("no! (not a number)");
      }

      if (n < 0) {
        return await this.room.chat("no! (must be 0 < threshold)");
      }

      if (!this.bot.options.pace) {
        await this.paceWarning();
      }

      await this.room.chat(`ok start_threshold=${n}`);

      this.bot.options.start_threshold = n;
    }

    if (argv[0] === "break_threshold") {
      const n = Number(argv[1]);
      if (Number.isNaN(n)) {
        return await this.room.chat("no! (not a number)");
      }

      if (n < 0) {
        return await this.room.chat("no! (must be 0 < threshold)");
      }

      if (!this.bot.options.pace) {
        await this.paceWarning();
      }

      await this.room.chat(`ok break_threshold=${n}`);

      this.bot.options.break_threshold = n;
    }

    if (argv[0] === "garbage_threshold") {
      const n = Number(argv[1]);
      if (Number.isNaN(n)) {
        return await this.room.chat("no! (not a number)");
      }

      if (!this.bot.options.pace) {
        await this.paceWarning();
      }

      if (n < 0) {
        return await this.room.chat("no! (must be 0 < threshold)");
      }

      await this.room.chat(`ok garbage_threshold=${n}`);

      this.bot.options.garbage_threshold = n;
    }

    if (argv[0] === "gb_weight") {
      const n = Number(argv[1]);
      if (Number.isNaN(n)) {
        return await this.room.chat("no! (not a number)");
      }

      if (!this.bot.options.pace) {
        await this.paceWarning();
      }

      if (n < -1 || n > 1) {
        return await this.room.chat("no! (must be -1 < weight < 1)");
      }

      await this.room.chat(`ok gb_weight=${n}`);

      this.bot.options.gb_weight = n;
    }

    if (argv[0] === "pace") {
      if (argv[1] === "true") {
        this.bot.options.pace = true;
        return await this.room.chat("ok pace=true");
      } else if (argv[1] === "false") {
        this.bot.options.pace = false;
        return await this.room.chat("ok pace=false");
      } else {
        return await this.room.chat(
          'no! (pace must be one of "true" | "false")'
        );
      }
    }

    if (argv[0] === "preset") {
      if (argv[1] in this.presets) {
        this.bot.options = this.presets[argv[1]];

        return await this.sendSettings();
      } else {
        return await this.room.chat(
          `no! (unknown preset; presets are ${Object.keys(this.presets).join(", ")})`
        );
      }
    }
  }

  public async sendHelp(c?: string) {
    if (c) {
      if (c === "help") {
        return await this.room.chat("it's this one");
      }

      if (c === "preset") {
        return await this.room.chat(
          `available presets are: ${Object.keys(this.presets).join(", ")}`
        );
      }

      if (c in this.bot.options) {
        return await this.room.chat(
          `${c}:\n${option_descriptions[c as keyof typeof option_descriptions]}`
        );
      }

      return await this.room.chat("no! (not an option)");
    }

    return await this.room.chat(
      `available commands:\n${ty.keys(this.bot.options).join(", ")}\n\njoin 4w lounge:\nhttps://discord.gg/7SnE8xwMMU`
    );
  }

  public async paceWarning() {
    return await this.room.chat(
      "hey! this setting does nothing without [pace]!"
    );
  }

  public async sendSettings() {
    const keys = Object.keys(this.bot.options);
    const values = Object.values(this.bot.options);

    const longest_k = Math.max(...keys.map((x) => x.length));
    const longest_v = Math.max(...values.map((x) => String(x).length));

    return await this.room.chat(
      "key".padStart(longest_k, " ") +
        " | " +
        "value".padEnd(longest_v, " ") +
        "\n" +
        "-".repeat(longest_k) +
        "---" +
        "-".repeat(longest_v) +
        "\n" +
        keys
          .map(
            (x) =>
              x.padStart(longest_k, " ") +
              " | " +
              this.bot.options[x as keyof typeof this.bot.options]
          )
          .join("\n")
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
