import { type WebClient } from "@slack/web-api";

const userNameCache = new WeakMap<WebClient, Map<string, string>>();

export async function resolveUserName(
  client: WebClient,
  userId: string,
): Promise<string> {
  let cache = userNameCache.get(client);
  if (!cache) {
    cache = new Map();
    userNameCache.set(client, cache);
  }

  const cached = cache.get(userId);
  if (cached) return cached;

  const result = await client.users.info({ user: userId });
  const name = result.user?.real_name ?? result.user?.name ?? userId;
  cache.set(userId, name);
  return name;
}

const channelInfoCache = new WeakMap<
  WebClient,
  Map<string, { name: string; is_dm: boolean }>
>();

export async function getChannelInfo(
  client: WebClient,
  channelId: string,
): Promise<{ name: string; is_dm: boolean }> {
  let cache = channelInfoCache.get(client);
  if (!cache) {
    cache = new Map();
    channelInfoCache.set(client, cache);
  }

  const cached = cache.get(channelId);
  if (cached) return cached;

  const result = await client.conversations.info({ channel: channelId });
  const ch = result.channel as {
    name?: string;
    is_im?: boolean;
    is_mpim?: boolean;
  };
  const info = {
    name: ch.name ?? channelId,
    is_dm: !!(ch.is_im || ch.is_mpim),
  };
  cache.set(channelId, info);
  return info;
}

export function formatTimestamp(ts: string): string {
  const seconds = parseFloat(ts);
  const date = new Date(seconds * 1000);
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const tz = getTimezoneAbbr(date);
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss} ${tz}`;
}

function getTimezoneAbbr(date: Date): string {
  const str = date.toLocaleTimeString("en-US", { timeZoneName: "short" });
  const match = str.match(/\s([A-Z]{2,5})$/);
  return match?.[1] ?? "UTC";
}
