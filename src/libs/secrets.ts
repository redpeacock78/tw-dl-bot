import unienv from "unienv";
import { Constants } from "@libs/index.ts";

const envs = Constants.SECTRETS.reduce(
  (acc, i) => {
    const env = unienv.get(i);
    env.isNg()
      ? acc.errors.push(env.error.message)
      : !env.value
      ? acc.errors.push(`${i} is not set.`)
      : (acc.values[i] = env.value);
    return acc;
  },
  {
    values: {} as Record<(typeof Constants.SECTRETS)[number], string>,
    errors: [] as string[],
  }
);

if (envs.errors.length > 0) throw new Error(envs.errors.join("\n"));

export const Secrets = Object.freeze(envs.values);
