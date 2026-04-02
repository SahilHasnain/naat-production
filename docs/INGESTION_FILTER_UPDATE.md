# Ingestion Filter Update

## What Changed

The video ingestion script (`scripts/data-management/ingest-videos.js`) has been updated to automatically filter out non-Owais naats from the "Baghdadi Sound and Media" channel.

## Filter Logic

### Rule Applied:

For videos from **Baghdadi Sound and Media** channel:

- ✅ **INCLUDE** videos with "Naat Production" in the title
- 🚫 **EXCLUDE** all other videos (non-Naat Production naats)

### Other Channels:

- ✅ All videos from other channels are included (no filtering)

## How It Works

The new `shouldFilterVideo()` function:

1. Checks if the channel name contains "baghdadi sound" or "baghdadi" + "media" (case-insensitive)
2. If it's the Baghdadi channel, checks if the title contains any Owais-related keywords
3. Returns `true` to filter out (exclude) videos that don't match the criteria

## Example Output

When running `npm run ingest:videos`, you'll now see:

```
📺 Processing channel: UCxxxxx
   ✅ Found 150 videos for channel: Baghdadi Sound and Media

   🚫 Filtered: Some Other Naat Title (non-Naat Production from Baghdadi)
   ✅ Added: Naat Production - Beautiful Naat (1234 views)
   🚫 Filtered: Another Non-Naat Production Naat (non-Naat Production from Baghdadi)
   🔄 Updated: Naat Production Latest Naat (5000 → 5100 views)

📊 Per-Channel Statistics:
════════════════════════════════════════════════════════════
📺 Baghdadi Sound and Media (UCxxxxx):
   📹 Total videos: 150
   ✅ New videos added: 25
   🔄 Videos updated: 30
   ⏭️  Videos unchanged: 50
   🚫 Videos filtered: 45
   ❌ Errors: 0
```

## Testing the Filter

Before running the full ingestion, you can check which videos would be filtered:

```bash
npm run check:non-owais
```

This will show you exactly which videos from Baghdadi Sound and Media don't contain Owais names in the title.

## Reverting the Filter

If you need to remove this filter, simply delete or comment out the filter check in the ingestion script:

```javascript
// Comment out these lines in ingestChannelVideos function:
// if (shouldFilterVideo(channelName, title)) {
//   console.log(`   🚫 Filtered: ${title} (non-Owais from Baghdadi)`);
//   filteredCount++;
//   continue;
// }
```

## Notes

- The filter is case-insensitive for both channel names and video titles
- Existing videos in the database are not affected - only new ingestions
- The filter only applies during ingestion, not to videos already in the database
- To clean up existing non-Owais videos, you'll need to run a separate cleanup script
