import { assertEquals, assertStringIncludes } from "@std/assert";

const SCRIPT = new URL(
  "../../.github/scripts/run.sh",
  import.meta.url,
).pathname;

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

const runScript = async (
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number; stdout: string; stderr: string }> => {
  const command = new Deno.Command("bash", {
    args: [SCRIPT, ...args],
    env: {
      GITHUB_EVENT_PATH: "",
      ...env,
    },
    stdout: "piped",
    stderr: "piped",
  });
  const result = await command.output();
  return {
    code: result.code,
    stdout: decode(result.stdout),
    stderr: decode(result.stderr),
  };
};

const makeFakeCurl = async (
  directory: string,
): Promise<{ path: string; capturePath: string }> => {
  const binDirectory = `${directory}/bin`;
  await Deno.mkdir(binDirectory, { recursive: true });
  const capturePath = `${directory}/curl.log`;
  const curlPath = `${binDirectory}/curl`;
  await Deno.writeTextFile(
    curlPath,
    `#!/usr/bin/env bash
capture_next=false
if [[ "\${CAPTURE_FORM:-false}" == true ]]; then
  printf '%s\n' "$@" >> "\${CAPTURE_FILE}"
  printf '200'
  exit 0
fi
for arg in "$@"; do
  if [[ "\${capture_next}" == true ]]; then
    printf '%s\n' "\${arg}" >> "\${CAPTURE_FILE}"
    capture_next=false
  elif [[ "\${arg}" == "-d" ]]; then
    capture_next=true
  fi
done
printf '200'
`,
  );
  await Deno.chmod(curlPath, 0o755);
  return {
    path: `${binDirectory}:${Deno.env.get("PATH") ?? "/usr/bin:/bin"}`,
    capturePath,
  };
};

