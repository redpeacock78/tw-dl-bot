import { Hono } from "hono";

const ping = new Hono();

ping.get("/ping", (c): Response => c.text("OK!"));

export default ping;
