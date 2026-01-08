/**
 * Naat Audio Processing Script V2 - Improved Accuracy
 *
 * Improvements:
 * - Better prompt with Urdu-specific patterns
 * - Context-aware analysis
 * - Two-pass refinement for uncertain segments
 * - Lower temperature for consistency
 */

const { spawn } = require("child_process");
const dotenv = require("dotenv");
const { existsSync, mkdirSync, writeFileSync, readFileSync } = require("fs");
const { join } = require("path");
const Groq = require("groq-sdk").default;
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

ffmpeg.setFfmpegPath(ffmpegPath);
dotenv.config();

// Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TEMP_DIR = join(process.cwd(), "temp-audio");
const OUTPUT_DIR = join(process.cwd(), "temp-audio", "processed");

const groq = new Groq({ apiKey: GROQ_API_KEY });

function ensureDirectories() {
  [TEMP_DIR, OUTPUT_DIR].forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

async function downloadAudio(youtubeId, title) {
  const outputPath = join(TEMP_DIR, `${youtubeId}.m4a`);

  if (existsSync(outputPath)) {
    console.log(`  ✓ Audio already exists`);
    return outputPath;
  }

  console.log(`  Downloading: ${title}`);

  return new Promise((resolve, reject) => {
    const ytdlp = spawn("yt-dlp", [
      "-f",
      "bestaudio[ext=m4a]/bestaudio",
      "--extract-audio",
      "--audio-format",
      "m4a",
      "--audio-quality",
      "128K",
      "-o",
      outputPath,
      "--no-playlist",
      `https://www.youtube.com/watch?v=${youtubeId}`,
    ]);

    ytdlp.stdout.on("data", () => process.stdout.write("."));
    ytdlp.on("close", (code) => {
      console.log("");
      if (code === 0 && existsSync(outputPath)) {
        console.log(`  ✓ Downloaded successfully`);
        resolve(outputPath);
      } else {
        reject(new Error(`yt-dlp failed with code ${code}`));
      }
    });
  });
}

async function transcribeAudio(audioPath) {
  console.log(`  Transcribing audio with Groq Whisper...`);

  try {
    const fs = require("fs");
    const fileStream = fs.createReadStream(audioPath);

    const transcription = await groq.audio.transcriptions.create({
      file: fileStream,
      model: "whisper-large-v3-turbo",
      language: "ur",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    console.log(`  ✓ Transcription completed`);
    return transcription;
  } catch (error) {
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

async function analyzeTranscript(transcription) {
  console.log(`  Analyzing transcript with improved AI...`);

  // Prepare segment data with context
  const segmentData = transcription.segments?.map((s, i) => {
    const prev =
      i > 0 ? transcription.segments[i - 1].text.substring(0, 50) : "";
    const next =
      i < transcription.segments.length - 1
        ? transcription.segments[i + 1].text.substring(0, 50)
        : "";

    return {
      index: i,
      start: s.start.toFixed(1),
      end: s.end.toFixed(1),
      duration: (s.end - s.start).toFixed(1),
      text: s.text.substring(0, 200),
      prev_text: prev,
      next_text: next,
    };
  });

  const prompt = `You are an expert in Urdu naats (Islamic devotional poetry/songs) and can distinguish between:

1. NAAT (نعت): Melodic recitation/singing with:
   - Poetic structure (شعری انداز)
   - Rhythmic patterns (موزونیت)
   - Praise of Prophet Muhammad (ﷺ)
   - Repetitive phrases/chorus
   - Formal, classical Urdu
   - Common phrases: "تمہارے لیے", "جانے جانا", "یا احمد", "صلی اللہ", "نبی کریم"

2. EXPLANATION (تشریح): Conversational speech with:
   - Informal tone (بول چال)
   - Explanatory language (تشریح)
   - Questions and answers
   - Modern Urdu phrases
   - Words like: "سوچتے", "کیونکہ", "دیکھو", "سمجھو", "یہ بات", "ہم", "آپ"

CRITICAL PATTERNS:
- "تمہارے لیے", "جانے جانا", "قربان" → NAAT
- "کیونکہ", "سوچتے", "دیکھو", "یہ بات" → EXPLANATION
- Very short segments (< 3s) → check context carefully
- Repetitive text → likely NAAT chorus
- Conversational questions → EXPLANATION

SEGMENTS:
${JSON.stringify(segmentData.slice(0, 100), null, 2)}

INSTRUCTIONS:
1. Analyze text, duration, and context (prev/next segments)
2. Match against patterns above
3. Consider segment length and repetition
4. BE STRICT: When uncertain, prefer EXPLANATION over NAAT

Respond in JSON:
{
  "segments": [
    {
      "segment_index": 0,
      "type": "naat" or "explanation",
      "start_time": seconds,
      "end_time": seconds,
      "confidence": "high/medium/low",
      "reasoning": "specific pattern or reason"
    }
  ],
  "summary": "brief analysis"
}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an expert in Urdu language and Islamic naats. Distinguish poetic recitation from conversational speech. Respond only with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const analysis = JSON.parse(completion.choices[0].message.content);

    // Enrich with full text
    if (analysis.segments && transcription.segments) {
      analysis.segments = analysis.segments.map((seg) => ({
        ...seg,
        text: transcription.segments[seg.segment_index]?.text || "",
      }));
    }

    console.log(
      `  ✓ First pass: ${analysis.segments?.length || 0} segments classified`
    );

    // Second pass for medium confidence
    const mediumConf =
      analysis.segments?.filter((s) => s.confidence === "medium") || [];
    if (mediumConf.length > 0) {
      console.log(`  🔍 Refining ${mediumConf.length} uncertain segments...`);
      const refined = await refineSegments(mediumConf, transcription);

      refined.forEach((refinedSeg) => {
        const index = analysis.segments.findIndex(
          (s) => s.segment_index === refinedSeg.segment_index
        );
        if (index !== -1) {
          analysis.segments[index] = refinedSeg;
        }
      });
      console.log(`  ✓ Refinement completed`);
    }

    return analysis;
  } catch (error) {
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

async function refineSegments(segments, transcription) {
  const segmentDetails = segments.map((s) => {
    const fullSeg = transcription.segments[s.segment_index];
    const contextBefore = transcription.segments
      .slice(Math.max(0, s.segment_index - 2), s.segment_index)
      .map((seg) => seg.text)
      .join(" ");
    const contextAfter = transcription.segments
      .slice(
        s.segment_index + 1,
        Math.min(transcription.segments.length, s.segment_index + 3)
      )
      .map((seg) => seg.text)
      .join(" ");

    return {
      index: s.segment_index,
      text: fullSeg.text,
      context_before: contextBefore.substring(0, 150),
      context_after: contextAfter.substring(0, 150),
      current_type: s.type,
      reasoning: s.reasoning,
    };
  });

  const refinePrompt = `Review these UNCERTAIN segments with full context:

${JSON.stringify(segmentDetails, null, 2)}

For each segment:
1. Read context before and after
2. Determine if NAAT (poetic/melodic) or EXPLANATION (conversational)
3. Increase confidence to "high" if now certain

Respond in JSON:
{
  "segments": [
    {
      "segment_index": 0,
      "type": "naat" or "explanation",
      "start_time": seconds,
      "end_time": seconds,
      "confidence": "high/medium/low",
      "reasoning": "reason with context"
    }
  ]
}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an expert in Urdu naats. Use context to make confident decisions. Respond only with valid JSON.",
        },
        {
          role: "user",
          content: refinePrompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const refined = JSON.parse(completion.choices[0].message.content);

    if (refined.segments && transcription.segments) {
      refined.segments = refined.segments.map((seg) => ({
        ...seg,
        text: transcription.segments[seg.segment_index]?.text || "",
      }));
    }

    return refined.segments || [];
  } catch (error) {
    console.warn(`  ⚠️  Refinement failed: ${error.message}`);
    return segments;
  }
}

async function cutAudio(inputPath, segments, youtubeId) {
  console.log(`  Cutting audio to remove explanations...`);

  const naatSegments = segments.filter((s) => s.type === "naat");

  if (naatSegments.length === 0) {
    console.log(`  ⚠️  No naat segments identified`);
    return null;
  }

  const outputPath = join(OUTPUT_DIR, `${youtubeId}_processed.m4a`);
  const filterComplex = [];
  const inputs = [];

  naatSegments.forEach((segment, index) => {
    filterComplex.push(
      `[0:a]atrim=start=${segment.start_time}:end=${segment.end_time},asetpts=PTS-STARTPTS[a${index}]`
    );
    inputs.push(`[a${index}]`);
  });

  filterComplex.push(
    `${inputs.join("")}concat=n=${naatSegments.length}:v=0:a=1[out]`
  );

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .complexFilter(filterComplex)
      .outputOptions(["-map", "[out]"])
      .output(outputPath)
      .on("end", () => {
        console.log(`  ✓ Audio cut successfully`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .run();
  });
}

function generateReport(naat, transcription, analysis, processedPath) {
  const report = {
    video: {
      title: naat.title,
      youtubeId: naat.youtubeId,
      url: `https://www.youtube.com/watch?v=${naat.youtubeId}`,
    },
    transcription: {
      language: transcription.language,
      duration: transcription.duration,
      text: transcription.text,
    },
    analysis: analysis,
    output: {
      processed_audio: processedPath,
      original_audio: join(TEMP_DIR, `${naat.youtubeId}.m4a`),
    },
    timestamp: new Date().toISOString(),
  };

  const reportPath = join(OUTPUT_DIR, `${naat.youtubeId}_report_v2.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const readablePath = join(OUTPUT_DIR, `${naat.youtubeId}_report_v2.txt`);
  const readable = `
NAAT AUDIO PROCESSING REPORT V2
================================

Video: ${naat.title}
YouTube: https://www.youtube.com/watch?v=${naat.youtubeId}
Processed: ${new Date().toLocaleString()}

TRANSCRIPTION
-------------
Language: ${transcription.language}
Duration: ${transcription.duration}s

SEGMENTS IDENTIFIED
-------------------
${analysis.segments
  ?.map(
    (s, i) => `
${i + 1}. ${s.type.toUpperCase()} (${s.start_time}s - ${s.end_time}s)
   Confidence: ${s.confidence}
   Text: ${s.text.substring(0, 100)}...
   Reasoning: ${s.reasoning}
`
  )
  .join("\n")}

SUMMARY
-------
${analysis.summary}

FILES
-----
Original: ${join(TEMP_DIR, `${naat.youtubeId}.m4a`)}
Processed: ${processedPath || "N/A"}
`;

  writeFileSync(readablePath, readable);

  console.log(`\n✓ Reports generated:`);
  console.log(`  JSON: ${reportPath}`);
  console.log(`  Text: ${readablePath}`);
}

async function main() {
  console.log("🎵 Naat Audio Processing Script V2 (Improved)\n");

  ensureDirectories();

  const TEST_VIDEO_ID = "nJvbN9wadEU";
  const naat = {
    youtubeId: TEST_VIDEO_ID,
    title: "Test Naat - Hardcoded",
    $id: "test-" + TEST_VIDEO_ID,
  };

  console.log(`✓ Video ID: ${TEST_VIDEO_ID}\n`);

  try {
    console.log("📥 Step 1: Downloading audio...");
    const audioPath = await downloadAudio(naat.youtubeId, naat.title);

    console.log("\n🎤 Step 2: Transcribing audio...");
    const transcription = await transcribeAudio(audioPath);

    console.log("\n🧠 Step 3: Analyzing transcript (2-pass)...");
    const analysis = await analyzeTranscript(transcription);

    console.log("\n✂️  Step 4: Processing audio...");
    const processedPath = await cutAudio(
      audioPath,
      analysis.segments,
      naat.youtubeId
    );

    console.log("\n📊 Step 5: Generating report...");
    generateReport(naat, transcription, analysis, processedPath);

    console.log("\n" + "=".repeat(60));
    console.log("✅ PROCESSING COMPLETE!");
    console.log("=".repeat(60));
    console.log(`\nCheck: ${OUTPUT_DIR}`);
    console.log(`\n💡 Compare V2 results with V1 to assess improvement.`);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
