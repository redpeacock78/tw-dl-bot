import { serve } from "serve";
import { Hono } from "hono";
import { startBot, editBotStatus, ActivityTypes } from "discordeno";
import api from "@router";
import bot from "@bot/bot.ts";
import { Constants } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const app = new Hono();
app.route("/", api as CallbackTypes.honoType<"" | typeof Constants.BASE_PATH>);

startBot(bot)
  .then((): void => {
    try {
      serve(app.fetch);
      setInterval(() => {
        const usageMemory = Deno.memoryUsage().rss;
        const totalMemory = Deno.systemMemoryInfo().total;
        const memoryPercent = Number.parseFloat(
          `${(usageMemory / totalMemory) * 100}`
        ).toFixed(2);
        try {
          editBotStatus(bot, {
            activities: [
              {
                name: `RAM Usage: ${memoryPercent}%`,
                type: ActivityTypes.Game,
                createdAt: Date.now(),
              },
            ],
            status: "online",
          });
        } catch (e) {
          throw new Error(e);
        }
      }, 10000);
    } catch (e) {
      throw new Error(e);
    }
  })
  .catch((): void => console.error("Failed!"));
