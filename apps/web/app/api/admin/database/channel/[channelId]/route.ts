import { NextResponse } from "next/server";
import { Client, Databases, Query } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const NAATS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_NAATS_COLLECTION_ID!;
const CHANNELS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID!;

async function fetchAllNaatsForChannel(channelId: string) {
  const allDocuments = [] as any[];
  let offset = 0;
  const limit = 5000;

  while (true) {
    const response = await databases.listDocuments(DATABASE_ID, NAATS_COLLECTION_ID, [
      Query.equal("channelId", channelId),
      Query.limit(limit),
      Query.offset(offset),
    ]);

    allDocuments.push(...response.documents);
    if (response.documents.length < limit) break;
    offset += limit;
  }

  return allDocuments;
}

function hasAudio(naat: any) {
  return Boolean(String(naat.cutAudio || naat.audioId || "").trim());
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await params;

    const channelsResponse = await databases.listDocuments(DATABASE_ID, CHANNELS_COLLECTION_ID, [
      Query.equal("channelId", channelId),
      Query.limit(1),
    ]);

    if (channelsResponse.documents.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const channel = channelsResponse.documents[0];
    const naats = await fetchAllNaatsForChannel(channelId);
    const withAudio = naats.filter(hasAudio);
    const durations = naats.map((naat) => Number(naat.duration || 0)).filter((value) => Number.isFinite(value));
    const totalDuration = durations.reduce((sum, value) => sum + value, 0);

    return NextResponse.json({
      $id: channel.$id,
      name: String(channel.channelName || channel.name || "Unknown Channel"),
      channelId,
      type: String(channel.type || "channel"),
      isOfficial: Boolean(channel.isOfficial),
      isOther: Boolean(channel.isOther),
      totalCount: naats.length,
      withAudioCount: withAudio.length,
      withoutAudioCount: naats.length - withAudio.length,
      totalDuration,
      avgDuration: naats.length > 0 ? totalDuration / naats.length : 0,
      maxDuration: durations.length ? Math.max(...durations) : 0,
      minDuration: durations.length ? Math.min(...durations) : 0,
      cutAudioCount: naats.filter((naat) => Boolean(String(naat.cutAudio || "").trim())).length,
    });
  } catch (error) {
    console.error("Error fetching channel details:", error);
    return NextResponse.json({ error: "Failed to fetch channel details" }, { status: 500 });
  }
}
