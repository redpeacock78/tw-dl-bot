import { Hono } from "hono";
import { Constants } from "@libs";
import { CallbackTypes } from "@router/types/callbackTypes.ts";

const ping: CallbackTypes.honoType<"/"> = new Hono();

ping.get(
  Constants.PING_PATH,
  (c: CallbackTypes.contextType<typeof Constants.PING_PATH>): Response =>
    c.text("OK!")
);

export default ping;
