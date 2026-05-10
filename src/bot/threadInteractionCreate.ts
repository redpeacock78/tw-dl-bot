import { Constants } from "@libs";
import {
  Bot,
  Interaction,
  InteractionResponseTypes,
  MessageComponentTypes,
  TextStyles,
} from "discordeno";

type InteractionData = Exclude<Pick<Interaction, "data">["data"], undefined>;
type InteractionOption = Exclude<
  Pick<InteractionData, "options">["options"],
  undefined
>[number];

const NAME_OPTION = "name";

/**
 * Resolves a string-typed option from the interaction data by name.
 *
 * @param {InteractionOption[] | undefined} options - The options array of the interaction.
 * @param {string} name - The name of the option to extract.
 * @return {string} The string value of the matched option, or empty string if not found.
 */
const pickOption = (
  options: InteractionOption[] | undefined,
  name: string,
): string =>
  ((options ?? []).find(
    (i: InteractionOption): boolean => i.name === name,
  )?.value as string) ?? "";

/**
 * Handles the `/threaddl` and `/threaddl-spoiler` ApplicationCommand
 * interactions by opening a Discord Modal so the user can paste an
 * arbitrary number of URLs (one per line) without quoting/escaping.
 *
 * The actual thread-creation + dispatch flow does NOT run here — it runs on
 * the follow-up `ModalSubmit` interaction (see `threadModalSubmit.ts`).
 *
 * Why this is split: a Modal must be the *first* response to an interaction.
 * `DeferredChannelMessageWithSource` would consume the response slot and
 * make the Modal impossible. So this handler returns the Modal immediately,
 * and the ModalSubmit handler is the one that ACKs + does the work.
 *
 * customId wire format: `<commandType>|<threadName>` where threadName is
 * truncated to `Constants.Modal.MAX_NAME_IN_CUSTOM_ID` characters.
 * Discord caps `customId` at 100 chars; the longest commandType
 * (`"threaddl-spoiler"`, 16 chars) plus the `|` separator (1 char) leaves
 * 80 chars for the thread name, matching the constant value.
 *
 * @param props - The handler props bag.
 * @param props.b - The bot instance.
 * @param props.data - The interaction data object.
 * @param props.interaction - The interaction object.
 * @param props.commandType - The command type (`threaddl` or `threaddl-spoiler`).
 * @returns A promise that resolves when the Modal response has been sent.
 */
export const threadInteractionCreate = async (props: {
  b: Bot;
  data: InteractionData;
  interaction: Interaction;
  commandType: string;
}): Promise<void> => {
  const rawName: string = pickOption(props.data.options, NAME_OPTION);
  const threadName: string = rawName.slice(
    0,
    Constants.Modal.MAX_NAME_IN_CUSTOM_ID,
  );

  await props.b.helpers.sendInteractionResponse(
    props.interaction.id,
    props.interaction.token,
    {
      type: InteractionResponseTypes.Modal,
      data: {
        title: `Add URLs to "${threadName.slice(0, 40)}"`,
        customId: `${props.commandType}|${threadName}`,
        components: [
          {
            type: MessageComponentTypes.ActionRow,
            components: [
              {
                type: MessageComponentTypes.InputText,
                customId: Constants.Modal.URLS_INPUT_CUSTOM_ID,
                style: TextStyles.Paragraph,
                label: "Tweet URLs",
                placeholder:
                  "Paste one URL per line. Spaces / commas are also fine.",
                required: true,
                minLength: 1,
                maxLength: 4000,
              },
            ],
          },
        ],
      },
    },
  );
};
