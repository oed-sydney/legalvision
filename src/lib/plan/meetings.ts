import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * LegalVision meeting summaries captured by ClickUp's AI Notetaker. The
 * snapshot (data/clickup-meetings.json) is produced by a Claude-session crawl
 * of the ClickUp workspace — the summaries themselves are AI-written there,
 * so a runtime API refresh can't regenerate them; re-crawl to update.
 */

const STORE_PATH = path.join(process.cwd(), "data", "clickup-meetings.json");

export interface Meeting {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  url: string;
  attendees: string;
  summary: string;
  /** Dot-point version of the summary (preferred display format). */
  bullets?: string[];
}

export interface MeetingsSnapshot {
  workspaceId?: string;
  source?: string;
  fetchedAt: string;
  note?: string;
  meetings: Meeting[];
}

export function readMeetingsSnapshot(): MeetingsSnapshot | null {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as MeetingsSnapshot;
    raw.meetings = (raw.meetings ?? []).sort((a, b) => (a.date < b.date ? 1 : -1));
    return raw;
  } catch {
    return null;
  }
}
