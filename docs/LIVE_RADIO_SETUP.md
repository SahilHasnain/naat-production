# Live Radio Setup Guide

## Overview

This guide will help you set up the 24/7 live naat radio feature. The system uses a "pseudo-live" approach where all users are synchronized to play the same naat at the same position, creating a shared listening experience without requiring actual streaming infrastructure.

## How It Works

```
┌─────────────────────────────────────────┐
│  Appwrite Function (Runs every 5 min)  │
│  - Selects random naat from database    │
│  - Updates live_radio collection        │
│  - Generates playlist of next 10 naats  │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  Appwrite Database                      │
│  Collection: live_radio                 │
│  Document: current_state                │
│  - currentNaatId: "abc123"              │
│  - startedAt: "2024-01-01T12:00:00Z"    │
│  - playlist: ["def456", "ghi789", ...]  │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  Mobile App (All Users)                 │
│  1. Fetch current state                 │
│  2. Calculate playback position         │
│  3. Start playing at correct position   │
│  4. Subscribe to realtime updates       │
└─────────────────────────────────────────┘
```

**Key Concept**: Instead of streaming, we use time-based synchronization:

- Function stores which naat is "currently playing" + start timestamp
- Each user calculates where in the naat they should be based on elapsed time
- Everyone plays the same naat at the same position = synchronized!

## Setup Steps

### 1. Create Live Radio Collection

Run the setup script:

```bash
node scripts/setup/setup-live-radio.js
```

This creates a collection with:

- `currentNaatId` (string): ID of currently playing naat
- `startedAt` (string): ISO timestamp when current naat started
- `playlist` (string array): IDs of next 10 naats
- `updatedAt` (string): Last update timestamp

### 2. Deploy Live Radio Manager Function

#### Option A: Using Appwrite CLI

1. Install Appwrite CLI if you haven't:

```bash
npm install -g appwrite-cli
```

2. Login to Appwrite:

```bash
appwrite login
```

3. Initialize function:

```bash
cd functions/live-radio-manager
appwrite init function
```

4. Deploy function:

```bash
appwrite deploy function
```

#### Option B: Manual Deployment via Appwrite Console

1. Go to Appwrite Console → Functions
2. Create new function:
   - **Name**: Live Radio Manager
   - **Runtime**: Node.js 18+
   - **Entrypoint**: `src/main.js`
3. Upload the `functions/live-radio-manager` folder
4. Set environment variables:
   - `APPWRITE_DATABASE_ID`: Your database ID
   - `APPWRITE_NAATS_COLLECTION_ID`: Your naats collection ID
   - `APPWRITE_API_KEY`: Your API key (with database read/write permissions)

### 3. Configure Scheduled Execution

In Appwrite Console → Functions → Live Radio Manager:

1. Go to "Settings" tab
2. Add a schedule:
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
   - **Enabled**: Yes

This ensures the function checks every 5 minutes if the current track has ended and needs to be changed.

### 4. Initialize the Live Radio State

Run the function manually once to initialize:

```bash
# Using Appwrite CLI
appwrite functions execute [FUNCTION_ID]

# Or via API
curl -X POST \
  https://[YOUR-APPWRITE-ENDPOINT]/v1/functions/[FUNCTION_ID]/executions \
  -H "X-Appwrite-Project: [PROJECT_ID]" \
  -H "X-Appwrite-Key: [API_KEY]"
```

Or use the "Execute Now" button in Appwrite Console.

### 5. Update Environment Variables

Add to your `.env` files:

**apps/mobile/.env**:

```env
EXPO_PUBLIC_LIVE_RADIO_COLLECTION_ID=live_radio
```

**apps/web/.env.local** (if adding to web):

```env
NEXT_PUBLIC_LIVE_RADIO_COLLECTION_ID=live_radio
```

### 6. Test the Feature

1. Start your mobile app:

```bash
npm run mobile
```

2. Navigate to the "Live" tab
3. You should see the current naat playing
4. Tap "Listen Live" to start playback
5. Open the app on another device/emulator - both should be synchronized!

## Architecture Details

### Time-Based Synchronization

```javascript
// How synchronization works:
const startTime = new Date("2024-01-01T12:00:00Z").getTime();
const now = Date.now();
const elapsed = now - startTime;

// User A joins at 12:02 → starts at 2:00 position
// User B joins at 12:04 → starts at 4:00 position
// Both hear the same thing!
```

### Automatic Track Advancement

The function checks every 5 minutes:

```javascript
if (elapsed >= naatDuration) {
  // Select new random naat
  // Update live_radio collection
  // All users receive realtime update
  // All users switch to new naat
}
```

### Realtime Updates

The app subscribes to Appwrite Realtime:

```javascript
client.subscribe("databases.*.collections.live_radio.documents", (response) => {
  // New naat started!
  // Reload and play new naat
});
```

## Features

### Current Implementation

✅ 24/7 continuous playback
✅ Synchronized across all users
✅ Random naat selection from database
✅ Upcoming playlist (next 10 tracks)
✅ Listener count (placeholder)
✅ LIVE badge in player
✅ Disabled seek controls for live content
✅ Realtime updates when track changes
✅ Background playback support

### Future Enhancements

Potential additions:

- [ ] Scheduled programs (e.g., "Friday Special" at specific times)
- [ ] Multiple channels (e.g., "Naat Production Only" channel)
- [ ] Real listener count tracking
- [ ] Chat/comments during live playback
- [ ] "Rewind" feature (buffer last 30 minutes)
- [ ] Push notifications for special programs
- [ ] Analytics (most popular times, tracks)

## Troubleshooting

### Live Radio Not Loading

1. Check if `live_radio` collection exists in Appwrite
2. Verify function has been executed at least once
3. Check function logs in Appwrite Console
4. Ensure environment variables are set correctly

### Users Not Synchronized

1. Check if Appwrite Realtime is enabled
2. Verify function is running on schedule
3. Check device time settings (must be accurate)
4. Look for errors in app console

### Function Errors

Common issues:

- **"No naats found"**: Database is empty, run ingestion first
- **"Permission denied"**: API key needs database permissions
- **"Collection not found"**: Run setup script first

## Cost Analysis

### Free Tier (Appwrite Cloud)

- **Database**: 1 collection, 1 document, ~10 updates/hour = FREE
- **Functions**: 1 function, 12 executions/hour = FREE (within limits)
- **Realtime**: Unlimited connections = FREE
- **Bandwidth**: Minimal (only metadata, not audio) = FREE

### Self-Hosted

- **Server**: Any VPS ($5-10/month)
- **Appwrite**: Self-hosted = FREE
- **Total**: $5-10/month

## Comparison with Real Streaming

| Feature        | Pseudo-Live (Our Approach) | Real Streaming         |
| -------------- | -------------------------- | ---------------------- |
| Cost           | FREE                       | $50-500/month          |
| Latency        | 0-5 seconds                | 2-30 seconds           |
| Scalability    | Unlimited users            | Limited by bandwidth   |
| Complexity     | Low                        | High                   |
| Seek Control   | Can be enabled             | Usually disabled       |
| Infrastructure | Appwrite only              | Streaming server + CDN |

## Support

For issues or questions:

1. Check function logs in Appwrite Console
2. Check app console for errors
3. Verify all setup steps completed
4. Review this documentation

## Next Steps

After setup:

1. Test with multiple devices
2. Monitor function execution logs
3. Gather user feedback
4. Consider adding scheduled programs
5. Implement analytics

---

**Congratulations!** 🎉 Your 24/7 live naat radio is now running!
