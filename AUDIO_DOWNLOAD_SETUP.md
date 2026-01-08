# Audio Download Feature Setup

## Overview

The app now supports downloading audio files for offline playback. Audio is stored on the device and played locally when available.

## Installation Complete ✅

The following has been set up:

1. **expo-file-system** - Installed for file management
2. **audioDownloadService** - Service to handle downloads
3. **Download UI** - Added to VideoModal in audio mode
4. **Local playback** - AudioPlayer checks for local files first

## How It Works

### For Users:

1. Open a naat in audio mode
2. Click "Download for Offline" button
3. Audio downloads with progress indicator
4. Once downloaded, audio plays from device (faster, no internet needed)
5. Can delete downloaded audio to free up space

### Technical Flow:

1. Check if audio is downloaded locally
2. If yes → Play from device (`file://` URI)
3. If no → Stream from Appwrite Storage (HTTP URL)
4. Download button available when streaming
5. Metadata stored in AsyncStorage

## File Structure

```
services/
  audioDownload.ts       # Download service

components/
  VideoModal.tsx         # Download UI
  AudioPlayer.tsx        # Supports local files
```

## Storage Location

Audio files are stored in:

```
${FileSystem.documentDirectory}audio/
```

Example: `file:///data/user/0/com.app/documents/audio/[audioId].m4a`

## Features

- ✅ Download with progress tracking
- ✅ Automatic local playback when available
- ✅ Delete downloaded files
- ✅ Metadata tracking (title, size, date)
- ✅ Works offline once downloaded
- ✅ Autoplay in audio mode

## Next Steps

To use the feature:

1. Run the download script to populate audio in storage:
   ```bash
   node scripts/download-audio.js
   ```
2. Test the app - audio should stream from Appwrite Storage
3. Click download button to save locally
4. Audio will play from device on next open
