import { Hono } from "hono";
import { default as ping } from "@router/ping.ts";
import { default as callback } from "@router/callback.ts";

const api = new Hono().basePath("/api");

api.route("/", ping);
api.route("/", callback);

export default api;
