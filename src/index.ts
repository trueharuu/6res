import { Client } from "@haelp/teto";
import "dotenv/config.js";
import { check_settings } from "./check";
import { Bot, FinesseStyle } from "./bot";
import { Room } from "@haelp/teto/dist/types/classes";

(async () => {
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

  
  client.on("client.friended", async (c) => {
    // console.log(c);
    await client.social.friend(c.id);
  });
  
  let room!: Room;
  let bot!: Bot;
  client.on("social.invite", async (c) => {
    room = await client.rooms.join(c.roomid);
    bot = new Bot(room);
    // await room.chat("hi!");
  });

  process.on("SIGINT", async (c) => {
    await room?.leave();
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

    const command = c.content.slice(1).split(/\s+/g); // rust `split_ascii_whitespace` when
    console.log(command);

    if (command[0] === "check") {
      const results = check_settings(client.room!);

      if (results.length === 0) {
        await client.room!.chat("all ok!");
        return;
      }

      await room.chat("something is bad! paste the following to apply fixes:");
      await room.chat("/set " + results.join(";"));
    }

    if (command[0] === "style") {
      const ty = command[1].toLowerCase();
      if (ty === "instant") {
        bot.finesse = FinesseStyle.Instant;
      } else if (ty === "srs180") {
        bot.finesse = FinesseStyle.SRS180;
      } else if (ty === "srsx") {
        bot.finesse = FinesseStyle.SRSX;
      } else if (ty === "srs") {
        bot.finesse = FinesseStyle.SRS;
      } else {
        return await room.chat(
          "invalid finesse style, valid styles are: instant | srs180 | srsx | srs",
        );
      }
    }

    if (command[0] === "pps") {
      const n = Number(command[1]);
      if (Number.isNaN(n)) {
        return await room.chat("not a number");
      }

      if (n > 10) {
        return await room.chat("no! (pps must be <= 10)");
      }

      bot.pps = n;
    }

    if (command[0] === 'vision') {
      const n = Number(command[1]);
      if (Number.isNaN(n)) {
        return await room.chat('not a number');
      }

      if (n > 14 || n < 0) {
        return await room.chat('no! (vision must be <= 14)');
      }

      bot.vision = n;
    }
    

    if (command[0] === 'foresight') {
      const n = Number(command[1]);
      if (Number.isNaN(n)) {
        return await room.chat('not a number');
      }

      if (n > 7 || n < 0) {
        return await room.chat('no! (foresight must be <= 7)');
      }

      bot.foresight = n;
    }

    if (command[0] === "settings") {
      return await room.chat(
        `pps=${bot.pps}; finesse=${bot.finesse}; vision=${bot.vision}; foresight=${bot.foresight}`,
      );
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
      return bot.tick({
        board: c.engine.board,
        hold: c.engine.held,
        queue: c.engine.queue.value,
        current: c.engine.falling.symbol,
        frame: c.frame,
        engine,
      });
    });
  });
})();
