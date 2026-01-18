import { NaatGrid } from "@/components/NaatGrid";
import { appwriteService } from "@/lib/appwrite";
import type { Naat } from "@naat-collection/shared";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChannelPage({ params }: PageProps) {
  const { id } = await params;

  let naats: Naat[] = [];
  let error: string | null = null;
  let channelName = "";

  try {
    naats = await appwriteService.getNaats(20, 0, "latest", id);
    if (naats.length > 0) {
      channelName = naats[0].channelName;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load naats";
    console.error("Error fetching naats:", err);
  }

  return (
    <div className="max-w-7xl mx-auto py-8">
      <header className="mb-8 px-4 sm:px-6 lg:px-8">
        <Link
          href="/channels"
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-4"
        >
          ← Back to Channels
        </Link>
        <h1 className="text-3xl font-bold mb-2">{channelName || "Channel"}</h1>
        <p className="text-neutral-400">{naats.length} naats</p>
      </header>

      {error && (
        <div className="bg-accent-error/10 border border-accent-error/20 text-accent-error px-4 py-3 rounded mb-6 mx-4 sm:mx-6 lg:mx-8">
          {error}
        </div>
      )}

      <NaatGrid naats={naats} channelId={id} />

      {naats.length === 0 && !error && (
        <div className="text-center py-12 px-4">
          <p className="text-neutral-400">No naats found for this channel</p>
        </div>
      )}
    </div>
  );
}
