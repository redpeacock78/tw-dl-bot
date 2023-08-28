import "dotenv";

export const Secrets = {
  DISCORD_TOKEN: Deno.env.get("DISCORD_TOKEN")!,
  DISPATCH_URL: Deno.env.get("DISPATCH_URL")!,
  GITHUB_TOKEN: Deno.env.get("GITHUB_TOKEN")!,
};
