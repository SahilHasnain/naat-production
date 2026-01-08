/**
 * Naat Audio Processing Script V3 - Batch Processing
 *
 * Improvements over V2:
 * - Batch processing to handle 100+ segments
 * - Maintains context across batches
 * - Better Urdu-specific patterns
 * - Two-pass refinement
 */

const { spawn } = require("child_process");
const dotenv = require("dotenv");
const { existsSync, mkdirSync, writeFileSync } = require("fs");
const { join } = require("path");
const Groq = require("groq-sdk").default;
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

ffmpeg.setFfmpegPath(ffmpegPath);
dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TEMP_DIR = join(process.cwd(), "temp-audio");
const OUTPUT_DIR = join(process.cwd(), "temp-audio", "processed");
const BATCH_SIZE = 60; // Process 60 segments at a time

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

    console.log(
      `  ✓ Transcription completed (${transcription.segments?.length || 0} segments)`
    );
    return transcription;
  } catch (error) {
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

async function analyzeBatch(
  segmentBatch,
  batchIndex,
  totalBatches,
  allSegments
) {
  console.log(
    `  Processing batch ${batchIndex + 1}/${totalBatches} (${segmentBatch.length} segments)...`
  );

  // Add context from previous batch if available
  const contextBefore =
    batchIndex > 0
      ? allSegments
          .slice(Math.max(0, segmentBatch[0].index - 2), segmentBatch[0].index)
          .map((s) => `[${s.index}] ${s.text.substring(0, 50)}`)
          .join(" | ")
      : "";

  const segmentData = segmentBatch.map((s) => ({
    index: s.index,
    start: s.start.toFixed(1),
    end: s.end.toFixed(1),
    duration: (s.end - s.start).toFixed(1),
    text: s.text.substring(0, 180),
  }));

  const prompt = `You are an expert in Urdu naats (Islamic devotional poetry/songs).

DISTINGUISH BETWEEN:

1. NAAT (نعت) - Melodic recitation with:
   - Poetic structure, rhythmic patterns
   - Praise of Prophet Muhammad (ﷺ)
   - Repetitive phrases/chorus
   - Formal classical Urdu
   - KEY PHRASES: "تمہارے لیے", "جانے جانا", "یا احمد", "قربان", "نبی کریم"

2. EXPLANATION (تشریح) - Conversational speech with:
   - Informal tone, explanatory language
   - Questions, modern phrases
   - KEY WORDS: "سوچتے", "کیونکہ", "دیکھو", "سمجھو", "یہ بات", "ہم", "آپ"

CRITICAL RULES:
- "تمہارے لیے" or "جانے جانا" → NAAT
- "کیونکہ" or "سوچتے" or "دیکھو" → EXPLANATION
- Short segments (< 3s) → check carefully
- Repetitive text → likely NAAT
- When uncertain → prefer EXPLANATION

${contextBefore ? `CONTEXT FROM PREVIOUS: ${contextBefore}\n` : ""}

SEGMENTS:
${JSON.stringify(segmentData, null, 2)}

Respond in JSON:
{
  "segments": [
    {
      "segment_index": 0,
      "type": "naat" or "explanation",
      "start_time": seconds,
      "end_time": seconds,
      "confidence": "high/medium/low",
      "reasoning": "specific pattern"
    }
  ]
}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an expert in Urdu naats. Distinguish poetic recitation from conversational speech. Respond only with valid JSON.",
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

    const result = JSON.parse(completion.choices[0].message.content);
    return result.segments || [];
  } catch (error) {
    console.error(`  ❌ Batch ${batchIndex + 1} failed: ${error.message}`);
    // Return default classification on error
    return segmentBatch.map((s) => ({
      segment_index: s.index,
      type: "explanation", // Safe default
      start_time: s.start,
      end_time: s.end,
      confidence: "low",
      reasoning: "Error in analysis, defaulted to explanation",
    }));
  }
}

async function analyzeTranscript(transcription) {
  console.log(
    `  Analyzing ${transcription.segments.length} segments in batches...`
  );

  const allSegments = transcription.segments.map((s, i) => ({
    index: i,
    start: s.start,
    end: s.end,
    text: s.text,
  }));

  // Split into batches
  const batches = [];
  for (let i = 0; i < allSegments.length; i += BATCH_SIZE) {
    batches.push(allSegments.slice(i, i + BATCH_SIZE));
  }

  console.log(`  Total batches: ${batches.length}`);

  // Process each batch
  let allResults = [];
  for (let i = 0; i < batches.length; i++) {
    const batchResults = await analyzeBatch(
      batches[i],
      i,
      batches.length,
      allSegments
    );
    allResults = allResults.concat(batchResults);

    // Small delay between batches to avoid rate limits
    if (i < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Enrich with full text
  allResults = allResults.map((seg) => ({
    ...seg,
    text: transcription.segments[seg.segment_index]?.text || "",
  }));

  console.log(
    `  ✓ First pass complete: ${allResults.length} segments classified`
  );

  // Second pass for medium confidence
  const mediumConf = allResults.filter((s) => s.confidence === "medium");
  if (mediumConf.length > 0) {
    console.log(`  🔍 Refining ${mediumConf.length} uncertain segments...`);
    const refined = await refineSegments(mediumConf, transcription);

    refined.forEach((refinedSeg) => {
      const index = allResults.findIndex(
        (s) => s.segment_index === refinedSeg.segment_index
      );
      if (index !== -1) {
        allResults[index] = refinedSeg;
      }
    });
    console.log(`  ✓ Refinement complete`);
  }

  // Generate summary
  const naatCount = allResults.filter((s) => s.type === "naat").length;
  const explCount = allResults.filter((s) => s.type === "explanation").length;
  const summary = `Analyzed ${allResults.length} segments: ${naatCount} naat, ${explCount} explanation. Batch processing with context awareness.`;

  return {
    segments: allResults,
    summary: summary,
  };
}

async function refineSegments(segments, transcription) {
  // Process in smaller batches for refinement
  const refineBatchSize = 20;
  let refined = [];

  for (let i = 0; i < segments.length; i += refineBatchSize) {
    const batch = segments.slice(i, i + refineBatchSize);

    const segmentDetails = batch.map((s) => {
      const contextBefore = transcription.segments
        .slice(Math.max(0, s.segment_index - 2), s.segment_index)
        .map((seg) => seg.text.substring(0, 80))
        .join(" ");
      const contextAfter = transcription.segments
        .slice(
          s.segment_index + 1,
          Math.min(transcription.segments.length, s.segment_index + 3)
        )
        .map((seg) => seg.text.substring(0, 80))
        .join(" ");

      return {
        index: s.segment_index,
        text: transcription.segments[s.segment_index].text.substring(0, 150),
        context_before: contextBefore,
        context_after: contextAfter,
        current_type: s.type,
      };
    });

    const refinePrompt = `Review these UNCERTAIN segments with context:

${JSON.stringify(segmentDetails, null, 2)}

For each: Determine NAAT (poetic) or EXPLANATION (conversational) using context.

Respond in JSON:
{
  "segments": [
    {
      "segment_index": 0,
      "type": "naat" or "explanation",
      "start_time": seconds,
      "end_time": seconds,
      "confidence": "high",
      "reasoning": "reason"
    }
  ]
}`;

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "Expert in Urdu naats. Use context for confident decisions. Respond only with valid JSON.",
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

      const result = JSON.parse(completion.choices[0].message.content);
      if (result.segments) {
        refined = refined.concat(
          result.segments.map((seg) => ({
            ...seg,
            text: transcription.segments[seg.segment_index]?.text || "",
          }))
        );
      }
    } catch (error) {
      console.warn(`  ⚠️  Refinement batch failed, keeping original`);
      refined = refined.concat(batch);
    }

    if (i + refineBatchSize < segments.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return refined;
}

async function cutAudio(inputPath, segments, youtubeId) {
  console.log(`  Cutting audio to remove explanations...`);

  const naatSegments = segments.filter((s) => s.type === "naat");

  if (naatSegments.length === 0) {
    console.log(`  ⚠️  No naat segments identified`);
    return null;
  }

  console.log(`  Found ${naatSegments.length} naat segments to keep`);

  const outputPath = join(OUTPUT_DIR, `${youtubeId}_processed_v3.m4a`);
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
      total_segments: transcription.segments.length,
    },
    analysis: {
      ...analysis,
      statistics: {
        total_segments: analysis.segments.length,
        naat_segments: analysis.segments.filter((s) => s.type === "naat")
          .length,
        explanation_segments: analysis.segments.filter(
          (s) => s.type === "explanation"
        ).length,
        high_confidence: analysis.segments.filter(
          (s) => s.confidence === "high"
        ).length,
        medium_confidence: analysis.segments.filter(
          (s) => s.confidence === "medium"
        ).length,
        low_confidence: analysis.segments.filter((s) => s.confidence === "low")
          .length,
      },
    },
    output: {
      processed_audio: processedPath,
      original_audio: join(TEMP_DIR, `${naat.youtubeId}.m4a`),
    },
    timestamp: new Date().toISOString(),
  };

  const reportPath = join(OUTPUT_DIR, `${naat.youtubeId}_report_v3.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const readablePath = join(OUTPUT_DIR, `${naat.youtubeId}_report_v3.txt`);
  const readable = `
NAAT AUDIO PROCESSING REPORT V3 (Batch Processing)
===================================================

Video: ${naat.title}
YouTube: https://www.youtube.com/watch?v=${naat.youtubeId}
Processed: ${new Date().toLocaleString()}

STATISTICS
----------
Total Segments: ${report.analysis.statistics.total_segments}
Naat Segments: ${report.analysis.statistics.naat_segments}
Explanation Segments: ${report.analysis.statistics.explanation_segments}

Confidence Levels:
- High: ${report.analysis.statistics.high_confidence}
- Medium: ${report.analysis.statistics.medium_confidence}
- Low: ${report.analysis.statistics.low_confidence}

SUMMARY
-------
${analysis.summary}

SAMPLE SEGMENTS (First 20)
---------------------------
${analysis.segments
  .slice(0, 20)
  .map(
    (s, i) => `
${i + 1}. ${s.type.toUpperCase()} (${s.start_time}s - ${s.end_time}s) [${s.confidence}]
   Text: ${s.text.substring(0, 100)}...
   Reasoning: ${s.reasoning}
`
  )
  .join("\n")}

... (See JSON file for all ${analysis.segments.length} segments)

FILES
-----
Original: ${report.output.original_audio}
Processed: ${processedPath || "N/A"}
Full Report: ${reportPath}
`;

  writeFileSync(readablePath, readable);

  console.log(`\n✓ Reports generated:`);
  console.log(`  JSON: ${reportPath}`);
  console.log(`  Text: ${readablePath}`);
}

async function main() {
  console.log("🎵 Naat Audio Processing Script V3 (Batch Processing)\n");

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

    console.log("\n🧠 Step 3: Analyzing transcript (batch + 2-pass)...");
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
    console.log(
      `\nNaat segments: ${analysis.segments.filter((s) => s.type === "naat").length}`
    );
    console.log(
      `Explanation segments: ${analysis.segments.filter((s) => s.type === "explanation").length}`
    );
    console.log(`\nCheck: ${OUTPUT_DIR}`);
    console.log(
      `\n💡 Listen to processed audio and review report for accuracy.`
    );
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
