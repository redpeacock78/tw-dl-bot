import { Secrets, Constants } from "@libs";
import ky, { KyResponse } from "ky";

export const webhook = async (message: {
  content: string;
  channelId: bigint;
  id: bigint;
  token: string;
}): Promise<KyResponse> =>
  await ky.post(Secrets.DISPATCH_URL, {
    json: {
      event_type: Constants.Webhook.Json.EVENT_TYPE,
      client_payload: {
        commandType: Constants.Webhook.Json.ClientPayload.COMMAND_TYPE,
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
