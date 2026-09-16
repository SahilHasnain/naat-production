#!/usr/bin/env node

/**
 * Ingest videos from a YouTube playlist into Appwrite naats collection.
 *
 * Usage:
 *   YOUTUBE_API_KEY=xxx node scripts/data-management/ingest-playlist.js PLHuAMgO4JK9g
 */

const { Client, Databases, ID, Query } = require("node-appwrite");

const PLAYLIST_ID = process.argv[2];
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69907afc003b9e3d9152";
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "main-db";
const NAATS_COLLECTION_ID = process.env.APPWRITE_NAATS_COLLECTION_ID || "naats";

function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

async function fetchPlaylistInfo(playlistId, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${playlistId}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (!data.items?.length) throw new Error(`Playlist not found: ${playlistId}`);
  return {
    name: data.items[0].snippet.title,
    channelName: data.items[0].snippet.channelTitle,
    itemCount: data.items[0].contentDetails.itemCount,
  };
}

async function fetchAllPlaylistVideos(playlistId, apiKey) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";
  const allItems = [];
  let pageToken = null;

  do {
    let url = `${baseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${apiKey}`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (data.items?.length) allItems.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allItems;
}

async function fetchVideoDetails(videoIds, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,statistics&id=${videoIds.join(",")}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.items || [];
}

async function main() {
  if (!PLAYLIST_ID) { console.error("Usage: node ingest-playlist.js <PLAYLIST_ID>"); process.exit(1); }
  if (!YOUTUBE_API_KEY) { console.error("Missing YOUTUBE_API_KEY"); process.exit(1); }
  if (!API_KEY) { console.error("Missing APPWRITE_API_KEY"); process.exit(1); }

  console.log(`Playlist: ${PLAYLIST_ID}`);
  console.log(`Project:  ${PROJECT_ID}\n`);

  // 1. Fetch playlist info
  const info = await fetchPlaylistInfo(PLAYLIST_ID, YOUTUBE_API_KEY);
  console.log(`Name:     ${info.name}`);
  console.log(`Channel:  ${info.channelName}`);
  console.log(`Videos:   ${info.itemCount}\n`);

  // 2. Fetch all playlist items
  console.log("Fetching playlist items...");
  const items = await fetchAllPlaylistVideos(PLAYLIST_ID, YOUTUBE_API_KEY);
  console.log(`Found ${items.length} items\n`);

  // 3. Get unique video IDs
  const videoIds = [...new Set(items.map(i => i.contentDetails?.videoId).filter(Boolean))];
  console.log(`Unique videos: ${videoIds.length}\n`);

  // 4. Init Appwrite
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);

  // 5. Get existing youtubeIds to skip duplicates
  console.log("Checking existing documents...");
  const existingIds = new Set();
  let offset = 0;
  while (true) {
    const resp = await databases.listDocuments(DATABASE_ID, NAATS_COLLECTION_ID, [
      Query.limit(5000), Query.offset(offset), Query.select(["youtubeId"]),
    ]);
    resp.documents.forEach(d => existingIds.add(d.youtubeId));
    if (resp.documents.length < 5000) break;
    offset += 5000;
  }
  console.log(`Existing naats: ${existingIds.size}\n`);

  // 5. Fetch video details in batches of 50
  console.log("Fetching video details from YouTube...");
  const allVideos = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const details = await fetchVideoDetails(batch, YOUTUBE_API_KEY);
    allVideos.push(...details);
    process.stdout.write(`  ${allVideos.length}/${videoIds.length}\r`);
  }
  console.log(`\nGot details for ${allVideos.length} videos\n`);

  // 6. Create documents
  let added = 0, skipped = 0, errors = 0;
  for (const video of allVideos) {
    if (existingIds.has(video.id)) {
      skipped++;
      continue;
    }

    const doc = {
      title: video.snippet.title,
      videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
      thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || "",
      duration: parseDuration(video.contentDetails.duration),
      uploadDate: video.snippet.publishedAt,
      channelName: info.channelName,
      channelId: `pl_${PLAYLIST_ID.substring(0, 8)}`,
      youtubeId: video.id,
      views: parseInt(video.statistics?.viewCount || "0", 10),
    };

    try {
      await databases.createDocument(DATABASE_ID, NAATS_COLLECTION_ID, ID.unique(), doc);
      added++;
      console.log(`  [${added}] ${doc.title}`);
    } catch (e) {
      if (e.code === 409) { skipped++; }
      else { errors++; console.error(`  ERR: ${doc.title} - ${e.message}`); }
    }
  }

  console.log(`\nDone! Added: ${added}, Skipped: ${skipped}, Errors: ${errors}`);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
