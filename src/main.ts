import { Hono } from "hono";
import { serve } from "serve";
import { startBot } from "discordeno";
import bot from "@bot/bot.ts";
import api from "@router/index.ts";

const app = new Hono();
app.route("/", api);

startBot(bot);
serve(app.fetch);
