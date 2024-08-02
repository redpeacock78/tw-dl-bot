import unienv from "unienv";

const dispatchUrl = unienv.get("DISPATCH_URL");
const githubToken = unienv.get("GITHUB_TOKEN");
const discordToken = unienv.get("DISCORD_TOKEN");

if (dispatchUrl.isNg()) throw new Error(dispatchUrl.error.message);
if (githubToken.isNg()) throw new Error(githubToken.error.message);
if (discordToken.isNg()) throw new Error(discordToken.error.message);

if (!dispatchUrl.value) throw new Error("DISPATCH_URL is not set.");
if (!githubToken.value) throw new Error("GITHUB_TOKEN is not set.");
if (!discordToken.value) throw new Error("DISCORD_TOKEN is not set.");

export const Secrets = {
  DISPATCH_URL: dispatchUrl.value,
  GITHUB_TOKEN: githubToken.value,
  DISCORD_TOKEN: discordToken.value,
};
