import { Hono } from "hono";
import { serve } from "serve";
import { startBot } from "discordeno";
import api from "@router";
import bot from "@bot/bot.ts";

const app = new Hono();
app.route("/", api);

startBot(bot)
  .then((): Promise<void> => serve(app.fetch))
  .catch((): void => console.error("Failed!"));
