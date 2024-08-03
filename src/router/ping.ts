import { Hono } from "hono";
import { Constants } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

type RootPath = typeof Constants.ROOT_PATH;
type PingPath = typeof Constants.PING_PATH;
type HonoType<T extends string> = CallbackTypes.honoType<T>;
type ContentType<T extends string> = CallbackTypes.contextType<T>;

const pingPath = Constants.PING_PATH;
const ping: HonoType<RootPath> = new Hono();

ping.get(pingPath, (c: ContentType<PingPath>): Response => c.text("OK!"));

export default ping;
