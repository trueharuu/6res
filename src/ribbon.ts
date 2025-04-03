import { Client } from "@haelp/teto";

export async function ribbon(token: string) {
  const client = await Client.connect({ token });
  const room = await client.wait("client.room.join");
  const [tick] = await client.wait("client.game.round.start");
  tick(async (data) => {
    
    return {};
  });
}
