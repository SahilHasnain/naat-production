import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { join } from "path";

export const maxDuration = 1800;

function sse(message: unknown) {
  return `data: ${JSON.stringify(message)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { channelIds?: string[]; limit?: number | null };
    const channelIds = Array.isArray(body.channelIds) ? body.channelIds.filter(Boolean) : [];

    if (channelIds.length === 0) {
      return new Response(JSON.stringify({ error: "At least one channel is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const scriptPath = join(process.cwd(), "..", "..", "scripts", "data-management", "ingest-videos.js");

    const stream = new ReadableStream({
      start(controller) {
        const child = spawn(process.execPath, [scriptPath], {
          cwd: join(process.cwd(), "..", ".."),
          env: {
            ...process.env,
            YOUTUBE_CHANNEL_IDS: channelIds.join(","),
            EXPO_PUBLIC_DATABASE_ID:
              process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || process.env.EXPO_PUBLIC_DATABASE_ID,
            EXPO_PUBLIC_COLLECTION_ID:
              process.env.NEXT_PUBLIC_APPWRITE_NAATS_COLLECTION_ID || process.env.EXPO_PUBLIC_COLLECTION_ID,
            ...(body.limit ? { INGEST_MAX_RESULTS: String(body.limit) } : {}),
          },
        });

        const pushLine = (message: string) => {
          controller.enqueue(encoder.encode(sse({ type: "log", message })));
        };

        child.stdout.on("data", (data) => {
          for (const line of data.toString().split(/\r?\n/)) {
            if (line.trim()) pushLine(line);
          }
        });

        child.stderr.on("data", (data) => {
          for (const line of data.toString().split(/\r?\n/)) {
            if (line.trim()) pushLine(`[stderr] ${line}`);
          }
        });

        child.on("close", (code) => {
          controller.enqueue(encoder.encode(sse({ type: "complete", code: code ?? 0 })));
          controller.close();
        });

        child.on("error", (error) => {
          controller.enqueue(encoder.encode(sse({ type: "log", message: error.message })));
          controller.enqueue(encoder.encode(sse({ type: "complete", code: 1 })));
          controller.close();
        });
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to start ingest" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
