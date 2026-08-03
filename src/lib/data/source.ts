import { ACCOUNT_BY_ID } from "../domain/accounts";
import type { AdAccount, CampaignType } from "../domain/types";
import {
  campaignDaily as mockCampaignDaily,
  campaignMetas as mockCampaignMetas,
  type CampaignDaily,
} from "./mock";
import { buildRealCampaignDaily } from "./real/build";
import { liveCacheStamp, readLiveCache } from "./live-sync";
import { kvGet } from "./kv";

/**
 * Source switch: REAL platform data by default. Data precedence:
 *   1. Postgres live cache (`app_kv` "live-cache") — the serverless-safe live pull,
 *      hydrated per request via hydrateLiveData().
 *   2. Filesystem live cache (local dev, written by the refresh button).
 *   3. Baked snapshot.
 * Set USE_REAL_DATA=false for the isolated mock warehouse.
 */
const USE_REAL = process.env.USE_REAL_DATA !== "false";

let _rows: CampaignDaily[] | null = null;
let _key: string | number | null = null;
let _metas: CampaignMetaLite[] | null = null;

// KV-hydrated live rows — the serverless path (read-only filesystem). Shared across
// requests (the ad data is global, not per-user) and refreshed on a short TTL.
let _kvRows: CampaignDaily[] | null = null;
let _kvLoadedAt = 0;
const KV_TTL_MS = 5 * 60 * 1000;

/**
 * Load the live campaign cache from Postgres. Call (await) before reading campaignDaily
 * on a request path so serverless renders reflect the latest pull. No-op off the TTL.
 */
export async function hydrateLiveData(): Promise<void> {
  if (!USE_REAL) return;
  if (_kvRows && Date.now() - _kvLoadedAt < KV_TTL_MS) return;
  try {
    const cache = await kvGet<{ rows: CampaignDaily[] } | null>("live-cache", null);
    if (cache?.rows?.length) {
      _kvRows = cache.rows;
      _kvLoadedAt = Date.now();
      _metas = null; // invalidate derived campaign list
    }
  } catch {
    // keep whatever we already had (snapshot or prior KV load)
  }
}

export function campaignDaily(): CampaignDaily[] {
  if (!USE_REAL) return mockCampaignDaily();
  if (_kvRows && _kvRows.length) return _kvRows; // Postgres live cache (serverless)
  const stamp = liveCacheStamp();
  const key = stamp ?? "static";
  if (_key !== key) {
    _rows = stamp ? (readLiveCache()?.rows ?? buildRealCampaignDaily()) : buildRealCampaignDaily();
    _key = key;
    _metas = null; // invalidate derived campaign list
  }
  return _rows!;
}

export interface CampaignMetaLite {
  id: string;
  name: string;
  type: CampaignType;
  account: AdAccount;
  status: "enabled" | "paused";
}

export function campaignMetas(): CampaignMetaLite[] {
  if (!USE_REAL) {
    return mockCampaignMetas().map((c) => ({
      id: c.id, name: c.name, type: c.type, account: c.account, status: c.status,
    }));
  }
  const rows = campaignDaily(); // ensures _key/_metas are current
  if (_metas) return _metas;
  const seen = new Map<string, CampaignMetaLite>();
  for (const r of rows) {
    if (seen.has(r.campaignId)) continue;
    const account = ACCOUNT_BY_ID[r.accountId];
    if (!account) continue;
    seen.set(r.campaignId, {
      id: r.campaignId,
      name: r.campaignName,
      type: r.campaignType,
      account,
      status: "enabled",
    });
  }
  _metas = Array.from(seen.values());
  return _metas;
}
