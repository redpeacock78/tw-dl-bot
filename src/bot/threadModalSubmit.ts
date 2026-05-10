import { Constants } from "@libs";
import { runThreadFlow } from "@bot/runThreadFlow.ts";
import { Bot, Interaction } from "discordeno";

type InteractionData = Exclude<Pick<Interaction, "data">["data"], undefined>;
type InteractionDataComponents = Exclude<
  Pick<InteractionData, "components">["components"],
  undefined
>;

/**
 * Allowlist of customId prefixes our ModalSubmit handler accepts. Anything
 * else is silently ignored — `customId` is user-attacker-controllable in
 * the sense that an arbitrary client could submit a forged ModalSubmit, so
 * we never trust the prefix and only match exact known commandTypes.
 */
const acceptedCommandTypes = new Set<string>([
  Constants.Webhook.Json.ClientPayload.CommandType.THREAD_DOWNLOAD,
  Constants.Webhook.Json.ClientPayload.CommandType.THREAD_DOWNLOAD_SPOILER,
]);

/**
 * Walks the (ActionRow → InputText) component tree and pulls the `value`
 * field out of the InputText whose `customId` matches
 * `Constants.Modal.URLS_INPUT_CUSTOM_ID`. Returns `""` if the tree shape
 * doesn't match (defensive — shouldn't happen with a Modal we built
 * ourselves, but a forged ModalSubmit could).
 */
const extractUrlsFieldValue = (
  components: InteractionDataComponents | undefined,
): string => {
  for (const row of components ?? []) {
    for (const child of row.components ?? []) {
      if (child.customId === Constants.Modal.URLS_INPUT_CUSTOM_ID) {
        return child.value ?? "";
      }
    }
  }
  return "";
};

/**
 * Handles a `ModalSubmit` interaction triggered by the user submitting the
 * thread-URL Modal opened by `threadInteractionCreate`.
 *
 * Flow:
 * 1. Validate the customId prefix is one we own (`threaddl` /
 *    `threaddl-spoiler`). If not, do nothing — silently drop.
 * 2. Extract the thread name from the customId tail.
 * 3. Pull the multiline URL text from the Modal's TextInput, then grep out
 *    every `https?://...` token via regex (delimiter-agnostic — newlines,
 *    spaces, commas, you name it).
 * 4. Hand the (commandType, threadName, urls) tuple off to the shared
 *    `runThreadFlow` (same flow used by the legacy code path).
 *
 * @param props - Handler props bag.
 * @param props.b - The bot instance.
 * @param props.data - The interaction data object (ModalSubmit shape).
 * @param props.interaction - The interaction object.
 * @returns A promise that resolves when the dispatch completes.
 */
export const threadModalSubmit = async (props: {
  b: Bot;
  data: InteractionData;
  interaction: Interaction;
}): Promise<void> => {
  const customId: string = props.data.customId ?? "";
  const sepIdx = customId.indexOf("|");
  if (sepIdx <= 0) return;

  const commandType: string = customId.slice(0, sepIdx);
  if (!acceptedCommandTypes.has(commandType)) return;

  const threadName: string = customId.slice(sepIdx + 1);
  const text: string = extractUrlsFieldValue(props.data.components);
  // Delimiter-agnostic URL extraction (option #7). Lets users separate
  // URLs by newlines, spaces, commas, or anything else without thinking
  // about it. The character class deliberately excludes whitespace and
  // common adjacent punctuation (`,`, `;`) so URLs like
  // `https://x.com/u/1, https://x.com/u/2` aren't captured as one giant
  // URL with a trailing comma.
  const contents: string[] = text.match(/https?:\/\/[^\s,;]+/g) ?? [];

  await runThreadFlow({
    b: props.b,
    interaction: props.interaction,
    commandType,
    threadName,
    contents,
  });
};
