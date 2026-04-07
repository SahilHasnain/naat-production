"use client";

import { useEffect, useMemo, useState } from "react";

interface ChannelOption {
  $id: string;
  channelId: string;
  channelName: string;
  type: "channel" | "playlist";
  isOfficial: boolean;
  isOther: boolean;
}

function parseSseChunk(chunk: string) {
  return chunk
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6)) as { type: string; message?: string; code?: number };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as { type: string; message?: string; code?: number }[];
}

export default function IngestClient() {
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [limit, setLimit] = useState(250);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [exitCode, setExitCode] = useState<number | null>(null);

  useEffect(() => {
    void fetchChannels();
  }, []);

  async function fetchChannels() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/channels");
      const data = await response.json();
      const channelList = (data.channels || []) as ChannelOption[];
      setChannels(channelList);
      setSelectedChannels(channelList.filter((item) => item.isOfficial).map((item) => item.channelId));
    } finally {
      setLoading(false);
    }
  }

  function addLog(message: string) {
    setLogs((current) => [...current, `[${new Date().toLocaleTimeString("en-IN")}] ${message}`]);
  }

  function toggleChannel(channelId: string) {
    setSelectedChannels((current) =>
      current.includes(channelId)
        ? current.filter((item) => item !== channelId)
        : [...current, channelId],
    );
  }

  async function startIngest() {
    if (selectedChannels.length === 0 || running) return;

    setRunning(true);
    setLogs([]);
    setExitCode(null);
    addLog("Starting ingest run...");

    try {
      const response = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelIds: selectedChannels,
          limit: limitEnabled ? limit : null,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Failed to start ingest (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          for (const event of parseSseChunk(part)) {
            if (event.type === "log" && event.message) addLog(event.message);
            if (event.type === "complete") {
              setExitCode(event.code ?? 0);
              addLog(`Ingest finished with exit code ${event.code ?? 0}.`);
            }
          }
        }
      }
    } catch (error) {
      addLog(error instanceof Error ? error.message : "Ingest failed");
      setExitCode(1);
    } finally {
      setRunning(false);
    }
  }

  const selectedCount = useMemo(() => selectedChannels.length, [selectedChannels]);

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Ingest</h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Run the existing `scripts/data-management/ingest-videos.js` workflow from the admin app.
            Logs stream live over SSE and the selected channels are injected into the script environment.
          </p>
        </div>
        <button
          type="button"
          onClick={startIngest}
          disabled={running || selectedChannels.length === 0}
          className="rounded-full border border-sky-400/30 bg-sky-500/15 px-5 py-2.5 text-sm font-medium text-sky-100 transition hover:border-sky-300/40 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? "Running..." : "Start Ingest"}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-sm text-neutral-400">Selected</div>
          <div className="mt-2 text-3xl font-semibold text-white">{selectedCount}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-sm text-neutral-400">Total Sources</div>
          <div className="mt-2 text-3xl font-semibold text-white">{channels.length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-sm text-neutral-400">Last Exit</div>
          <div className={`mt-2 text-3xl font-semibold ${exitCode === null ? "text-neutral-500" : exitCode === 0 ? "text-emerald-300" : "text-red-300"}`}>
            {exitCode === null ? "-" : exitCode}
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Source Selection</h2>
          <button
            type="button"
            onClick={() => setSelectedChannels(selectedChannels.length === channels.length ? [] : channels.map((item) => item.channelId))}
            className="text-sm text-sky-300 transition hover:text-sky-200"
          >
            {selectedChannels.length === channels.length ? "Clear All" : "Select All"}
          </button>
        </div>

        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={limitEnabled}
            onChange={(event) => setLimitEnabled(event.target.checked)}
            className="h-4 w-4"
          />
          <span>Limit videos per run</span>
          <input
            type="number"
            min="1"
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value) || 1)}
            disabled={!limitEnabled}
            className="w-28 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
          />
        </div>

        {loading ? (
          <div className="py-10 text-sm text-neutral-400">Loading channels...</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {channels.map((channel) => (
              <label key={channel.$id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20">
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(channel.channelId)}
                  onChange={() => toggleChannel(channel.channelId)}
                  className="mt-1 h-4 w-4"
                />
                <div className="min-w-0">
                  <div className="truncate font-medium text-white">{channel.channelName}</div>
                  <div className="mt-1 truncate font-mono text-xs text-neutral-500">{channel.channelId}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-neutral-300">{channel.type}</span>
                    {channel.isOfficial ? <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-200">Official</span> : null}
                    {channel.isOther ? <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-200">Other</span> : null}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Live Log</h2>
        <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950 p-4 font-mono text-xs text-neutral-300">
          {logs.length === 0 ? <div className="text-neutral-500">Run ingest to stream logs here.</div> : logs.map((log, index) => <div key={`${index}-${log}`}>{log}</div>)}
        </div>
      </div>
    </div>
  );
}
