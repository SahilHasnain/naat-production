import { NextRequest, NextResponse } from "next/server";
import { Client, Databases, Query, Storage } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const CHANNELS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID!;
const NAATS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_NAATS_COLLECTION_ID!;
const AUDIO_BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_AUDIO_BUCKET_ID!;

interface DeleteOptions {
  deleteChannel: boolean;
  deleteNaats: boolean;
  deleteAudioFiles: boolean;
}

async function fetchAllNaats(channelId: string) {
  const allNaats: any[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await databases.listDocuments(DATABASE_ID, NAATS_COLLECTION_ID, [
      Query.equal("channelId", channelId),
      Query.limit(limit),
      Query.offset(offset),
    ]);

    allNaats.push(...response.documents);
    if (response.documents.length < limit) break;
    offset += limit;
  }

  return allNaats;
}

async function deleteAudioFile(audioId: string): Promise<boolean> {
  try {
    await storage.deleteFile(AUDIO_BUCKET_ID, audioId);
    return true;
  } catch (error: any) {
    if (error.code === 404) {
      return false; // File not found
    }
    throw error;
  }
}

function sendSSE(controller: ReadableStreamDefaultController, data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;

  try {
    const body = (await request.json()) as DeleteOptions;
    const { deleteChannel = true, deleteNaats = false, deleteAudioFiles = false } = body;

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Step 1: Fetch channel
          sendSSE(controller, { type: "progress", message: "Fetching channel information..." });

          const channel = await databases.getDocument(
            DATABASE_ID,
            CHANNELS_COLLECTION_ID,
            channelId
          );

          sendSSE(controller, {
            type: "channel_found",
            channel: {
              name: channel.channelName,
              id: channel.channelId,
            },
          });

          // Step 2: Fetch naats
          sendSSE(controller, { type: "progress", message: "Fetching naats from channel..." });

          const naats = await fetchAllNaats(channel.channelId);

          sendSSE(controller, {
            type: "naats_found",
            count: naats.length,
          });

          let deletedNaatsCount = 0;
          let deletedAudioCount = 0;
          let audioNotFoundCount = 0;
          let errorCount = 0;

          // Step 3: Delete naats and audio files if requested
          if (deleteNaats && naats.length > 0) {
            sendSSE(controller, {
              type: "progress",
              message: `Deleting ${naats.length} naat(s)...`,
            });

            for (let i = 0; i < naats.length; i++) {
              const naat = naats[i];

              try {
                // Delete audio file if requested
                if (deleteAudioFiles) {
                  const audioId = naat.cutAudio || naat.audioId;
                  if (audioId) {
                    try {
                      const deleted = await deleteAudioFile(audioId);
                      if (deleted) {
                        deletedAudioCount++;
                      } else {
                        audioNotFoundCount++;
                      }
                    } catch (audioError) {
                      console.error(`Error deleting audio for ${naat.title}:`, audioError);
                    }
                  }
                }

                // Delete naat document
                await databases.deleteDocument(DATABASE_ID, NAATS_COLLECTION_ID, naat.$id);
                deletedNaatsCount++;

                // Send progress update every 10 naats
                if ((i + 1) % 10 === 0 || i === naats.length - 1) {
                  sendSSE(controller, {
                    type: "naat_progress",
                    current: i + 1,
                    total: naats.length,
                    message: `Deleted ${i + 1}/${naats.length} naats`,
                  });
                }
              } catch (error) {
                errorCount++;
                console.error(`Error deleting naat ${naat.title}:`, error);
              }
            }

            sendSSE(controller, {
              type: "naats_deleted",
              deletedCount: deletedNaatsCount,
              audioDeletedCount: deletedAudioCount,
              audioNotFoundCount,
              errorCount,
            });
          }

          // Step 4: Delete channel if requested
          if (deleteChannel) {
            sendSSE(controller, { type: "progress", message: "Deleting channel..." });

            await databases.deleteDocument(DATABASE_ID, CHANNELS_COLLECTION_ID, channelId);

            sendSSE(controller, {
              type: "channel_deleted",
              message: `Channel "${channel.channelName}" deleted successfully`,
            });
          } else {
            sendSSE(controller, {
              type: "channel_kept",
              message: `Channel "${channel.channelName}" kept in database`,
            });
          }

          // Step 5: Complete
          sendSSE(controller, {
            type: "complete",
            summary: {
              channelName: channel.channelName,
              channelDeleted: deleteChannel,
              naatsDeleted: deletedNaatsCount,
              audioFilesDeleted: deletedAudioCount,
              audioFilesNotFound: audioNotFoundCount,
              errors: errorCount,
            },
          });

          controller.close();
        } catch (error) {
          console.error("Error in delete stream:", error);
          sendSSE(controller, {
            type: "error",
            message: error instanceof Error ? error.message : "Unknown error occurred",
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error setting up delete stream:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete channel" },
      { status: 500 }
    );
  }
}
