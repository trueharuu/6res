import { Client } from "@haelp/teto";
import "dotenv/config.js";
import { check_settings } from "./check";
import { Bot } from "./bot";
import { Room } from "@haelp/teto/dist/types/classes";

(async () => {
  const client = await Client.connect({
    token: process.env.token!,
    ribbon: { codec: "candor", verbose: true },
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

  client.on("client.friended", async (c) => {
    console.log(c);
    await client.social.friend(c.id);
  });

  let room!: Room;
  let bot!: Bot;
  client.on("social.invite", async (c) => {
    room = await client.rooms.join(c.roomid);
    bot = new Bot(room);
    await room.chat("hi!");
  });

  client.on("room.update.bracket", async (c) => {
    if (c.uid === client.user.id && c.bracket === "player") {
      const results = check_settings(client.room!);
      if (results.length > 0) {
        await client.room!.chat(
          "something is bad! paste the following to apply fixes:",
        );
        await client.room!.chat("/set " + results.join(";"));
        await client.room!.switch("spectator");
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

    const command = c.content.slice(1).split(/s+/g); // rust `split_ascii_whitespace` when

    if (command[0] === "check") {
      const results = check_settings(client.room!);

      if (results.length === 0) {
        await client.room!.chat("all ok!");
        return;
      }

      await room.chat("something is bad! paste the following to apply fixes:");
      await room.chat("/set " + results.join(";"));
    }
  });

  client.on("client.game.start", async (c) => {
    await room.chat("golf");
  });

  client.on("client.game.end", async (c) => {
    await room.chat("ggwp");
  });

  client.on("client.game.round.start", ([tick, engine, settings]) => {
    tick(async (c) => {
      return bot.tick(c.frame, {
        board: c.engine.board,
        hold: c.engine.held,
        queue: c.engine.queue.value,
      });
    });
  });
})();
