"use client";

import { useEffect, useState } from "react";

interface DatabaseStats {
  totalNaats: number;
  totalWithAudio: number;
  totalWithoutAudio: number;
  channelsCount: number;
  audioFilesCount: number;
}

interface ChannelStats {
  $id: string;
  name: string;
  channelId: string;
  type: string;
  isOfficial: boolean;
  isOther: boolean;
  totalCount: number;
  withAudioCount: number;
  withoutAudioCount: number;
}

interface ChannelDetails extends ChannelStats {
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  cutAudioCount: number;
}

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export default function DatabaseInspector() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [channels, setChannels] = useState<ChannelStats[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [channelDetails, setChannelDetails] = useState<ChannelDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    void fetchDatabaseStats();
  }, []);

  const fetchDatabaseStats = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/database/stats");
      const data = await response.json();
      setStats(data.stats);
      setChannels(data.channels || []);
    } catch (error) {
      console.error("Error fetching database stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannelDetails = async (channelId: string) => {
    try {
      setSelectedChannel(channelId);
      setLoadingDetails(true);
      const response = await fetch(`/api/admin/database/channel/${channelId}`);
      const data = await response.json();
      setChannelDetails(data);
    } catch (error) {
      console.error("Error fetching channel details:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-sky-400" />
          <p className="text-neutral-400">Loading database statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <h1 className="mb-8 text-3xl font-bold">Database Inspector</h1>

      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-sky-300">Database Overview</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-6">
            <div className="mb-2 text-3xl">Total</div>
            <div className="text-2xl font-bold text-white">{stats?.totalNaats.toLocaleString()}</div>
            <div className="text-sm text-neutral-400">Naats</div>
          </div>
          <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-6">
            <div className="mb-2 text-3xl">Audio</div>
            <div className="text-2xl font-bold text-emerald-400">{stats?.totalWithAudio.toLocaleString()}</div>
            <div className="text-sm text-neutral-400">With Audio</div>
          </div>
          <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-6">
            <div className="mb-2 text-3xl">Missing</div>
            <div className="text-2xl font-bold text-amber-400">{stats?.totalWithoutAudio.toLocaleString()}</div>
            <div className="text-sm text-neutral-400">Without Audio</div>
          </div>
          <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-6">
            <div className="mb-2 text-3xl">Feeds</div>
            <div className="text-2xl font-bold text-white">{stats?.channelsCount.toLocaleString()}</div>
            <div className="text-sm text-neutral-400">Channels</div>
          </div>
          <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-6">
            <div className="mb-2 text-3xl">Files</div>
            <div className="text-2xl font-bold text-sky-400">{stats?.audioFilesCount.toLocaleString()}</div>
            <div className="text-sm text-neutral-400">Audio Files</div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-sky-300">Channels</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">Channel</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">With Audio</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">Missing</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">Coverage</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-neutral-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {channels.map((channel) => {
                  const coverage = channel.totalCount > 0 ? ((channel.withAudioCount / channel.totalCount) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={channel.$id} className="transition-colors hover:bg-neutral-700/30">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-white">{channel.name}</div>
                          <div className="text-xs font-mono text-neutral-400">{channel.channelId}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-neutral-700 px-2.5 py-0.5 text-xs font-medium text-neutral-300">{channel.type}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-white">{channel.totalCount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-sm text-emerald-400">{channel.withAudioCount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-sm text-amber-400">{channel.withoutAudioCount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end">
                          <div className="mr-2 h-2 w-16 rounded-full bg-neutral-700">
                            <div className="h-2 rounded-full bg-sky-500" style={{ width: `${Math.min(Number(coverage), 100)}%` }} />
                          </div>
                          <span className="text-sm text-white">{coverage}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => fetchChannelDetails(channel.channelId)} className="text-sm font-medium text-sky-400 transition-colors hover:text-sky-300">
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800">
            <div className="sticky top-0 flex items-center justify-between border-b border-neutral-700 bg-neutral-800 px-6 py-4">
              <h3 className="text-xl font-semibold text-white">{channelDetails?.name || "Loading..."}</h3>
              <button onClick={() => { setSelectedChannel(null); setChannelDetails(null); }} className="text-neutral-400 transition-colors hover:text-white">Close</button>
            </div>
            <div className="p-6">
              {loadingDetails ? (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-sky-400" />
                  <p className="text-neutral-400">Loading channel details...</p>
                </div>
              ) : channelDetails ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="rounded-lg bg-neutral-900 p-4"><div className="text-2xl font-bold text-white">{channelDetails.totalCount.toLocaleString()}</div><div className="text-sm text-neutral-400">Total Naats</div></div>
                    <div className="rounded-lg bg-neutral-900 p-4"><div className="text-2xl font-bold text-emerald-400">{channelDetails.withAudioCount.toLocaleString()}</div><div className="text-sm text-neutral-400">With Audio</div></div>
                    <div className="rounded-lg bg-neutral-900 p-4"><div className="text-2xl font-bold text-amber-400">{channelDetails.withoutAudioCount.toLocaleString()}</div><div className="text-sm text-neutral-400">Missing Audio</div></div>
                    <div className="rounded-lg bg-neutral-900 p-4"><div className="text-2xl font-bold text-sky-400">{channelDetails.cutAudioCount.toLocaleString()}</div><div className="text-sm text-neutral-400">Cut Audio</div></div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-neutral-900 p-4">
                      <h4 className="mb-3 text-sm font-semibold text-neutral-300">Duration Stats</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-neutral-400">Total Duration</span><span className="font-mono text-white">{formatDuration(channelDetails.totalDuration)}</span></div>
                        <div className="flex justify-between"><span className="text-neutral-400">Average</span><span className="font-mono text-white">{formatDuration(channelDetails.avgDuration)}</span></div>
                        <div className="flex justify-between"><span className="text-neutral-400">Longest</span><span className="font-mono text-white">{formatDuration(channelDetails.maxDuration)}</span></div>
                        <div className="flex justify-between"><span className="text-neutral-400">Shortest</span><span className="font-mono text-white">{formatDuration(channelDetails.minDuration)}</span></div>
                      </div>
                    </div>
                    <div className="rounded-lg bg-neutral-900 p-4">
                      <h4 className="mb-3 text-sm font-semibold text-neutral-300">Channel Settings</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-neutral-400">Type</span><span className="text-white">{channelDetails.type}</span></div>
                        <div className="flex justify-between"><span className="text-neutral-400">Official</span><span className={channelDetails.isOfficial ? "text-emerald-400" : "text-neutral-500"}>{channelDetails.isOfficial ? "Yes" : "No"}</span></div>
                        <div className="flex justify-between"><span className="text-neutral-400">Other Tab</span><span className={channelDetails.isOther ? "text-amber-400" : "text-neutral-500"}>{channelDetails.isOther ? "Yes" : "No"}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
