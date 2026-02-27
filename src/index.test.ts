import { expect, test } from "vitest";
import { createSlackTools } from ".";

test("createSlackTools exports slack_send_message", () => {
  const tools = createSlackTools("xoxb-test-token");
  expect(tools).toHaveProperty("slack_send_message");
});
