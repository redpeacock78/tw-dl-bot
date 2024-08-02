import unienv from "unienv";

const discordToken = unienv.get("DISCORD_TOKEN");
const dispatchUrl = unienv.get("DISPATCH_URL");
const githubToken = unienv.get("GITHUB_TOKEN");

if (discordToken.isNg()) throw new Error(discordToken.error.message);
if (dispatchUrl.isNg()) throw new Error(dispatchUrl.error.message);
if (githubToken.isNg()) throw new Error(githubToken.error.message);

if (!discordToken.value) throw new Error("DISCORD_TOKEN is not set.");
if (!dispatchUrl.value) throw new Error("DISPATCH_URL is not set.");
if (!githubToken.value) throw new Error("GITHUB_TOKEN is not set.");

export const Secrets = {
  DISCORD_TOKEN: discordToken.value,
  DISPATCH_URL: dispatchUrl.value,
  GITHUB_TOKEN: githubToken.value,
};
