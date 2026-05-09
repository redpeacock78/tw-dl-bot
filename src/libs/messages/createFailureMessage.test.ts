import { assertEquals, assertExists } from "@std/assert";
import { Constants } from "@libs";
import createFailureMessage from "./createFailureMessage.ts";

type EmbedFieldLike = { name: string; value: string };

Deno.test("createFailureMessage", async (t) => {
  await t.step("returns {} when info is null", () => {
    assertEquals(createFailureMessage(null), {});
  });

  await t.step("renders FAILURE content + embed with the expected fields", () => {
    const result = createFailureMessage({
      runNumber: "7",
      runTime: 1_500,
      link: "https://example.com",
      content: "something went wrong",
    }) as {
      content: string;
      embeds: Array<{
        description: string;
        color: number;
        fields: EmbedFieldLike[];
      }>;
    };

    assertEquals(result.content, Constants.Message.Content.Status.FAILURE);
    assertExists(result.embeds);
    const embed = result.embeds[0];
    assertEquals(embed.description, "**something went wrong**");
    assertEquals(embed.color, Constants.Message.Color.FAILURE);

    const fieldNames = embed.fields.map((f) => f.name);
    assertEquals(fieldNames, [
      Constants.Message.Embeds.Fields.Names.RUN_NUMBER,
      Constants.Message.Embeds.Fields.Names.TOTAL_TIME,
      Constants.Message.Embeds.Fields.Names.SOURCE_URL,
    ]);

    // RUN_NUMBER value is formatted as `> \`#${runNumber}\``
    assertEquals(embed.fields[0].value, "> `#7`");
    // SOURCE_URL value is `> ${link}`
    assertEquals(embed.fields[2].value, "> https://example.com");
  });
});
