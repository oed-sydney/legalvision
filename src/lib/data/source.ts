import { ACCOUNT_BY_ID } from "../domain/accounts";
import type { AdAccount, CampaignType } from "../domain/types";
import {
  campaignDaily as mockCampaignDaily,
  campaignMetas as mockCampaignMetas,
  type CampaignDaily,
} from "./mock";
import { buildRealCampaignDaily } from "./real/build";
import { liveCacheStamp, readLiveCache } from "./live-sync";

/**
 * Source switch: REAL platform data by default. Prefers the LIVE Windsor cache (written
 * by the refresh button) so the whole app reflects the latest pull; falls back to the
 * baked snapshot. Set USE_REAL_DATA=false for the isolated mock warehouse.
 */
const USE_REAL = process.env.USE_REAL_DATA !== "false";

let _rows: CampaignDaily[] | null = null;
let _key: string | number | null = null;
let _metas: CampaignMetaLite[] | null = null;

export function campaignDaily(): CampaignDaily[] {
  if (!USE_REAL) return mockCampaignDaily();
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
