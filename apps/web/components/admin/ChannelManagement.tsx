"use client";

import { useEffect, useMemo, useState } from "react";

interface ChannelRow {
  $id: string;
  channelId: string;
  channelName: string;
  type: "channel" | "playlist";
  playlistId?: string;
  isOther: boolean;
  naatCount: number;
  withAudioCount: number;
  updatedAt?: string;
}

interface ChannelFormState {
  channelId: string;
  channelName: string;
  type: "channel" | "playlist";
  playlistId: string;
  isOther: boolean;
}

const emptyForm: ChannelFormState = {
  channelId: "",
  channelName: "",
  type: "channel",
  playlistId: "",
  isOther: false,
};

function formatDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function ChannelManagement() {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelRow | null>(null);
  const [form, setForm] = useState<ChannelFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchChannels();
  }, []);

  const summary = useMemo(() => {
    const totalNaats = channels.reduce((sum, channel) => sum + channel.naatCount, 0);
    const totalWithAudio = channels.reduce((sum, channel) => sum + channel.withAudioCount, 0);
    const otherCount = channels.filter((channel) => channel.isOther).length;

    return { totalNaats, totalWithAudio, otherCount };
  }, [channels]);

  async function fetchChannels() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/channels");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch channels");
      }

      setChannels(data.channels || []);
    } catch (fetchError) {
      console.error("Error fetching channels:", fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch channels");
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setForm(emptyForm);
    setEditingChannel(null);
    setShowAddModal(true);
  }

  function openEditModal(channel: ChannelRow) {
    setForm({
      channelId: channel.channelId,
      channelName: channel.channelName,
      type: channel.type,
      playlistId: channel.playlistId || "",
      isOther: channel.isOther,
    });
    setEditingChannel(channel);
    setShowAddModal(true);
  }

  function closeModal() {
    setShowAddModal(false);
    setEditingChannel(null);
    setForm(emptyForm);
    setSaving(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.channelId.trim() || !form.channelName.trim()) {
      setError("Channel ID and channel name are required.");
      return;
    }

    if (form.type === "playlist" && !form.playlistId.trim()) {
      setError("Playlist ID is required when the source type is playlist.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        channelId: form.channelId.trim(),
        channelName: form.channelName.trim(),
        type: form.type,
        playlistId: form.type === "playlist" ? form.playlistId.trim() : undefined,
        isOther: form.isOther,
      };

      const response = await fetch(
        editingChannel ? `/api/admin/channels/${encodeURIComponent(editingChannel.channelId)}` : "/api/admin/channels",
        {
          method: editingChannel ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save channel");
      }

      await fetchChannels();
      closeModal();
    } catch (submitError) {
      console.error("Error saving channel:", submitError);
      setError(submitError instanceof Error ? submitError.message : "Failed to save channel");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Channels</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Manage source channels and playlists for ingestion. This page is aligned to the
            current Naat Production channel schema, including official and other-tab flags.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="rounded-full border border-sky-400/30 bg-sky-500/15 px-5 py-2.5 text-sm font-medium text-sky-100 transition hover:border-sky-300/40 hover:bg-sky-500/25"
        >
          Add Channel
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-sm text-neutral-400">Sources</div>
          <div className="mt-2 text-3xl font-semibold text-white">{channels.length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-sm text-neutral-400">Other Tab</div>
          <div className="mt-2 text-3xl font-semibold text-amber-300">{summary.otherCount}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-sm text-neutral-400">Audio Coverage</div>
          <div className="mt-2 text-3xl font-semibold text-sky-300">
            {summary.totalNaats > 0 ? `${Math.round((summary.totalWithAudio / summary.totalNaats) * 100)}%` : "0%"}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-sky-400" />
              <p className="text-sm text-neutral-400">Loading channels...</p>
            </div>
          </div>
        ) : channels.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-lg font-medium text-white">No channels found</p>
            <p className="mt-2 text-sm text-neutral-400">Add your first source to start managing ingestion targets.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead className="bg-black/20">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Source</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Type</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Naats</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">With Audio</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Flags</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Updated</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {channels.map((channel) => {
                  const coverage = channel.naatCount > 0 ? Math.round((channel.withAudioCount / channel.naatCount) * 100) : 0;

                  return (
                    <tr key={channel.$id} className="transition hover:bg-white/[0.03]">
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1">
                          <div className="font-medium text-white">{channel.channelName}</div>
                          <div className="font-mono text-xs text-neutral-400">{channel.channelId}</div>
                          {channel.playlistId ? (
                            <div className="font-mono text-xs text-neutral-500">Playlist: {channel.playlistId}</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium capitalize text-neutral-200">
                          {channel.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right align-top text-sm font-semibold text-white">{channel.naatCount.toLocaleString()}</td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-sm font-semibold text-sky-300">{channel.withAudioCount.toLocaleString()}</span>
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-sky-400" style={{ width: `${coverage}%` }} />
                          </div>
                          <span className="w-10 text-right text-xs text-neutral-400">{coverage}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          {channel.isOther ? (
                            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-200">Other</span>
                          ) : null}
                          {!channel.isOther ? (
                            <span className="rounded-full bg-white/[0.04] px-3 py-1 text-xs font-medium text-neutral-400">Standard</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-neutral-400">{formatDate(channel.updatedAt)}</td>
                      <td className="px-6 py-4 text-right align-top">
                        <button
                          type="button"
                          onClick={() => openEditModal(channel)}
                          className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-white">{editingChannel ? "Edit Channel" : "Add Channel"}</h2>
                <p className="mt-1 text-sm text-neutral-400">Update channel metadata and admin flags.</p>
              </div>
              <button type="button" onClick={closeModal} className="text-sm text-neutral-400 transition hover:text-white">
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-200">Channel ID</label>
                <input
                  value={form.channelId}
                  onChange={(event) => setForm((current) => ({ ...current, channelId: event.target.value }))}
                  disabled={Boolean(editingChannel)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-sky-400/40"
                  placeholder="UC... or pl_..."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-200">Channel Name</label>
                <input
                  value={form.channelName}
                  onChange={(event) => setForm((current) => ({ ...current, channelName: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-sky-400/40"
                  placeholder="Display name"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-200">Source Type</label>
                  <select
                    value={form.type}
                    onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as "channel" | "playlist" }))}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
                  >
                    <option value="channel">Channel</option>
                    <option value="playlist">Playlist</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-200">Playlist ID</label>
                  <input
                    value={form.playlistId}
                    onChange={(event) => setForm((current) => ({ ...current, playlistId: event.target.value }))}
                    disabled={form.type !== "playlist"}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-sky-400/40 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="PL..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-200">
                  <input
                    type="checkbox"
                    checked={form.isOther}
                    onChange={(event) => setForm((current) => ({ ...current, isOther: event.target.checked }))}
                    className="h-4 w-4 rounded border-white/20 bg-transparent"
                  />
                  Show in Other tab
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-white/20 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full border border-sky-400/30 bg-sky-500/15 px-5 py-2 text-sm font-medium text-sky-100 transition hover:border-sky-300/40 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : editingChannel ? "Save Changes" : "Create Channel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
