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

describe("slack_search_public_and_private", () => {
  it("is returned by createSlackTools", () => {
    const tools = createSlackTools("xoxb-test-token");
    expect(tools).toHaveProperty("slack_search_public_and_private");
  });

  it("has description, inputSchema, outputSchema, execute, and toModelOutput", () => {
    const { slack_search_public_and_private } =
      createSlackTools("xoxb-test-token");
    expect(typeof slack_search_public_and_private.description).toBe("string");
    expect(slack_search_public_and_private).toHaveProperty("inputSchema");
    expect(slack_search_public_and_private).toHaveProperty("outputSchema");
    expect(typeof slack_search_public_and_private.execute).toBe("function");
    expect(typeof slack_search_public_and_private.toModelOutput).toBe(
      "function",
    );
  });

  describe("execute", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockUsersInfo.mockImplementation(({ user }: { user: string }) =>
        Promise.resolve({
          ok: true,
          user: { id: user, real_name: "Alice", name: "alice" },
        }),
      );
      mockSearchMessages.mockResolvedValue({
        ok: true,
        messages: {
          total: 1,
          matches: [
            {
              channel: { id: "G789", name: "private-team" },
              username: "alice",
              user: "U789",
              text: "Confidential project update",
              ts: "1705316445.123456",
              permalink:
                "https://workspace.slack.com/archives/G789/p1705316445123456",
            },
          ],
          pagination: {},
        },
      });
    });

    it("calls search.messages with the query", async () => {
      const { slack_search_public_and_private } =
        createSlackTools("xoxb-test-token");
      await slack_search_public_and_private.execute!(
        { query: "project update" },
        { toolCallId: "test", messages: [] },
      );
      expect(mockSearchMessages).toHaveBeenCalledWith(
        expect.objectContaining({ query: "project update" }),
      );
    });

    it("returns typed object with matched messages", async () => {
      const { slack_search_public_and_private } =
        createSlackTools("xoxb-test-token");
      const result = await slack_search_public_and_private.execute!(
        { query: "project update" },
        { toolCallId: "test", messages: [] },
      );
      expect(result.query).toBe("project update");
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({
        channel_id: "G789",
        channel_name: "private-team",
        user_id: "U789",
        user_name: "Alice",
        ts: "1705316445.123456",
        time_formatted: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
        text: "Confidential project update",
        permalink:
          "https://workspace.slack.com/archives/G789/p1705316445123456",
        reply_count: 0,
        context_before: [],
        context_after: [],
      });
    });

    it("throws on Slack API error", async () => {
      mockSearchMessages.mockRejectedValue(new Error("not_authed"));
      const { slack_search_public_and_private } =
        createSlackTools("xoxb-test-token");
      await expect(
        slack_search_public_and_private.execute!(
          { query: "test" },
          { toolCallId: "test", messages: [] },
        ),
      ).rejects.toThrow("not_authed");
    });
  });

  describe("toModelOutput", () => {
    it("returns MCP-compatible formatted text", () => {
      const { slack_search_public_and_private } =
        createSlackTools("xoxb-test-token");
      const output = {
        query: "hello",
        messages: [
          {
            channel_id: "G789",
            channel_name: "private-team",
            user_id: "U789",
            user_name: "alice",
            ts: "1705316445.123456",
            time_formatted: "2024-01-15 10:30:45 EST",
            text: "Confidential update",
            permalink: "https://example.slack.com/archives/G789/p123",
            reply_count: 0,
            context_before: [],
            context_after: [],
          },
        ],
        has_more: false,
        next_cursor: undefined,
      };
      const modelOutput = slack_search_public_and_private.toModelOutput!({
        toolCallId: "test",
        input: { query: "hello" },
        output,
      });
      const parsed = JSON.parse((modelOutput as { value: string }).value);
      expect(parsed.results).toContain("# Search Results for: hello");
      expect(parsed.results).toContain("## Messages (1 results)");
      expect(parsed.results).toContain("#private-team (ID: G789)");
      expect(parsed).toHaveProperty("pagination_info");
    });
  });
});
