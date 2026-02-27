import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSlackTools } from "../../index";

const { mockPostMessage, mockGetPermalink } = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockGetPermalink: vi.fn(),
}));

vi.mock("@slack/web-api", () => ({
  WebClient: function () {
    return {
      chat: {
        postMessage: mockPostMessage,
        getPermalink: mockGetPermalink,
      },
    };
  },
}));

describe("slack_send_message", () => {
  it("is returned by createSlackTools", () => {
    const tools = createSlackTools("xoxb-test-token");
    expect(tools).toHaveProperty("slack_send_message");
  });

  it("has description, inputSchema, outputSchema, execute, and toModelOutput", () => {
    const { slack_send_message } = createSlackTools("xoxb-test-token");
    expect(typeof slack_send_message.description).toBe("string");
    expect(slack_send_message).toHaveProperty("inputSchema");
    expect(slack_send_message).toHaveProperty("outputSchema");
    expect(typeof slack_send_message.execute).toBe("function");
    expect(typeof slack_send_message.toModelOutput).toBe("function");
  });

  describe("execute", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockPostMessage.mockResolvedValue({
        ok: true,
        channel: "C09T3M2NLG4",
        ts: "1772159936.361869",
      });
      mockGetPermalink.mockResolvedValue({
        ok: true,
        permalink:
          "https://e0931kugujc-zg1ddxk7.slack.com/archives/C09T3M2NLG4/p1772159936361869",
      });
    });

    it("calls chat.postMessage with channel_id and message", async () => {
      const { slack_send_message } = createSlackTools("xoxb-test-token");
      await slack_send_message.execute!(
        { channel_id: "C09T3M2NLG4", message: "Hello!" },
        { toolCallId: "test", messages: [] },
      );
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "C09T3M2NLG4",
          text: "Hello!",
        }),
      );
    });

    it("forwards thread_ts and reply_broadcast", async () => {
      const { slack_send_message } = createSlackTools("xoxb-test-token");
      await slack_send_message.execute!(
        {
          channel_id: "C09T3M2NLG4",
          message: "Reply!",
          thread_ts: "1111111111.000000",
          reply_broadcast: true,
        },
        { toolCallId: "test", messages: [] },
      );
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "C09T3M2NLG4",
          text: "Reply!",
          thread_ts: "1111111111.000000",
          reply_broadcast: true,
        }),
      );
    });

    it("returns typed object matching MCP shape", async () => {
      const { slack_send_message } = createSlackTools("xoxb-test-token");
      const result = await slack_send_message.execute!(
        { channel_id: "C09T3M2NLG4", message: "Hello!" },
        { toolCallId: "test", messages: [] },
      );
      expect(result).toEqual({
        message_link:
          "https://e0931kugujc-zg1ddxk7.slack.com/archives/C09T3M2NLG4/p1772159936361869",
        message_context: {
          message_ts: "1772159936.361869",
          channel_id: "C09T3M2NLG4",
        },
      });
    });

    it("throws on Slack API error", async () => {
      mockPostMessage.mockRejectedValue(new Error("channel_not_found"));
      const { slack_send_message } = createSlackTools("xoxb-test-token");
      await expect(
        slack_send_message.execute!(
          { channel_id: "INVALID", message: "Hello!" },
          { toolCallId: "test", messages: [] },
        ),
      ).rejects.toThrow("channel_not_found");
    });
  });

  describe("toModelOutput", () => {
    it("returns MCP-compatible JSON text", () => {
      const { slack_send_message } = createSlackTools("xoxb-test-token");
      const output = {
        message_link:
          "https://e0931kugujc-zg1ddxk7.slack.com/archives/C09T3M2NLG4/p1772159936361869",
        message_context: {
          message_ts: "1772159936.361869",
          channel_id: "C09T3M2NLG4",
        },
      };
      const modelOutput = slack_send_message.toModelOutput!({
        toolCallId: "test",
        input: { channel_id: "C09T3M2NLG4", message: "Hello!" },
        output,
      });
      expect(modelOutput).toEqual({
        type: "text",
        value: JSON.stringify(output),
      });
    });
  });
});
