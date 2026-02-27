import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSlackTools } from "../../index";

const { mockScheduleMessage, mockConversationsInfo } = vi.hoisted(() => ({
  mockScheduleMessage: vi.fn(),
  mockConversationsInfo: vi.fn(),
}));

vi.mock("@slack/web-api", () => ({
  WebClient: function () {
    return {
      chat: { scheduleMessage: mockScheduleMessage },
      conversations: { info: mockConversationsInfo },
    };
  },
}));

describe("slack_schedule_message", () => {
  it("is returned by createSlackTools", () => {
    const tools = createSlackTools("xoxb-test-token");
    expect(tools).toHaveProperty("slack_schedule_message");
  });

  it("has description, inputSchema, outputSchema, execute, and toModelOutput", () => {
    const { slack_schedule_message } = createSlackTools("xoxb-test-token");
    expect(typeof slack_schedule_message.description).toBe("string");
    expect(slack_schedule_message).toHaveProperty("inputSchema");
    expect(slack_schedule_message).toHaveProperty("outputSchema");
    expect(typeof slack_schedule_message.execute).toBe("function");
    expect(typeof slack_schedule_message.toModelOutput).toBe("function");
  });

  describe("execute", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockScheduleMessage.mockResolvedValue({
        ok: true,
        channel: "C09T3M2NLG4",
        scheduled_message_id: "Dr0AHL2PFHSQ",
        post_at: 1772159829,
      });
      mockConversationsInfo.mockResolvedValue({
        ok: true,
        channel: { id: "C09T3M2NLG4", name: "testing-10", is_im: false },
      });
    });

    it("calls chat.scheduleMessage with correct args", async () => {
      const { slack_schedule_message } = createSlackTools("xoxb-test-token");
      await slack_schedule_message.execute!(
        { channel_id: "C09T3M2NLG4", message: "Hello!", post_at: 1772159829 },
        { toolCallId: "test", messages: [] },
      );
      expect(mockScheduleMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "C09T3M2NLG4",
          text: "Hello!",
          post_at: 1772159829,
        }),
      );
    });

    it("forwards thread_ts and reply_broadcast", async () => {
      const { slack_schedule_message } = createSlackTools("xoxb-test-token");
      await slack_schedule_message.execute!(
        {
          channel_id: "C09T3M2NLG4",
          message: "Thread reply!",
          post_at: 1772159829,
          thread_ts: "1111111111.000000",
          reply_broadcast: true,
        },
        { toolCallId: "test", messages: [] },
      );
      expect(mockScheduleMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          thread_ts: "1111111111.000000",
          reply_broadcast: true,
        }),
      );
    });

    it("returns typed object matching MCP shape", async () => {
      const { slack_schedule_message } = createSlackTools("xoxb-test-token");
      const result = await slack_schedule_message.execute!(
        { channel_id: "C09T3M2NLG4", message: "Hello!", post_at: 1772159829 },
        { toolCallId: "test", messages: [] },
      );
      expect(result).toEqual({
        scheduled_message_id: "Dr0AHL2PFHSQ",
        channel_id: "C09T3M2NLG4",
        channel_name: "testing-10",
        post_at: 1772159829,
        post_at_formatted: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [A-Z]+$/,
        ),
      });
    });

    it("throws on Slack API error", async () => {
      mockScheduleMessage.mockRejectedValue(new Error("channel_not_found"));
      const { slack_schedule_message } = createSlackTools("xoxb-test-token");
      await expect(
        slack_schedule_message.execute!(
          { channel_id: "INVALID", message: "Hello!", post_at: 1772159829 },
          { toolCallId: "test", messages: [] },
        ),
      ).rejects.toThrow("channel_not_found");
    });
  });

  describe("toModelOutput", () => {
    it("returns MCP-compatible result text", () => {
      const { slack_schedule_message } = createSlackTools("xoxb-test-token");
      const output = {
        scheduled_message_id: "Dr0AHL2PFHSQ",
        channel_id: "C09T3M2NLG4",
        channel_name: "testing-10",
        post_at: 1772159829,
        post_at_formatted: "2026-02-26 21:37:09 EST",
      };
      const modelOutput = slack_schedule_message.toModelOutput!({
        toolCallId: "test",
        input: {
          channel_id: "C09T3M2NLG4",
          message: "Hello!",
          post_at: 1772159829,
        },
        output,
      });
      expect(modelOutput).toEqual({
        type: "text",
        value: JSON.stringify({
          result: `Message scheduled successfully!\n\nScheduled Message ID: Dr0AHL2PFHSQ\nChannel: testing-10 (C09T3M2NLG4)\nPost Time: 2026-02-26 21:37:09 EST (1772159829)`,
        }),
      });
    });
  });
});
