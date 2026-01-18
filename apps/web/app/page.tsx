import { Hero } from "@/components/Hero";
import { NaatGrid } from "@/components/NaatGrid";
import { appwriteService } from "@/lib/appwrite";
import type { Naat } from "@naat-collection/shared";

export default async function Home() {
  let naats: Naat[] = [];
  let error: string | null = null;

  try {
    naats = await appwriteService.getNaats(20, 0, "latest");
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load naats";
    console.error("Error fetching naats:", err);
  }

  return (
    <>
      <Hero />

      <div className="max-w-7xl mx-auto py-8">
        <header className="mb-8 px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-2">Latest Naats</h2>
          <p className="text-neutral-400">Recently uploaded devotional songs</p>
        </header>

        {error && (
          <div className="bg-accent-error/10 border border-accent-error/20 text-accent-error px-4 py-3 rounded mb-6 mx-4 sm:mx-6 lg:mx-8">
            {error}
          </div>
        )}

        <NaatGrid naats={naats} />

        {naats.length === 0 && !error && (
          <div className="text-center py-12 px-4">
            <p className="text-neutral-400">No naats found</p>
          </div>
        )}
      </div>
    </>
  );
}
