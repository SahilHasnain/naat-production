import { NaatGrid } from "@/components/NaatGrid";
import { SearchBar } from "@/components/SearchBar";
import { appwriteService } from "@/lib/appwrite";
import type { Naat } from "@naat-collection/shared";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || "";

  let naats: Naat[] = [];
  let error: string | null = null;
  let isSearching = false;

  if (query.trim()) {
    isSearching = true;
    try {
      naats = await appwriteService.searchNaats(query);
    } catch (err) {
      error = err instanceof Error ? err.message : "Search failed";
      console.error("Error searching naats:", err);
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-8">
      <header className="mb-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-6">Search Naats</h1>
        <SearchBar />
      </header>

      {error && (
        <div className="bg-accent-error/10 border border-accent-error/20 text-accent-error px-4 py-3 rounded mb-6 mx-4 sm:mx-6 lg:mx-8">
          {error}
        </div>
      )}

      {isSearching && (
        <>
          <div className="mb-6 px-4 sm:px-6 lg:px-8">
            <p className="text-neutral-400">
              {naats.length > 0
                ? `Found ${naats.length} result${naats.length === 1 ? "" : "s"} for "${query}"`
                : `No results found for "${query}"`}
            </p>
          </div>

          {naats.length > 0 && <NaatGrid naats={naats} searchQuery={query} />}

          {naats.length === 0 && !error && (
            <div className="text-center py-12 px-4">
              <p className="text-neutral-400 mb-4">
                No naats found matching your search.
              </p>
              <p className="text-sm text-neutral-500">
                Try different keywords or check your spelling.
              </p>
            </div>
          )}
        </>
      )}

      {!isSearching && (
        <div className="text-center py-12 px-4">
          <svg
            className="mx-auto h-12 w-12 text-neutral-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-neutral-400 mb-2">Start searching for naats</p>
          <p className="text-sm text-neutral-500">
            Enter keywords to find your favorite naats
          </p>
        </div>
      )}
    </div>
  );
}
