import unienv from "unienv";

const dispatchUrl = unienv.get("DISPATCH_URL");
const githubToken = unienv.get("GITHUB_TOKEN");
const discordToken = unienv.get("DISCORD_TOKEN");

if (dispatchUrl.isNg()) throw dispatchUrl.error;
if (githubToken.isNg()) throw githubToken.error;
if (discordToken.isNg()) throw discordToken.error;

if (!dispatchUrl.value) throw new Error("DISPATCH_URL is not set.");
if (!githubToken.value) throw new Error("GITHUB_TOKEN is not set.");
if (!discordToken.value) throw new Error("DISCORD_TOKEN is not set.");

export const Secrets = {
  DISPATCH_URL: dispatchUrl.value,
  GITHUB_TOKEN: githubToken.value,
  DISCORD_TOKEN: discordToken.value,
} as const satisfies Record<string, string>;
