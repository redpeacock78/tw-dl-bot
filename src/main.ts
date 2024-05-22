import { serve } from "serve";
import { Hono } from "hono";
import { startBot } from "discordeno";
import api from "@router";
import bot from "@bot/bot.ts";
import { Constants } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const app = new Hono();
app.route("/", api as CallbackTypes.honoType<"" | typeof Constants.BASE_PATH>);

startBot(bot)
  .then((): Promise<void> => serve(app.fetch))
  .catch((): void => console.error("Failed!"));
