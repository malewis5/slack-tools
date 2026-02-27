import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSlackTools } from "../../index";

const { mockConversationsReplies, mockUsersInfo } = vi.hoisted(() => ({
  mockConversationsReplies: vi.fn(),
  mockUsersInfo: vi.fn(),
}));

vi.mock("@slack/web-api", () => ({
  WebClient: function () {
    return {
      conversations: { replies: mockConversationsReplies },
      users: { info: mockUsersInfo },
    };
  },
}));

describe("slack_read_thread", () => {
  it("is returned by createSlackTools", () => {
    const tools = createSlackTools("xoxb-test-token");
    expect(tools).toHaveProperty("slack_read_thread");
  });

  it("has description, inputSchema, outputSchema, execute, and toModelOutput", () => {
    const { slack_read_thread } = createSlackTools("xoxb-test-token");
    expect(typeof slack_read_thread.description).toBe("string");
    expect(slack_read_thread).toHaveProperty("inputSchema");
    expect(slack_read_thread).toHaveProperty("outputSchema");
    expect(typeof slack_read_thread.execute).toBe("function");
    expect(typeof slack_read_thread.toModelOutput).toBe("function");
  });

  describe("execute", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockConversationsReplies.mockResolvedValue({
        ok: true,
        messages: [
          {
            user: "U123",
            text: "Has anyone seen the bug in the login flow?",
            ts: "1705316445.123456",
          },
          {
            user: "U456",
            text: "Yes, I'm investigating it now.",
            ts: "1705316722.234567",
          },
        ],
        has_more: false,
        response_metadata: { next_cursor: "" },
      });
      mockUsersInfo
        .mockResolvedValueOnce({
          ok: true,
          user: { id: "U123", real_name: "Jane Doe" },
        })
        .mockResolvedValueOnce({
          ok: true,
          user: { id: "U456", real_name: "John Smith" },
        });
    });

    it("calls conversations.replies with channel_id and message_ts", async () => {
      const { slack_read_thread } = createSlackTools("xoxb-test-token");
      await slack_read_thread.execute!(
        { channel_id: "C123", message_ts: "1705316445.123456" },
        { toolCallId: "test", messages: [] },
      );
      expect(mockConversationsReplies).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "C123",
          ts: "1705316445.123456",
        }),
      );
    });

    it("returns typed object with parent and replies", async () => {
      const { slack_read_thread } = createSlackTools("xoxb-test-token");
      const result = await slack_read_thread.execute!(
        { channel_id: "C123", message_ts: "1705316445.123456" },
        { toolCallId: "test", messages: [] },
      );
      expect(result.parent).toEqual({
        user_id: "U123",
        user_name: "Jane Doe",
        ts: "1705316445.123456",
        time_formatted: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
        text: "Has anyone seen the bug in the login flow?",
      });
      expect(result.replies).toHaveLength(1);
      expect(result.replies[0].user_name).toBe("John Smith");
      expect(result.has_more).toBe(false);
    });

    it("handles thread with no replies", async () => {
      mockConversationsReplies.mockResolvedValue({
        ok: true,
        messages: [
          {
            user: "U123",
            text: "Solo message",
            ts: "1705316445.123456",
          },
        ],
        has_more: false,
      });
      mockUsersInfo.mockReset();
      mockUsersInfo.mockResolvedValueOnce({
        ok: true,
        user: { id: "U123", real_name: "Jane Doe" },
      });
      const { slack_read_thread } = createSlackTools("xoxb-test-token");
      const result = await slack_read_thread.execute!(
        { channel_id: "C123", message_ts: "1705316445.123456" },
        { toolCallId: "test", messages: [] },
      );
      expect(result.parent.text).toBe("Solo message");
      expect(result.replies).toEqual([]);
    });

    it("throws on Slack API error", async () => {
      mockConversationsReplies.mockRejectedValue(
        new Error("thread_not_found"),
      );
      const { slack_read_thread } = createSlackTools("xoxb-test-token");
      await expect(
        slack_read_thread.execute!(
          { channel_id: "C123", message_ts: "000" },
          { toolCallId: "test", messages: [] },
        ),
      ).rejects.toThrow("thread_not_found");
    });
  });

  describe("toModelOutput", () => {
    it("returns MCP-compatible formatted text", () => {
      const { slack_read_thread } = createSlackTools("xoxb-test-token");
      const output = {
        parent: {
          user_id: "U0931KUHGC8",
          user_name: "Matt Lewis",
          ts: "1771880109.194829",
          time_formatted: "2026-02-23 15:55:09 EST",
          text: "hi",
        },
        replies: [],
        has_more: false,
        next_cursor: undefined,
      };
      const modelOutput = slack_read_thread.toModelOutput!({
        toolCallId: "test",
        input: { channel_id: "C123", message_ts: "1771880109.194829" },
        output,
      });
      const parsed = JSON.parse((modelOutput as { value: string }).value);
      expect(parsed).toHaveProperty("messages");
      expect(parsed).toHaveProperty("pagination_info");
      expect(parsed.messages).toContain("THREAD PARENT MESSAGE");
      expect(parsed.messages).toContain("Matt Lewis (U0931KUHGC8)");
      expect(parsed.messages).toContain("Message TS: 1771880109.194829");
    });
  });
});
