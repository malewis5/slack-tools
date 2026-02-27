import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSlackTools } from "../../index";

const { mockConversationsList, mockUsersInfo } = vi.hoisted(() => ({
  mockConversationsList: vi.fn(),
  mockUsersInfo: vi.fn(),
}));

vi.mock("@slack/web-api", () => ({
  WebClient: function () {
    return {
      conversations: { list: mockConversationsList },
      users: { info: mockUsersInfo },
    };
  },
}));

describe("slack_search_channels", () => {
  it("is returned by createSlackTools", () => {
    const tools = createSlackTools("xoxb-test-token");
    expect(tools).toHaveProperty("slack_search_channels");
  });

  it("has description, inputSchema, outputSchema, execute, and toModelOutput", () => {
    const { slack_search_channels } = createSlackTools("xoxb-test-token");
    expect(typeof slack_search_channels.description).toBe("string");
    expect(slack_search_channels).toHaveProperty("inputSchema");
    expect(slack_search_channels).toHaveProperty("outputSchema");
    expect(typeof slack_search_channels.execute).toBe("function");
    expect(typeof slack_search_channels.toModelOutput).toBe("function");
  });

  describe("execute", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockConversationsList.mockResolvedValue({
        ok: true,
        channels: [
          {
            id: "C0926L5QHM1",
            name: "general",
            creator: "U0931KUHGC8",
            created: 1750428000,
            purpose: {
              value:
                "This channel is for workspace-wide communication and announcements. All members are in this channel.",
            },
            topic: {
              value: "Company-wide announcements and work-based matters",
            },
            is_archived: false,
          },
        ],
        response_metadata: { next_cursor: "" },
      });
      mockUsersInfo.mockResolvedValue({
        ok: true,
        user: { id: "U0931KUHGC8", real_name: "Matt Lewis" },
      });
    });

    it("calls conversations.list", async () => {
      const { slack_search_channels } = createSlackTools("xoxb-test-token");
      await slack_search_channels.execute!(
        { query: "general" },
        { toolCallId: "test", messages: [] },
      );
      expect(mockConversationsList).toHaveBeenCalled();
    });

    it("returns typed object with matched channels", async () => {
      const { slack_search_channels } = createSlackTools("xoxb-test-token");
      const result = await slack_search_channels.execute!(
        { query: "general" },
        { toolCallId: "test", messages: [] },
      );
      expect(result.query).toBe("general");
      expect(result.channels).toHaveLength(1);
      expect(result.channels[0]).toEqual({
        id: "C0926L5QHM1",
        name: "general",
        creator_id: "U0931KUHGC8",
        creator_name: "Matt Lewis",
        created: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
        topic: "Company-wide announcements and work-based matters",
        purpose:
          "This channel is for workspace-wide communication and announcements. All members are in this channel.",
        is_archived: false,
      });
    });

    it("returns empty channels when no match", async () => {
      const { slack_search_channels } = createSlackTools("xoxb-test-token");
      const result = await slack_search_channels.execute!(
        { query: "nonexistent" },
        { toolCallId: "test", messages: [] },
      );
      expect(result.channels).toEqual([]);
    });

    it("throws on Slack API error", async () => {
      mockConversationsList.mockRejectedValue(new Error("not_authed"));
      const { slack_search_channels } = createSlackTools("xoxb-test-token");
      await expect(
        slack_search_channels.execute!(
          { query: "test" },
          { toolCallId: "test", messages: [] },
        ),
      ).rejects.toThrow("not_authed");
    });
  });

  describe("toModelOutput", () => {
    it("returns MCP-compatible formatted text", () => {
      const { slack_search_channels } = createSlackTools("xoxb-test-token");
      const output = {
        query: "general",
        channels: [
          {
            id: "C0926L5QHM1",
            name: "general",
            creator_id: "U0931KUHGC8",
            creator_name: "Matt Lewis",
            created: "2025-06-20 13:17:45 EDT",
            topic: "Company-wide announcements",
            purpose: "Workspace-wide communication",
            is_archived: false,
          },
        ],
        has_more: false,
        next_cursor: undefined,
      };
      const modelOutput = slack_search_channels.toModelOutput!({
        toolCallId: "test",
        input: { query: "general" },
        output,
      });
      const parsed = JSON.parse((modelOutput as { value: string }).value);
      expect(parsed.results).toContain("# Search Results for: general");
      expect(parsed.results).toContain("## Channels (1 results)");
      expect(parsed.results).toContain("Name: #general");
      expect(parsed.results).toContain("Matt Lewis");
      expect(parsed).toHaveProperty("pagination_info");
    });
  });
});
