import { Client } from "@haelp/teto";
import "dotenv/config.js";

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

  client.on("social.invite", async (c) => {
    const room = await client.rooms.join(c.roomid);
    await room.chat("!");
  });
})();
