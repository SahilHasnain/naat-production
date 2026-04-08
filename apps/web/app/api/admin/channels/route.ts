import { NextRequest, NextResponse } from "next/server";
import { Client, Databases, ID, Query } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const CHANNELS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID!;
const NAATS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_NAATS_COLLECTION_ID!;

function hasAudio(naat: Record<string, unknown>) {
  return Boolean(String(naat.cutAudio || naat.audioId || "").trim());
}

async function fetchAllDocuments(collectionId: string, queries: string[] = []) {
  const allDocuments: Record<string, unknown>[] = [];
  let offset = 0;
  const limit = 5000;

  while (true) {
    const response = await databases.listDocuments(DATABASE_ID, collectionId, [
      ...queries,
      Query.limit(limit),
      Query.offset(offset),
    ]);

    allDocuments.push(...response.documents);
    if (response.documents.length < limit) break;
    offset += limit;
  }

  return allDocuments;
}

function normalizeChannelPayload(body: Record<string, unknown>) {
  const channelId = String(body.channelId || "").trim();
  const channelName = String(body.channelName || "").trim();
  const type = body.type === "playlist" ? "playlist" : "channel";
  const playlistId = String(body.playlistId || "").trim();
  const isOther = Boolean(body.isOther);

  if (!channelId) {
    throw new Error("Channel ID is required");
  }

  if (!channelName) {
    throw new Error("Channel name is required");
  }

  if (type === "playlist" && !playlistId) {
    throw new Error("Playlist ID is required for playlist sources");
  }

  return {
    channelId,
    channelName,
    type,
    isOther,
    ...(type === "playlist" ? { playlistId } : {}),
  };
}

export async function GET() {
  try {
    const [channels, naats] = await Promise.all([
      fetchAllDocuments(CHANNELS_COLLECTION_ID),
      fetchAllDocuments(NAATS_COLLECTION_ID),
    ]);

    const enrichedChannels = channels
      .map((channel) => {
        const channelId = String(channel.channelId || channel.$id || "");
        const channelNaats = naats.filter((naat) => String(naat.channelId || "") === channelId);

        return {
          $id: String(channel.$id || channelId),
          channelId,
          channelName: String(channel.channelName || channel.name || "Unknown Channel"),
          type: channel.type === "playlist" ? "playlist" : "channel",
          playlistId: typeof channel.playlistId === "string" ? channel.playlistId : undefined,
          isOfficial: Boolean(channel.isOfficial),
          isOther: Boolean(channel.isOther),
          naatCount: channelNaats.length,
          withAudioCount: channelNaats.filter(hasAudio).length,
          updatedAt: String(channel.updatedAt || channel.$updatedAt || ""),
        };
      })
      .sort((a, b) => b.naatCount - a.naatCount || a.channelName.localeCompare(b.channelName));

    return NextResponse.json({ channels: enrichedChannels });
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeChannelPayload(body);

    const existing = await databases.listDocuments(DATABASE_ID, CHANNELS_COLLECTION_ID, [
      Query.equal("channelId", payload.channelId),
      Query.limit(1),
    ]);

    if (existing.documents.length > 0) {
      return NextResponse.json({ error: "Channel already exists" }, { status: 409 });
    }

    const document = await databases.createDocument(
      DATABASE_ID,
      CHANNELS_COLLECTION_ID,
      ID.unique(),
      payload,
    );

    return NextResponse.json({ channel: document }, { status: 201 });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create channel" },
      { status: 400 },
    );
  }
}
