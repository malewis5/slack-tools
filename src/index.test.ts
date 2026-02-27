import { describe, expect, test } from "vitest";
import { createSlackTools } from ".";

const ALL_TOOL_NAMES = [
  "slack_send_message",
  "slack_schedule_message",
  "slack_create_canvas",
  "slack_search_public",
  "slack_search_public_and_private",
  "slack_search_channels",
  "slack_search_users",
  "slack_read_channel",
  "slack_read_thread",
  "slack_read_user_profile",
] as const;

describe("createSlackTools", () => {
  test("returns all expected tools", () => {
    const tools = createSlackTools("xoxb-test-token");
    expect(Object.keys(tools).sort()).toEqual([...ALL_TOOL_NAMES].sort());
  });

  describe("needsApproval", () => {
    test("true: sets needsApproval on every tool", () => {
      const tools = createSlackTools("xoxb-test-token", {
        needsApproval: true,
      });
      for (const tool of Object.values(tools)) {
        expect(tool).toHaveProperty("needsApproval", true);
      }
    });

    test("false: sets needsApproval false on every tool", () => {
      const tools = createSlackTools("xoxb-test-token", {
        needsApproval: false,
      });
      for (const tool of Object.values(tools)) {
        expect(tool).toHaveProperty("needsApproval", false);
      }
    });

    test("array: sets needsApproval only on listed tools", () => {
      const approved = [
        "slack_send_message",
        "slack_schedule_message",
      ] as const;
      const tools = createSlackTools("xoxb-test-token", {
        needsApproval: [...approved],
      });
      for (const [name, tool] of Object.entries(tools)) {
        if (approved.includes(name as (typeof approved)[number])) {
          expect(tool).toHaveProperty("needsApproval", true);
        } else {
          expect(tool.needsApproval).toBeUndefined();
        }
      }
    });

    test("array with single tool: only that tool gets needsApproval", () => {
      const tools = createSlackTools("xoxb-test-token", {
        needsApproval: ["slack_create_canvas"],
      });
      expect(tools.slack_create_canvas).toHaveProperty("needsApproval", true);
      for (const [name, tool] of Object.entries(tools)) {
        if (name !== "slack_create_canvas") {
          expect(tool.needsApproval).toBeUndefined();
        }
      }
    });

    test("array with all tools: equivalent to passing true", () => {
      const tools = createSlackTools("xoxb-test-token", {
        needsApproval: [...ALL_TOOL_NAMES],
      });
      for (const tool of Object.values(tools)) {
        expect(tool).toHaveProperty("needsApproval", true);
      }
    });

    test("empty array: no tools get needsApproval", () => {
      const tools = createSlackTools("xoxb-test-token", {
        needsApproval: [],
      });
      for (const tool of Object.values(tools)) {
        expect(tool.needsApproval).toBeUndefined();
      }
    });

    test("omitted: no tools get needsApproval", () => {
      const tools = createSlackTools("xoxb-test-token");
      for (const tool of Object.values(tools)) {
        expect(tool.needsApproval).toBeUndefined();
      }
    });

    test("empty options object: same as omitted", () => {
      const tools = createSlackTools("xoxb-test-token", {});
      for (const tool of Object.values(tools)) {
        expect(tool.needsApproval).toBeUndefined();
      }
    });
  });
});
