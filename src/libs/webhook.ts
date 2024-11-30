import { Secrets, Constants } from "@libs";
import ky, { KyResponse } from "ky";

/**
 * Sends a webhook message with the provided content to a specified channel.
 *
 * @param {object} message - The message object containing content, channelId, id, and token.
 * @return {Promise<KyResponse>} A promise that resolves with the response from the webhook request.
 */
export const webhook = async (message: {
  commandType: string;
  content: string;
  channelId: bigint;
  id: bigint;
  token: string;
}): Promise<KyResponse> =>
  await ky.post(Secrets.DISPATCH_URL, {
    json: {
      event_type: Constants.Webhook.Json.EVENT_TYPE,
      client_payload: {
        commandType: message.commandType,
        link: message.content,
        channel: `${message.channelId}`,
        message: `${message.id}`,
        token: message.token,
        startTime: new Date().getTime().toString(),
      },
    },
    headers: {
      Authorization: `token ${Secrets.GITHUB_TOKEN}`,
      Accept: Constants.Webhook.Headers.ACCEPT,
    },
  });
