import { Client } from "@haelp/teto";
import "dotenv/config.js";
import { check_settings } from "./check";

import { Key, KeyPress, Room } from "./ty";
import { Bot } from "./bot";
import { tracing } from "./tracing";
import { Instance } from "./instance";
// import { displayBoard, getNextBoards, hashBoard, unhashBoard } from "./usm";

// console.log(process.env)
// tracing.debug(tracing.level);
process.on("unhandledRejection", (c) => {
  tracing.error(c);
});
process.on("uncaughtException", (c) => {
  tracing.error(c);
});
// import * as solver_lib from "./usm/solver_lib";
(async () => {
  const login = {
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
  } as const;
  // tracing.info("test");

  tracing.perf("init");
  const master = await Client.connect(login);
  tracing.perf("init");

  master.on("social.relation.add", async (c) => {
    await master.social.friend(c._id).catch(tracing.safe);
  });

  // tracing.info(master.social.friends.map((x) => `${x.username} ${x.id}`));

  const is: Array<Instance> = [];

  master.on("social.invite", async (c) => {
    tracing.info(`got invited to ${tracing.tag(c.roomid)}`);
    const instance = new Instance(login, c.roomid);
    await instance.spawn();
    await instance.join();
    is.push(instance);
  });

  process.on("SIGINT", async (c) => {
    await master.destroy();
    setTimeout(() => {
      tracing.fatal('max timeout hit')
    }, 1000);
  });
})();
