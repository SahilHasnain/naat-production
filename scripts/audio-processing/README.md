# Naat Audio Processing Scripts

Automated scripts to extract pure naat audio from YouTube videos by removing interruptions, explanations, and talking.

## Available Scripts

### 1. **Qubrid V2** (100% FREE) ⭐ RECOMMENDED

```bash
npm run process:naat:qubrid "https://youtu.be/VIDEO_ID"
```

- **Transcription:** Qubrid Whisper Large V3 (FREE)
- **Analysis:** Qubrid GPT-OSS-120B (FREE)
- **Cost:** $0.00 - Completely FREE!
- **Best for:** Everyone - no API costs

### 2. **Groq V2** (100% FREE)

```bash
npm run process:naat:groq "https://youtu.be/VIDEO_ID"
```

- **Transcription:** Groq Whisper (FREE)
- **Analysis:** Groq Llama 3.3 70B (FREE)
- **Cost:** $0.00 - Completely FREE!
- **Best for:** Alternative free option

### 3. **Hybrid V2** (Best Value)

```bash
npm run process:naat:hybrid "https://youtu.be/VIDEO_ID"
```

- **Transcription:** Groq Whisper (FREE)
- **Analysis:** OpenAI GPT-4o-mini (~$0.007)
- **Cost:** ~$0.007 per video
- **Best for:** Best accuracy/cost ratio

### 4. **OpenAI V2** (Highest Accuracy)

```bash
npm run process:naat:openai "https://youtu.be/VIDEO_ID"
```

- **Transcription:** OpenAI Whisper (~$0.09)
- **Analysis:** OpenAI GPT-4o-mini (~$0.007)
- **Cost:** ~$0.10 per 15-min video
- **Best for:** Maximum accuracy

## Features

All scripts include:

- ✅ 2-way classification (NAAT / EXPLANATION)
- ✅ Removes talking between verses
- ✅ Removes explanations and commentary
- ✅ Removes long silences (>2 seconds)
- ✅ High-quality audio output (256k AAC, 44.1kHz stereo)
- ✅ Smooth crossfades between segments
- ✅ Detailed JSON and text reports

## Requirements

### System Requirements

- Node.js 16+
- FFmpeg installed
- yt-dlp installed

### API Keys Required

**For Qubrid (FREE):**

- Already configured in the script

**For Groq (FREE):**

```bash
# .env file
GROQ_API_KEY=your_groq_api_key
```

**For OpenAI/Hybrid:**

```bash
# .env file
OPENAI_API_KEY=your_openai_api_key
```

## Installation

1. Install dependencies:

```bash
npm install
```

2. Install system tools:

```bash
# Windows (using Chocolatey)
choco install ffmpeg yt-dlp

# macOS (using Homebrew)
brew install ffmpeg yt-dlp

# Linux (Ubuntu/Debian)
sudo apt install ffmpeg yt-dlp
```

3. Set up API keys in `.env` file (if using OpenAI/Groq)

## Usage

### Basic Usage

```bash
# Use default video
npm run process:naat:qubrid

# Process specific video
npm run process:naat:qubrid "https://youtu.be/mgONEN7IqE8"
```

### Supported URL Formats

- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/watch?v=VIDEO_ID`
- URLs with query parameters

## Output

Each script generates:

1. **Processed Audio:** `temp-audio/processed/{VIDEO_ID}_{provider}_processed.m4a`
2. **JSON Report:** `temp-audio/processed/{VIDEO_ID}_{provider}_report.json`
3. **Text Report:** `temp-audio/processed/{VIDEO_ID}_{provider}_report.txt`

### Report Contents

- Video information
- Transcription details
- Classification breakdown (NAAT vs EXPLANATION)
- List of removed segments
- List of kept segments
- Processing settings

## How It Works

1. **Download Audio:** Uses yt-dlp to download audio from YouTube
2. **Transcribe:** Converts audio to text with timestamps
3. **Analyze:** AI classifies each segment as NAAT or EXPLANATION
4. **Merge:** Combines nearby NAAT segments (removes silences <2s)
5. **Cut:** Removes EXPLANATION segments, keeps only NAAT
6. **Process:** Adds crossfades and outputs high-quality audio
7. **Report:** Generates detailed reports

## Classification Logic

### NAAT (Keep)

- Pure melodic singing
- Rhythmic recitation
- Musical verses
- Continuous devotional content

### EXPLANATION (Remove)

- Talking between verses
- Religious phrases ("SubhanAllah", "MashaAllah")
- Introductions and commentary
- Teaching and explanations
- Stories and context
- Audience reactions
- Any non-singing speech

## Audio Quality Settings

- **Codec:** AAC
- **Bitrate:** 256k (high quality)
- **Sample Rate:** 44.1kHz (CD quality)
- **Channels:** Stereo (2 channels)
- **Padding:** 0.3s around each segment
- **Crossfade:** 0.5s between segments

## Testing

Test FFmpeg with existing audio:

```bash
npm run test:ffmpeg temp-audio/VIDEO_ID.m4a
```

Test FFmpeg with processed JSON:

```bash
npm run test:ffmpeg:json output/processed/VIDEO_ID.json
```

## Troubleshooting

### FFmpeg Errors

- Ensure FFmpeg is installed: `ffmpeg -version`
- Check audio file exists in `temp-audio/`
- Try the test scripts to isolate issues

### API Errors

- Check API keys in `.env` file
- Verify API key has sufficient credits
- Check network connectivity

### No NAAT Segments Found

- Video may be pure explanation/teaching
- Try a different video with actual naat singing
- Check transcription accuracy

## Cost Comparison

| Script | Transcription | Analysis | Total Cost  |
| ------ | ------------- | -------- | ----------- |
| Qubrid | FREE          | FREE     | **$0.00**   |
| Groq   | FREE          | FREE     | **$0.00**   |
| Hybrid | FREE          | ~$0.007  | **~$0.007** |
| OpenAI | ~$0.09        | ~$0.007  | **~$0.10**  |

\*Costs are per 15-minute video

## Recommendations

- **Start with Qubrid or Groq** - Both are 100% FREE
- **Use Hybrid** if you need better accuracy and don't mind minimal cost
- **Use OpenAI** only if you need the absolute highest accuracy

## License

MIT
