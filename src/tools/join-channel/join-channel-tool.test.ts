import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSlackTools } from "../../index";

const { mockConversationsJoin } = vi.hoisted(() => ({
  mockConversationsJoin: vi.fn(),
}));

vi.mock("@slack/web-api", () => ({
  WebClient: function () {
    return {
      conversations: {
        join: mockConversationsJoin,
      },
    };
  },
}));

describe("slack_join_channel", () => {
  it("is returned by createSlackTools", () => {
    const tools = createSlackTools("xoxb-test-token");
    expect(tools).toHaveProperty("slack_join_channel");
  });

  it("has description, inputSchema, outputSchema, execute, and toModelOutput", () => {
    const { slack_join_channel } = createSlackTools("xoxb-test-token");
    expect(typeof slack_join_channel.description).toBe("string");
    expect(slack_join_channel).toHaveProperty("inputSchema");
    expect(slack_join_channel).toHaveProperty("outputSchema");
    expect(typeof slack_join_channel.execute).toBe("function");
    expect(typeof slack_join_channel.toModelOutput).toBe("function");
  });

  describe("execute", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockConversationsJoin.mockResolvedValue({
        ok: true,
        channel: {
          id: "C09T3M2NLG4",
          name: "general",
        },
        already_in_channel: false,
      });
    });

    it("calls conversations.join with channel_id", async () => {
      const { slack_join_channel } = createSlackTools("xoxb-test-token");
      await slack_join_channel.execute!(
        { channel_id: "C09T3M2NLG4" },
        { toolCallId: "test", messages: [] },
      );
      expect(mockConversationsJoin).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "C09T3M2NLG4",
        }),
      );
    });

    it("returns channel info with already_in_channel false", async () => {
      const { slack_join_channel } = createSlackTools("xoxb-test-token");
      const result = await slack_join_channel.execute!(
        { channel_id: "C09T3M2NLG4" },
        { toolCallId: "test", messages: [] },
      );
      expect(result).toEqual({
        channel_id: "C09T3M2NLG4",
        channel_name: "general",
        already_in_channel: false,
      });
    });

    it("returns already_in_channel true when already a member", async () => {
      mockConversationsJoin.mockResolvedValue({
        ok: true,
        channel: { id: "C09T3M2NLG4", name: "general" },
        already_in_channel: true,
      });
      const { slack_join_channel } = createSlackTools("xoxb-test-token");
      const result = await slack_join_channel.execute!(
        { channel_id: "C09T3M2NLG4" },
        { toolCallId: "test", messages: [] },
      );
      expect(result).toEqual({
        channel_id: "C09T3M2NLG4",
        channel_name: "general",
        already_in_channel: true,
      });
    });

    it("throws on Slack API error", async () => {
      mockConversationsJoin.mockRejectedValue(
        new Error("channel_not_found"),
      );
      const { slack_join_channel } = createSlackTools("xoxb-test-token");
      await expect(
        slack_join_channel.execute!(
          { channel_id: "INVALID" },
          { toolCallId: "test", messages: [] },
        ),
      ).rejects.toThrow("channel_not_found");
    });
  });

  describe("toModelOutput", () => {
    it("returns JSON text", () => {
      const { slack_join_channel } = createSlackTools("xoxb-test-token");
      const output = {
        channel_id: "C09T3M2NLG4",
        channel_name: "general",
        already_in_channel: false,
      };
      const modelOutput = slack_join_channel.toModelOutput!({
        toolCallId: "test",
        input: { channel_id: "C09T3M2NLG4" },
        output,
      });
      expect(modelOutput).toEqual({
        type: "text",
        value: JSON.stringify(output),
      });
    });
  });
});