Deno.test("run.sh", async (t) => {
  await t.step("mask emits one GitHub command per payload secret", async () => {
    const tempDirectory = await Deno.makeTempDir();
    try {
      const eventPath = `${tempDirectory}/event.json`;
      await Deno.writeTextFile(
        eventPath,
        JSON.stringify({
          client_payload: {
            commandType: "dl",
            link: "https://example.test/a?x=1&y=2",
            channel: "channel-1",
            message: "message-1",
            token: "token-1",
            cookie: "auth_token=aaa; ct0=bbb",
          },
        }),
      );

      const result = await runScript(["mask"], {
        GITHUB_EVENT_PATH: eventPath,
      });

      assertEquals(result.code, 0);
      assertEquals(
        result.stdout,
        "::add-mask::dl\n" +
          "::add-mask::https://example.test/a?x=1&y=2\n" +
          "::add-mask::channel-1\n" +
          "::add-mask::message-1\n" +
          "::add-mask::token-1\n" +
          "::add-mask::auth_token=aaa; ct0=bbb\n",
      );
    } finally {
      await Deno.remove(tempDirectory, { recursive: true });
    }
  });

  await t.step(
    "check-link sends the request cookie when one is present",
    async () => {
      const tempDirectory = await Deno.makeTempDir();
      try {
        const fakeCurl = await makeFakeCurl(tempDirectory);
        const eventPath = `${tempDirectory}/event.json`;
        await Deno.writeTextFile(
          eventPath,
          JSON.stringify({
            client_payload: {
              commandType: "dl",
              link: "https://twitter.com/user/status/1",
              channel: "channel-1",
              message: "message-1",
              token: "token-1",
              cookie: "auth_token=aaa; ct0=bbb",
            },
          }),
        );

        const result = await runScript(["check-link"], {
          PATH: fakeCurl.path,
          CAPTURE_FILE: fakeCurl.capturePath,
          CAPTURE_FORM: "true",
          ENDPOINT_URL: "http://callback.test",
          GITHUB_EVENT_PATH: eventPath,
        });

        assertEquals(result.code, 0);
        const requestLog = await Deno.readTextFile(fakeCurl.capturePath);
        assertStringIncludes(requestLog, "--cookie");
        assertStringIncludes(requestLog, "auth_token=aaa; ct0=bbb");
      } finally {
        await Deno.remove(tempDirectory, { recursive: true });
      }
    },
  );

  await t.step(
    "download converts request cookies to Netscape format with or without a trailing semicolon",
    async () => {
      const outputs: string[] = [];

      for (
        const cookie of [
          "auth_token=aaa; ct0=b=b",
          "auth_token=aaa; ct0=b=b;",
        ]
      ) {
        const tempDirectory = await Deno.makeTempDir();
        try {
          const workspace = `${tempDirectory}/workspace`;
          const scriptDirectory = `${workspace}/.github/scripts`;
          const binDirectory = `${tempDirectory}/bin`;
          const capturePath = `${tempDirectory}/curl.log`;
          const cookieCapturePath = `${tempDirectory}/cookie.txt`;
          await Deno.mkdir(scriptDirectory, { recursive: true });
          await Deno.mkdir(binDirectory, { recursive: true });
          await Deno.copyFile(
            new URL("../../.github/scripts/retry_curl.sh", import.meta.url)
              .pathname,
            `${scriptDirectory}/retry_curl.sh`,
          );

          await Deno.writeTextFile(
            `${binDirectory}/curl`,
            `#!/usr/bin/env bash
printf '200'
`,
          );
          await Deno.chmod(`${binDirectory}/curl`, 0o755);

          await Deno.writeTextFile(
            `${binDirectory}/yt-dlp`,
            `#!/usr/bin/env bash
cookie_file=""
while (( $# > 0 )); do
  if [[ "$1" == "--cookies" ]]; then
    shift
    cookie_file="$1"
  fi
  shift
done
cp "${cookie_file}" "${COOKIE_CAPTURE}"
touch "${PWD}/fake.mp4"
printf 'downloaded\\n'
`,
          );
          await Deno.chmod(`${binDirectory}/yt-dlp`, 0o755);

          await Deno.writeTextFile(
            `${binDirectory}/ffprobe`,
            "#!/usr/bin/env bash\nexit 0\n",
          );
          await Deno.chmod(`${binDirectory}/ffprobe`, 0o755);

          const eventPath = `${tempDirectory}/event.json`;
          await Deno.writeTextFile(
            eventPath,
            JSON.stringify({
              client_payload: {
                commandType: "dl",
                link: "https://twitter.com/user/status/1",
                channel: "channel-1",
                message: "message-1",
                token: "token-1",
                cookie,
              },
            }),
          );

          const result = await runScript(["download"], {
            PATH: `${binDirectory}:${Deno.env.get("PATH") ?? "/usr/bin:/bin"}`,
            CAPTURE_FILE: capturePath,
            COOKIE_CAPTURE: cookieCapturePath,
            GITHUB_WORKSPACE: workspace,
            ENDPOINT_URL: "http://callback.test",
            GITHUB_EVENT_PATH: eventPath,
          });

          assertEquals(result.code, 0);
          outputs.push(await Deno.readTextFile(cookieCapturePath));
        } finally {
          await Deno.remove(tempDirectory, { recursive: true });
        }
      }

      assertEquals(outputs[0], outputs[1]);
      assertEquals(
        outputs[0],
        "# Netscape HTTP Cookie File\n" +
          ".twitter.com\tTRUE\t/\tTRUE\t0\tauth_token\taaa\n" +
          ".twitter.com\tTRUE\t/\tTRUE\t0\tct0\tb=b\n",
      );
    },
  );

  await t.step(
    "run.yml does not initialize a job-wide secret environment",
    async () => {
      const workflow = await Deno.readTextFile(
        new URL("../../.github/workflows/run.yml", import.meta.url),
      );

      assertEquals(/^ {4}env:/m.test(workflow), false);
      assertStringIncludes(
        workflow,
        "- name: Masking Secrets\n        run: bash .github/scripts/run.sh mask",
      );
    },
  );

  await t.step(
    "start builds valid JSON without shell interpolation",
    async () => {
      const tempDirectory = await Deno.makeTempDir();
      try {
        const fakeCurl = await makeFakeCurl(tempDirectory);
        const eventPath = `${tempDirectory}/event.json`;
        await Deno.writeTextFile(
          eventPath,
          JSON.stringify({
            client_payload: {
              commandType: "dl",
              startTime: "1700000000000",
              channel: "channel-1",
              message: 'message with "quotes"',
              token: "token-1",
              link: "https://example.test/a?x=1&y=2",
            },
          }),
        );
        const result = await runScript(["start"], {
          PATH: fakeCurl.path,
          CAPTURE_FILE: fakeCurl.capturePath,
          ENDPOINT_URL: "http://callback.test",
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_RUN_NUMBER: "42",
        });

        assertEquals(result.code, 0);
        const payload = JSON.parse(
          await Deno.readTextFile(fakeCurl.capturePath),
        );
        assertEquals(payload, {
          status: "progress",
          number: 42,
          startTime: "1700000000000",
          channel: "channel-1",
          message: 'message with "quotes"',
          token: "token-1",
          link: "https://example.test/a?x=1&y=2",
          content: "⏳Starting...",
        });
        assertEquals("commandType" in payload, false);
      } finally {
        await Deno.remove(tempDirectory, { recursive: true });
      }
    },
  );

  await t.step(
    "upload sends a single file as multipart form data",
    async () => {
      const tempDirectory = await Deno.makeTempDir();
      try {
        const workspace = `${tempDirectory}/workspace`;
        const scriptDirectory = `${workspace}/.github/scripts`;
        const downloadDirectory = `${workspace}/download`;
        await Deno.mkdir(scriptDirectory, { recursive: true });
        await Deno.mkdir(downloadDirectory, { recursive: true });
        await Deno.copyFile(
          new URL("../../.github/scripts/retry_curl.sh", import.meta.url)
            .pathname,
          `${scriptDirectory}/retry_curl.sh`,
        );
        const filePath = `${downloadDirectory}/clip.mp4`;
        await Deno.writeTextFile(filePath, "abc");

        const fakeCurl = await makeFakeCurl(tempDirectory);
        const result = await runScript(["upload"], {
          PATH: fakeCurl.path,
          CAPTURE_FILE: fakeCurl.capturePath,
          CAPTURE_FORM: "true",
          GITHUB_WORKSPACE: workspace,
          ENDPOINT_URL: "http://callback.test",
          RUN_NUMBER: "42",
          START_TIME: "1700000000000",
          CHANNEL: "channel-1",
          MESSAGE: "message-1",
          TOKEN: "token-1",
          LINK: "https://example.test/video",
          COMMAND_TYPE: "dl",
        });

        assertEquals(result.code, 0);
        const requestLog = await Deno.readTextFile(fakeCurl.capturePath);
        assertStringIncludes(requestLog, "status=success");
        assertStringIncludes(requestLog, "actionType=single");
        assertStringIncludes(requestLog, "convert=false");
        assertStringIncludes(requestLog, "size=3");
        assertStringIncludes(requestLog, "name1=clip.mp4");
        assertStringIncludes(requestLog, `file1=@${filePath}`);
      } finally {
        await Deno.remove(tempDirectory, { recursive: true });
      }
    },
  );

  await t.step(
    "thread start loads the link and message for its shard",
    async () => {
      const tempDirectory = await Deno.makeTempDir();
      try {
        const fakeCurl = await makeFakeCurl(tempDirectory);
        const eventPath = `${tempDirectory}/event.json`;
        await Deno.writeTextFile(
          eventPath,
          JSON.stringify({
            client_payload: {
              commandType: "threaddl",
              startTime: "1700000000000",
              channel: "thread-1",
              token: "token-1",
              links: [
                { link: "https://example.test/first", message: "message-1" },
                {
                  link: "https://example.test/second",
                  message: 'message with "quotes"',
                },
              ],
            },
          }),
        );
        const maskResult = await runScript(["mask"], {
          GITHUB_EVENT_PATH: eventPath,
          SHARD_INDEX: "02",
        });
        assertEquals(maskResult.code, 0);
        assertEquals(
          maskResult.stdout,
          "::add-mask::threaddl\n" +
            "::add-mask::https://example.test/second\n" +
            "::add-mask::thread-1\n" +
            '::add-mask::message with "quotes"\n' +
            "::add-mask::token-1\n",
        );
        const result = await runScript(["start"], {
          PATH: fakeCurl.path,
          CAPTURE_FILE: fakeCurl.capturePath,
          ENDPOINT_URL: "http://callback.test",
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_RUN_NUMBER: "42",
          SHARD_INDEX: "02",
        });

        assertEquals(result.code, 0);
        const payload = JSON.parse(
          await Deno.readTextFile(fakeCurl.capturePath),
        );
        assertEquals(payload.commandType, "threaddl");
        assertEquals(payload.shardIndex, "02");
        assertEquals(payload.link, "https://example.test/second");
        assertEquals(payload.message, 'message with "quotes"');
      } finally {
        await Deno.remove(tempDirectory, { recursive: true });
      }
    },
  );

  await t.step(
    "thread upload uses thread action type and shard index",
    async () => {
      const tempDirectory = await Deno.makeTempDir();
      try {
        const workspace = `${tempDirectory}/workspace`;
        const scriptDirectory = `${workspace}/.github/scripts`;
        const downloadDirectory = `${workspace}/download`;
        await Deno.mkdir(scriptDirectory, { recursive: true });
        await Deno.mkdir(downloadDirectory, { recursive: true });
        await Deno.copyFile(
          new URL("../../.github/scripts/retry_curl.sh", import.meta.url)
            .pathname,
          `${scriptDirectory}/retry_curl.sh`,
        );
        await Deno.writeTextFile(`${downloadDirectory}/clip.mp4`, "abc");

        const fakeCurl = await makeFakeCurl(tempDirectory);
        const result = await runScript(["upload"], {
          PATH: fakeCurl.path,
          CAPTURE_FILE: fakeCurl.capturePath,
          CAPTURE_FORM: "true",
          GITHUB_WORKSPACE: workspace,
          ENDPOINT_URL: "http://callback.test",
          RUN_NUMBER: "42",
          START_TIME: "1700000000000",
          CHANNEL: "thread-1",
          MESSAGE: "message-1",
          TOKEN: "token-1",
          LINK: "https://example.test/video",
          COMMAND_TYPE: "threaddl",
          SHARD_INDEX: "02",
        });

        assertEquals(result.code, 0);
        const requestLog = await Deno.readTextFile(fakeCurl.capturePath);
        assertStringIncludes(requestLog, "actionType=thread-single");
        assertStringIncludes(requestLog, "shardIndex=02");
      } finally {
        await Deno.remove(tempDirectory, { recursive: true });
      }
    },
  );

  await t.step(
    "thread workflow delegates runtime shell logic to run.sh",
    async () => {
      const workflow = await Deno.readTextFile(
        new URL("../../.github/workflows/run-thread.yml", import.meta.url),
      );

      assertEquals(workflow.includes("curl"), false);
      assertEquals(workflow.includes("MATRIX_LINK"), false);
      assertEquals(workflow.includes("MATRIX_MESSAGE"), false);
      assertStringIncludes(
        workflow,
        "run: bash .github/scripts/run.sh mask",
      );
      assertStringIncludes(
        workflow,
        "run: bash .github/scripts/run.sh upload",
      );
    },
  );
});
