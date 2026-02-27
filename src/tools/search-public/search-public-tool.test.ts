import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSlackTools } from "../../index";

const { mockSearchMessages, mockUsersInfo } = vi.hoisted(() => ({
  mockSearchMessages: vi.fn(),
  mockUsersInfo: vi.fn(),
}));

vi.mock("@slack/web-api", () => ({
  WebClient: function () {
    return {
      search: { messages: mockSearchMessages },
      users: { info: mockUsersInfo },
    };
  },
}));

describe("slack_search_public", () => {
  it("is returned by createSlackTools", () => {
    const tools = createSlackTools("xoxb-test-token");
    expect(tools).toHaveProperty("slack_search_public");
  });

  it("has description, inputSchema, outputSchema, execute, and toModelOutput", () => {
    const { slack_search_public } = createSlackTools("xoxb-test-token");
    expect(typeof slack_search_public.description).toBe("string");
    expect(slack_search_public).toHaveProperty("inputSchema");
    expect(slack_search_public).toHaveProperty("outputSchema");
    expect(typeof slack_search_public.execute).toBe("function");
    expect(typeof slack_search_public.toModelOutput).toBe("function");
  });

  describe("execute", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockUsersInfo.mockImplementation(({ user }: { user: string }) =>
        Promise.resolve({
          ok: true,
          user: {
            id: user,
            real_name: user === "U123" ? "Jane Doe" : "John Smith",
            name: user === "U123" ? "janedoe" : "johnsmith",
          },
        }),
      );
      mockSearchMessages.mockResolvedValue({
        ok: true,
        messages: {
          total: 2,
          matches: [
            {
              channel: { id: "C123", name: "general" },
              username: "janedoe",
              user: "U123",
              text: "Found a critical bug in the login flow",
              ts: "1705316445.123456",
              permalink:
                "https://workspace.slack.com/archives/C123/p1705316445123456",
            },
            {
              channel: { id: "C456", name: "dev" },
              username: "johnsmith",
              user: "U456",
              text: "The bug report for issue #123 is ready",
              ts: "1705316530.789012",
              permalink:
                "https://workspace.slack.com/archives/C456/p1705316530789012",
              reply_count: 3,
            },
          ],
          pagination: { next_cursor: "dGVhbTpDMDYxRkE1UEI=" },
        },
      });
    });

    it("calls search.messages with the query", async () => {
      const { slack_search_public } = createSlackTools("xoxb-test-token");
      await slack_search_public.execute!(
        { query: "bug report" },
        { toolCallId: "test", messages: [] },
      );
      expect(mockSearchMessages).toHaveBeenCalledWith(
        expect.objectContaining({ query: "bug report" }),
      );
    });

    it("forwards optional parameters", async () => {
      const { slack_search_public } = createSlackTools("xoxb-test-token");
      await slack_search_public.execute!(
        { query: "bug report", sort: "timestamp", sort_dir: "asc", limit: 10 },
        { toolCallId: "test", messages: [] },
      );
      expect(mockSearchMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "bug report",
          sort: "timestamp",
          sort_dir: "asc",
          count: 10,
        }),
      );
    });

    it("returns typed object with matched messages", async () => {
      const { slack_search_public } = createSlackTools("xoxb-test-token");
      const result = await slack_search_public.execute!(
        { query: "bug report" },
        { toolCallId: "test", messages: [] },
      );
      expect(result.query).toBe("bug report");
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({
        channel_id: "C123",
        channel_name: "general",
        user_id: "U123",
        user_name: "Jane Doe",
        ts: "1705316445.123456",
        time_formatted: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
        text: "Found a critical bug in the login flow",
        permalink:
          "https://workspace.slack.com/archives/C123/p1705316445123456",
        reply_count: 0,
        context_before: [],
        context_after: [],
      });
      expect(result.messages[1].reply_count).toBe(3);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBe("dGVhbTpDMDYxRkE1UEI=");
    });

    it("returns empty when no match", async () => {
      mockSearchMessages.mockResolvedValue({
        ok: true,
        messages: { total: 0, matches: [], pagination: {} },
      });
      const { slack_search_public } = createSlackTools("xoxb-test-token");
      const result = await slack_search_public.execute!(
        { query: "nonexistent" },
        { toolCallId: "test", messages: [] },
      );
      expect(result.messages).toEqual([]);
    });

    it("throws on Slack API error", async () => {
      mockSearchMessages.mockRejectedValue(new Error("not_authed"));
      const { slack_search_public } = createSlackTools("xoxb-test-token");
      await expect(
        slack_search_public.execute!(
          { query: "test" },
          { toolCallId: "test", messages: [] },
        ),
      ).rejects.toThrow("not_authed");
    });
  });

  describe("toModelOutput", () => {
    it("returns MCP-compatible formatted text", () => {
      const { slack_search_public } = createSlackTools("xoxb-test-token");
      const output = {
        query: "hello",
        messages: [
          {
            channel_id: "C0AGSRD0J3S",
            channel_name: "partnerships-team",
            user_id: "U0931KUHGC8",
            user_name: "Matt Lewis",
            ts: "1771862083.266819",
            time_formatted: "2026-02-23 10:54:43 EST",
            text: "hello world",
            permalink: "https://example.slack.com/archives/C0AGSRD0J3S/p123",
            reply_count: 1,
            context_before: [],
            context_after: [],
          },
        ],
        has_more: true,
        next_cursor: "Q1VSUkVOVF9QQUdFOjI=",
      };
      const modelOutput = slack_search_public.toModelOutput!({
        toolCallId: "test",
        input: { query: "hello" },
        output,
      });
      const parsed = JSON.parse((modelOutput as { value: string }).value);
      expect(parsed.results).toContain("# Search Results for: hello");
      expect(parsed.results).toContain("## Messages (1 results)");
      expect(parsed.results).toContain("#partnerships-team (ID: C0AGSRD0J3S)");
      expect(parsed.results).toContain("Matt Lewis (ID: U0931KUHGC8)");
      expect(parsed.results).toContain("Message_ts: 1771862083.266819");
      expect(parsed.results).toContain("Reply count: 1");
      expect(parsed.pagination_info).toContain("Q1VSUkVOVF9QQUdFOjI=");
    });
  });
});
