import { assertEquals } from "@std/assert";
import { assertSpyCallArg, assertSpyCalls, spy } from "@std/testing/mock";
import type { Bot } from "discordeno";
import { registerCommands } from "../../src/bot/registerCommands.ts";
import { Commands } from "../../src/bot/commands.ts";

Deno.test("registerCommands", async (t) => {
  await t.step(
    "calls createGlobalApplicationCommand once per slash command, in order",
    async () => {
      const createGlobalApplicationCommand = spy(
        (_cmd: unknown) => Promise.resolve({} as never),
      );
      const fakeBot = {
        helpers: { createGlobalApplicationCommand },
      } as unknown as Bot;

      await registerCommands(fakeBot);

      assertSpyCalls(createGlobalApplicationCommand, 3);
      assertSpyCallArg(createGlobalApplicationCommand, 0, 0, Commands.dlCommand);
      assertSpyCallArg(
        createGlobalApplicationCommand,
        1,
        0,
        Commands.dlSpoilerCommand,
      );
      assertSpyCallArg(
        createGlobalApplicationCommand,
        2,
        0,
        Commands.threadDlCommand,
      );
    },
  );

  await t.step(
    "awaits each call sequentially (second call observes first call settled)",
    async () => {
      const order: string[] = [];
      let resolveFirst!: () => void;
      const firstSettled = new Promise<void>((r) => (resolveFirst = r));
      let firstStarted = false;

      const createGlobalApplicationCommand = spy((cmd: { name: string }) => {
        order.push(`start:${cmd.name}`);
        if (!firstStarted) {
          firstStarted = true;
          return firstSettled.then(() => {
            order.push(`end:${cmd.name}`);
            return {} as never;
          });
        }
        order.push(`end:${cmd.name}`);
        return Promise.resolve({} as never);
      });

      const fakeBot = {
        helpers: { createGlobalApplicationCommand },
      } as unknown as Bot;

      const done = registerCommands(fakeBot);
      // give the first call a chance to start
      await Promise.resolve();
      assertEquals(order, [`start:${Commands.dlCommand.name}`]);

      // unblock the first; only then should the second start
      resolveFirst();
      await done;

      assertEquals(order, [
        `start:${Commands.dlCommand.name}`,
        `end:${Commands.dlCommand.name}`,
        `start:${Commands.dlSpoilerCommand.name}`,
        `end:${Commands.dlSpoilerCommand.name}`,
        `start:${Commands.threadDlCommand.name}`,
        `end:${Commands.threadDlCommand.name}`,
      ]);
    },
  );
});
