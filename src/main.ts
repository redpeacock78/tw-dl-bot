import { serve } from "serve";
import { Hono } from "hono";
import { startBot } from "discordeno";
import api from "@router";
import bot from "@bot/bot.ts";
import { registerCommands } from "@bot/registerCommands.ts";
import { Constants, Bot } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const app = new Hono();
app.route(
  Constants.ROOT_PATH,
  api as CallbackTypes.honoType<"" | typeof Constants.BASE_PATH>
);

// Register slash commands before connecting. Previously this was a
// top-level `await` inside `bot.ts`; moved here so importing `bot.ts`
// is side-effect-free for unit tests.
await registerCommands(bot);

startBot(bot)
  .then((): void => {
    try {
      serve(app.fetch);
      Bot.updateRAMUsage2BotStatus(bot);
    } catch (e) {
      throw e as Error;
    }
  })
  .catch((e): void => {
    console.group("Error while starting the bot");
    console.error("Failed!", e);
    console.groupEnd();
  });
