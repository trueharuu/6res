import { Client } from "@haelp/teto";
import "dotenv/config.js";
import { check_settings } from "./check";

import { Key, KeyPress, Room } from "./ty";
import { Bot } from "./bot";
import { tracing } from "./tracing";
// import { displayBoard, getNextBoards, hashBoard, unhashBoard } from "./usm";

// import * as solver_lib from "./usm/solver_lib";
let room!: Room;
let bot!: Bot;

process.on("SIGINT", async (c) => {
  if (room) {
    await room.chat(":sad:");
    await room.leave();
  }

  tracing.fatal("recieved keyboard interrupt");
});

(async () => {
  // tracing.info("test");

  tracing.perf("init");
  const client = await Client.connect({
    token: process.env.token!,
    ribbon: { codec: "candor", verbose: false },
    handling: {
      arr: 0,
      cancel: false,
      das: 1,
      dcd: 0,
      ihs: "off",
      irs: "off",
      may20g: false,
      safelock: true,
      sdf: 41,
    },
  });

  client.on("kick", (c) => {
    tracing.warn(`kicked for ${tracing.tag(c.reason)}`);
  });

  tracing.perf("init");

  client.on("error", (c) => {
    tracing.error(c);
  });

  client.on("client.friended", async (c) => {
    await client.social.friend(c.id);
  });

  client.on("social.invite", async (c) => {
    tracing.info(`got invited to ${c.roomid}`);
    if (room) {
      if (!process.env.HOSTS?.split(",").includes(c.sender)) {
        await client.social.dm(c.sender, "already in a room :(");
        return;
      }

      await room.leave();
    }
    room = await client.rooms.join(c.roomid);
    if (check_settings(room.options).length === 0) {
      await room.switch("player");
    }
    bot = new Bot(room);
  });

  client.on("room.update.bracket", async (c) => {
    if (c.uid === client.user.id && c.bracket === "player") {
      const results = check_settings(room.options);
      if (results.length > 0) {
        await client.room!.chat(
          "something is bad! paste the following to apply fixes:"
        );
        await room.chat("/set " + results.join(";"));
        await room.switch("spectator");
      }
    }
  });

  client.on("room.chat", async (c) => {
    // not a command
    if (!c.content.startsWith("~")) {
      return;
    }

    // computer isn't human
    if (c.user.role === "bot") {
      return;
    }

    const command = c.content.slice(1).split(/\s+/g); // rust `split_ascii_whitespace` when

    if (
      c.user._id !== room.owner &&
      !process.env.HOSTS?.split(",").includes(c.user._id)
    ) {
      return;
    }

    if (command[0] === "check") {
      const results = check_settings(room.options);

      if (results.length === 0) {
        await client.room!.chat("all ok!");
        return;
      }

      await room.chat("something is bad! paste the following to apply fixes:");
      await room.chat("/set " + results.join(";"));
    }

    if (command[0] === "pps") {
      const n = Number(command[1]);
      if (Number.isNaN(n)) {
        return await room.chat("not a number");
      }

      if (n > 30) {
        return await room.chat("no! (pps must be <= 30)");
      }

      bot.pps = n;
    }

    if (command[0] === "vision") {
      const n = Number(command[1]);
      if (Number.isNaN(n)) {
        return await room.chat("not a number");
      }

      if (n > 14 || n < 0) {
        return await room.chat("no! (vision must be <= 14)");
      }

      // bot.vision = n;
    }

    if (command[0] === "foresight") {
      const n = Number(command[1]);
      if (Number.isNaN(n)) {
        return await room.chat("not a number");
      }

      if (n > 7 || n < 0) {
        return await room.chat("no! (foresight must be <= 7)");
      }

      // bot.foresight = n;
    }

    if (command[0] === "settings") {
      // return await room.chat(
      //   `pps=${bot.pps}; finesse=${bot.finesse}; vision=${bot.vision}; foresight=${bot.foresight}`
      // );
    }
  });

  client.on("client.game.start", async (c) => {
    if (c.players.some((x) => x.id === client.user.id)) {
      await room.chat("glhf");
    }
  });

  client.on("client.game.end", async (c) => {
    if (c.players.some((x) => x.id === client.user.id)) {
      await room.chat("ggwp");
    }
  });

  client.on("client.game.round.start", ([tick, engine, settings]) => {
    tick(async (c) => {
      const frame = c.frame;
      let keys: KeyPress[] = [];
      if (frame % (bot.fps / bot.pps) === 0) {
        const t = Date.now();
        tracing.perf("syscall");
        let ks = await bot.key_queue(engine);
        ks.push("hardDrop");
        ks = ks.flatMap((x) => ["softDrop", x]);
        tracing.perf("syscall");

        // console.log(`\x1b[32m${ks}\x1b[0m`);
        let r_subframe = 0;
        for (const key of ks) {
          keys.push({
            frame,
            type: "keydown",
            data: { key, subframe: r_subframe },
          });

          if (key === "softDrop") {
            r_subframe += 0.1;
          }

          keys.push({
            frame,
            type: "keyup",
            data: { key, subframe: r_subframe },
          });
        }
      }

      return { keys };
    });
  });
})();
