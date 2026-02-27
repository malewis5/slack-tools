import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSlackTools } from "../../index";

const { mockConversationsHistory, mockConversationsInfo, mockUsersInfo } =
  vi.hoisted(() => ({
    mockConversationsHistory: vi.fn(),
    mockConversationsInfo: vi.fn(),
    mockUsersInfo: vi.fn(),
  }));

vi.mock("@slack/web-api", () => ({
  WebClient: function () {
    return {
      conversations: {
        history: mockConversationsHistory,
        info: mockConversationsInfo,
      },
      users: { info: mockUsersInfo },
    };
  },
}));

describe("slack_read_channel", () => {
  it("is returned by createSlackTools", () => {
    const tools = createSlackTools("xoxb-test-token");
    expect(tools).toHaveProperty("slack_read_channel");
  });

  it("has description, inputSchema, outputSchema, execute, and toModelOutput", () => {
    const { slack_read_channel } = createSlackTools("xoxb-test-token");
    expect(typeof slack_read_channel.description).toBe("string");
    expect(slack_read_channel).toHaveProperty("inputSchema");
    expect(slack_read_channel).toHaveProperty("outputSchema");
    expect(typeof slack_read_channel.execute).toBe("function");
    expect(typeof slack_read_channel.toModelOutput).toBe("function");
  });

  describe("execute", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockConversationsHistory.mockResolvedValue({
        ok: true,
        messages: [
          {
            user: "U123456789",
            text: "Hey team, how's the project going?",
            ts: "1705316445.123456",
          },
          {
            user: "U987654321",
            text: "Looking good! Just pushed the latest updates.",
            ts: "1705316530.789012",
          },
        ],
        has_more: true,
        response_metadata: { next_cursor: "bmV4dF90czox" },
      });
      mockConversationsInfo.mockResolvedValue({
        ok: true,
        channel: { id: "C123", name: "general", is_im: false },
      });
      mockUsersInfo
        .mockResolvedValueOnce({
          ok: true,
          user: { id: "U123456789", real_name: "Jane Doe" },
        })
        .mockResolvedValueOnce({
          ok: true,
          user: { id: "U987654321", real_name: "John Smith" },
        });
    });

    it("calls conversations.history with channel_id", async () => {
      const { slack_read_channel } = createSlackTools("xoxb-test-token");
      await slack_read_channel.execute!(
        { channel_id: "C123" },
        { toolCallId: "test", messages: [] },
      );
      expect(mockConversationsHistory).toHaveBeenCalledWith(
        expect.objectContaining({ channel: "C123" }),
      );
    });

    it("forwards optional parameters", async () => {
      const { slack_read_channel } = createSlackTools("xoxb-test-token");
      await slack_read_channel.execute!(
        { channel_id: "C123", limit: 10, oldest: "1705316000.000000" },
        { toolCallId: "test", messages: [] },
      );
      expect(mockConversationsHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "C123",
          limit: 10,
          oldest: "1705316000.000000",
        }),
      );
    });

    it("returns typed object with resolved user names", async () => {
      const { slack_read_channel } = createSlackTools("xoxb-test-token");
      const result = await slack_read_channel.execute!(
        { channel_id: "C123" },
        { toolCallId: "test", messages: [] },
      );
      expect(result).toEqual({
        channel: { id: "C123", name: "general" },
        messages: [
          {
            user_id: "U123456789",
            user_name: "Jane Doe",
            ts: "1705316445.123456",
            time_formatted: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
            text: "Hey team, how's the project going?",
          },
          {
            user_id: "U987654321",
            user_name: "John Smith",
            ts: "1705316530.789012",
            time_formatted: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
            text: "Looking good! Just pushed the latest updates.",
          },
        ],
        has_more: true,
        next_cursor: "bmV4dF90czox",
      });
    });

    it("handles empty channel", async () => {
      mockConversationsHistory.mockResolvedValue({
        ok: true,
        messages: [],
        has_more: false,
      });
      const { slack_read_channel } = createSlackTools("xoxb-test-token");
      const result = await slack_read_channel.execute!(
        { channel_id: "C123" },
        { toolCallId: "test", messages: [] },
      );
      expect(result.messages).toEqual([]);
      expect(result.has_more).toBe(false);
    });

    it("throws on Slack API error", async () => {
      mockConversationsHistory.mockRejectedValue(
        new Error("channel_not_found"),
      );
      const { slack_read_channel } = createSlackTools("xoxb-test-token");
      await expect(
        slack_read_channel.execute!(
          { channel_id: "INVALID" },
          { toolCallId: "test", messages: [] },
        ),
      ).rejects.toThrow("channel_not_found");
    });
  });

  describe("toModelOutput", () => {
    it("returns MCP-compatible formatted text", () => {
      const { slack_read_channel } = createSlackTools("xoxb-test-token");
      const output = {
        channel: { id: "C09T3M2NLG4", name: "testing-10" },
        messages: [
          {
            user_id: "U0931KUHGC8",
            user_name: "Matt Lewis",
            ts: "1772159384.592619",
            time_formatted: "2026-02-26 21:29:44 EST",
            text: "Scheduled test",
          },
        ],
        has_more: true,
        next_cursor: "bmV4dF90czox",
      };
      const modelOutput = slack_read_channel.toModelOutput!({
        toolCallId: "test",
        input: { channel_id: "C09T3M2NLG4" },
        output,
      });
      const parsed = JSON.parse((modelOutput as { value: string }).value);
      expect(parsed).toHaveProperty("messages");
      expect(parsed).toHaveProperty("pagination_info");
      expect(parsed.messages).toContain("Channel: #testing-10 (C09T3M2NLG4)");
      expect(parsed.messages).toContain("Matt Lewis (U0931KUHGC8)");
      expect(parsed.messages).toContain("Message TS: 1772159384.592619");
      expect(parsed.pagination_info).toContain("bmV4dF90czox");
    });
  });
});
