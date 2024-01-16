import { Hono } from "hono";
import { Constants } from "@libs";
import { default as ping } from "@router/ping.ts";
import { default as callback } from "@router/callback.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const api: CallbackTypes.honoType<typeof Constants.BASE_PATH> =
  new Hono().basePath(Constants.BASE_PATH);

api.route("/", ping);
api.route("/", callback);

export default api;
