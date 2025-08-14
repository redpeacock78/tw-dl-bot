import unienv from "unienv";
import { Constants } from "@libs";

type ReadonlyRecord<K extends PropertyKey, T> = Readonly<Record<K, T>>;
type ElementOf<T extends readonly unknown[]> = T[number];
type SecretsKeys = ElementOf<typeof Constants.SECRETS>;

const isFullSecrets = (
  values: Partial<Record<SecretsKeys, string>>
): values is Record<SecretsKeys, string> =>
  Constants.SECRETS.every((i) => values[i] !== undefined);

const props = {
  values: {} as Partial<Record<SecretsKeys, string>>,
  errors: [] as Array<string>,
};
const envs = Constants.SECRETS.reduce((acc, i): typeof props => {
  const env = unienv.get(i);
  return env.isNg()
    ? { values: acc.values, errors: [...acc.errors, env.error.message] }
    : !env.value
    ? { values: acc.values, errors: [...acc.errors, `${i} is not set.`] }
    : { values: { ...acc.values, [i]: env.value }, errors: acc.errors };
}, props);

if (envs.errors.length > 0) throw new Error(envs.errors.join("\n"));
if (!isFullSecrets(envs.values)) throw new Error("Not all secrets are set.");

export const Secrets: ReadonlyRecord<SecretsKeys, string> = Object.freeze(
  envs.values
);
