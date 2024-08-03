import { Hono } from "hono";
import { Constants } from "@libs";
import { default as ping } from "@router/ping.ts";
import { default as callback } from "@router/callback.ts";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

type BasePath = typeof Constants.BASE_PATH;
type HonoType<T extends string> = CallbackTypes.honoType<T>;

const rootPath = Constants.ROOT_PATH;
const basePath = Constants.BASE_PATH;
const api: HonoType<BasePath> = new Hono().basePath(basePath);

api.route(rootPath, ping);
api.route(rootPath, callback);

export default api;
