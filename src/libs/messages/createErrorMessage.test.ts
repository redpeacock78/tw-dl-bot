import { assertEquals, assertExists } from "@std/assert";
import { Constants } from "@libs";
import createErrorMessage from "./createErrorMessage.ts";

type EmbedFieldLike = { name: string; value: string };

Deno.test("createErrorMessage", async (t) => {
  await t.step("returns an empty object when info is null", () => {
    assertEquals(createErrorMessage(null), {});
  });

  await t.step("renders ERROR content + an embed with description and color", () => {
    const result = createErrorMessage({ description: "boom" }) as {
      content: string;
      embeds: Array<{
        description: string;
        color: number;
        timestamp: number;
        fields?: EmbedFieldLike[];
      }>;
    };

    assertEquals(result.content, Constants.Message.Content.Status.ERROR);
    assertExists(result.embeds);
    assertEquals(result.embeds.length, 1);

    const embed = result.embeds[0];
    assertEquals(embed.description, "**boom**");
    assertEquals(embed.color, Constants.Message.Color.ERROR);
    assertEquals(typeof embed.timestamp, "number");
    // No link → no fields key on embed
    assertEquals(embed.fields, undefined);
  });

  await t.step("includes SOURCE_URL field when link is given", () => {
    const result = createErrorMessage({
      description: "fail",
      link: "https://example.com/x",
    }) as { embeds: Array<{ fields: EmbedFieldLike[] }> };

    const fields = result.embeds[0].fields;
    assertEquals(fields.length, 1);
    assertEquals(
      fields[0].name,
      Constants.Message.Embeds.Fields.Names.SOURCE_URL,
    );
    assertEquals(fields[0].value, "> https://example.com/x");
  });

  await t.step("places RUN_NUMBER before SOURCE_URL when both supplied", () => {
    const result = createErrorMessage({
      description: "x",
      link: "https://example.com",
      runNumber: "42",
    }) as { embeds: Array<{ fields: EmbedFieldLike[] }> };

    const fields = result.embeds[0].fields;
    assertEquals(fields.length, 2);
    assertEquals(
      fields[0].name,
      Constants.Message.Embeds.Fields.Names.RUN_NUMBER,
    );
    assertEquals(fields[0].value, "> `#42`");
    assertEquals(
      fields[1].name,
      Constants.Message.Embeds.Fields.Names.SOURCE_URL,
    );
  });

  await t.step("attaches messageReference when messageId AND channelId given", () => {
    const result = createErrorMessage({
      description: "x",
      messageId: "m1",
      channelId: "c1",
    }) as {
      messageReference?: {
        messageId: string;
        channelId: string;
        failIfNotExists: boolean;
      };
    };

    assertExists(result.messageReference);
    assertEquals(result.messageReference!.messageId, "m1");
    assertEquals(result.messageReference!.channelId, "c1");
    assertEquals(result.messageReference!.failIfNotExists, true);
  });

  await t.step("omits messageReference when only one of the two is provided", () => {
    const result = createErrorMessage({
      description: "x",
      messageId: "m1",
    }) as { messageReference?: unknown };
    assertEquals(result.messageReference, undefined);
  });
});
