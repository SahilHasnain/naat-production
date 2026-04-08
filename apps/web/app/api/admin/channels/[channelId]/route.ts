import { NextRequest, NextResponse } from "next/server";
import { Client, Databases, Query } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const CHANNELS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID!;

function normalizeChannelPayload(body: Record<string, unknown>) {
  const channelName = String(body.channelName || "").trim();
  const type = body.type === "playlist" ? "playlist" : "channel";
  const playlistId = String(body.playlistId || "").trim();

  if (!channelName) {
    throw new Error("Channel name is required");
  }

  if (type === "playlist" && !playlistId) {
    throw new Error("Playlist ID is required for playlist sources");
  }

  return {
    channelName,
    type,
    isOther: Boolean(body.isOther),
    ...(type === "playlist" ? { playlistId } : { playlistId: null }),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await params;
    const decodedChannelId = decodeURIComponent(channelId);
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeChannelPayload(body);

    const existing = await databases.listDocuments(DATABASE_ID, CHANNELS_COLLECTION_ID, [
      Query.equal("channelId", decodedChannelId),
      Query.limit(1),
    ]);

    if (existing.documents.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const document = existing.documents[0];
    const updated = await databases.updateDocument(
      DATABASE_ID,
      CHANNELS_COLLECTION_ID,
      String(document.$id),
      payload,
    );

    return NextResponse.json({ channel: updated });
  } catch (error) {
    console.error("Error updating channel:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update channel" },
      { status: 400 },
    );
  }
}
