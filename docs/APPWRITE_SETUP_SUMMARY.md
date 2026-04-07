# Appwrite Setup Summary

## Setup Completed Successfully ✅

Date: April 2, 2026

### Project Information
- **Project ID**: `69cdf520001137b0e951`
- **Endpoint**: `https://sgp.cloud.appwrite.io/v1`
- **Database ID**: `69cdf9f4000f8532e829`
- **Database Name**: `naatDB`

---

## Collections Created

### 1. Naats Collection
- **Collection ID**: `69cdf9f4003a2c23b94a`
- **Attributes**: 19 total
  - title (string, 500, required)
  - videoUrl (string, 1000, required)
  - thumbnailUrl (string, 1000, required)
  - channelName (string, 200, required)
  - channelId (string, 100, required)
  - youtubeId (string, 50, required)
  - audioId (string, 100, optional)
  - cutAudio (string, 255, optional)
  - cutSegments (string, 5000, optional)
  - cutStatus (string, 50, optional)
  - aiProcessing (string, 50, optional)
  - duration (integer, required)
  - views (integer, required)
  - cutDuration (integer, optional)
  - uploadDate (datetime, required)
  - exclude (boolean, optional)
  - radio (boolean, optional)
  - isAiCut (boolean, optional)
  - aiTrain (boolean, optional, default: false)
- **Indexes**: 4
  - title_search (fulltext)
  - youtubeId_unique (unique)
  - uploadDate_desc (key, DESC)
  - reciterId_index (key)

### 2. Channels Collection
- **Collection ID**: `channels`
- **Attributes**: 10 total
  - channelId (string, 255, required)
  - channelName (string, 255, required)
  - type (string, 20, optional, default: "channel")
  - playlistId (string, 255, optional)
  - naatCount (integer, optional, default: 0)
  - lastUpdated (datetime, optional)
  - isOfficial (boolean, optional, default: true)
  - isOther (boolean, optional, default: false)
  - isOWQ (boolean, required)
  - isSpeech (boolean, required)
- **Indexes**: 2
  - channelId_unique (unique)
  - channelName_index (key, ASC)

### 3. Live Radio Collection
- **Collection ID**: `live_radio`
- **Attributes**: 3 total
  - playlist (string array, 10000, required)
  - updatedAt (string, 255, required)
  - currentTrackIndex (integer, required, min: 0)
- **Indexes**: None

### 4. User Radio States Collection
- **Collection ID**: `user_radio_states`
- **Attributes**: 5 total
  - userId (string, 255, required)
  - updatedAt (string, 255, required)
  - playlist (string array, 10000, required)
  - watchHistory (string array, 10000, required)
  - currentTrackIndex (integer, optional, default: 0)
- **Indexes**: None

### 5. Live Radio Listeners Collection
- **Collection ID**: `live_radio_listeners`
- **Attributes**: 2 total
  - lastHeartbeat (string, 255, required)
  - deviceInfo (string, 500, optional)
- **Indexes**: 1
  - lastHeartbeat_index (key, ASC)

### 6. AI Jobs Collection
- **Collection ID**: `ai_jobs`
- **Attributes**: 12 total
  - type (string, 64, required)
  - naatId (string, 64, required)
  - audioId (string, 64, required)
  - status (string, 32, required)
  - workerId (string, 128, optional)
  - error (string, 5000, optional)
  - resultJson (string, 50000000, optional)
  - progress (integer, optional, 0-100, default: 0)
  - attempts (integer, optional, default: 0)
  - leaseUntil (datetime, optional)
  - startedAt (datetime, optional)
  - finishedAt (datetime, optional)
- **Indexes**: 3
  - type_status_created (key, ASC/ASC/ASC)
  - naatId_idx (key, ASC)
  - status_lease_idx (key, ASC/ASC)

---

## Storage Buckets Created

### 1. Audio Files Bucket
- **Bucket ID**: `audio-files`
- **Max File Size**: 200 MB
- **Allowed Extensions**: Any
- **Encryption**: No
- **Antivirus**: Yes

### 2. Temp Bucket
- **Bucket ID**: `tempbucket`
- **Max File Size**: 5 GB
- **Allowed Extensions**: m4a, mp3, mp4, aac, wav
- **Encryption**: Yes
- **Antivirus**: Yes

### 3. Live Stream Bucket
- **Bucket ID**: `live-stream`
- **Max File Size**: 5 GB
- **Allowed Extensions**: ts, m3u8, m4s
- **Encryption**: Yes
- **Antivirus**: Yes

---

## Scripts Created

### 1. Postmortem Script
**Location**: `scripts/setup/postmortem-appwrite.js`

Analyzes an existing Appwrite project and generates:
- Complete structure documentation
- Setup script to recreate the structure
- JSON report with all details

**Usage**:
```bash
node scripts/setup/postmortem-appwrite.js
```

### 2. Setup Script
**Location**: `scripts/setup/setup-appwrite-fixed.js`

Creates the complete Appwrite structure including:
- Database
- All 6 collections with attributes and indexes
- All 3 storage buckets
- Updates .env.local with generated IDs

**Usage**:
```bash
node scripts/setup/setup-appwrite-fixed.js
```

### 3. Cleanup Script
**Location**: `scripts/setup/cleanup-appwrite.js`

Deletes all databases and buckets from the project. Use this to start fresh.

**Usage**:
```bash
node scripts/setup/cleanup-appwrite.js
```

---

## Environment Variables

All necessary environment variables have been updated in:
`apps/mobile/.env.local`

Key variables:
- `APPWRITE_DATABASE_ID=69cdf9f4000f8532e829`
- `APPWRITE_NAATS_COLLECTION_ID=69cdf9f4003a2c23b94a`
- `APPWRITE_CHANNELS_COLLECTION_ID=channels`
- `APPWRITE_LIVE_RADIO_COLLECTION_ID=live_radio`
- `APPWRITE_AI_JOBS_COLLECTION_ID=ai_jobs`

---

## Next Steps

1. ✅ Database structure created
2. ✅ Collections with attributes and indexes created
3. ✅ Storage buckets created
4. ✅ Environment variables updated

### Remaining Tasks:

1. **Verify in Appwrite Console**
   - Log in to https://cloud.appwrite.io
   - Check that all collections and buckets are visible
   - Verify permissions are set correctly

2. **Deploy Functions**
   - Deploy the 10 functions from naat-collection:
     - ingest-videos
     - stream-audio
     - semantic-search
     - batch-embed
     - cutAudio
     - naat-streaming
     - live-stream-metadata
     - live-stream-health
     - ai-jobs
     - upload-audio

3. **Test the Application**
   - Run the mobile app
   - Test basic CRUD operations
   - Verify audio streaming works
   - Test live radio functionality

4. **Data Migration** (if needed)
   - If you need to migrate data from naat-collection to naat-production
   - Create migration scripts to copy documents between projects

---

## Troubleshooting

### If you need to start over:
```bash
node scripts/setup/cleanup-appwrite.js
node scripts/setup/setup-appwrite-fixed.js
```

### If collections already exist:
The setup script will fail if collections already exist. Use the cleanup script first.

### If you need to analyze another project:
Edit the `postmortem-appwrite.js` script to point to a different .env file.

---

## Notes

- This setup is based on the postmortem analysis of naat-collection
- All collection IDs match the original structure except for unique IDs
- Bucket configurations match the original setup
- The structure is production-ready and matches your working naat-collection project
