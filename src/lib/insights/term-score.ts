import "server-only";
import type { Keyword, SearchTerm } from "../domain/types";

/**
 * Composite waste score (0–100) for search terms and keywords, built for
 * lead-gen accounts. Three signals, weighted:
 *
 *  1. Wasted spend (55%): spend with zero leads, scaled by how confident we
 *     are the term SHOULD have converted — 1 − e^(−expected leads), where
 *     expected leads = clicks × the account's lead rate (Poisson: the chance
 *     we'd have seen at least one lead by now if the term were normal).
 *  2. Cost per lead (30%): how far the term's CPL sits above the account CPL.
 *  3. Relevance (15%): CTR shortfall vs the account average (min 50 impr.).
 *
 * Terms that produced a live lead are protected (score × 0.25). Keywords add
 * a Quality Score penalty. Verdicts require material spend so we never
 * recommend pausing on noise.
 */

export interface Baseline {
  clicks: number;
  impressions: number;
  spend: number;
  leads: number;
  leadRate: number; // leads / click
  cpl: number | null;
  ctr: number | null;
}

export interface ScoredRow {
  score: number; // 0-100
  verdict: "PAUSE" | "REVIEW" | "KEEP";
  reason: string;
  expectedLeads: number;
  /** the lead count the score judged on (live leads where tracked) */
  leads: number;
}

const money = (v: number, cur: string) =>
  `${cur === "GBP" ? "£" : cur === "NZD" ? "NZ$" : "A$"}${Math.round(v).toLocaleString("en-AU")}`;

/** leads = live leads where the account tracks them, else platform conversions */
function leadsOf(r: { liveLeads: number; conversions: number }, useLL: boolean): number {
  return useLL ? r.liveLeads : r.conversions;
}

export function baselines<T extends { accountId: string; clicks: number; impressions: number; spend: number; conversions: number; liveLeads: number }>(
  rows: T[]
): Map<string, Baseline & { useLL: boolean }> {
  const out = new Map<string, Baseline & { useLL: boolean }>();
  const byAcct = new Map<string, T[]>();
  for (const r of rows) {
    const list = byAcct.get(r.accountId) ?? [];
    list.push(r);
    byAcct.set(r.accountId, list);
  }
  for (const [acct, list] of byAcct) {
    const totalLL = list.reduce((s, r) => s + r.liveLeads, 0);
    const useLL = totalLL > 0;
    const clicks = list.reduce((s, r) => s + r.clicks, 0);
    const impressions = list.reduce((s, r) => s + r.impressions, 0);
    const spend = list.reduce((s, r) => s + r.spend, 0);
    const leads = list.reduce((s, r) => s + leadsOf(r, useLL), 0);
    out.set(acct, {
      clicks,
      impressions,
      spend,
      leads,
      leadRate: clicks > 0 ? leads / clicks : 0,
      cpl: leads > 0 ? spend / leads : null,
      ctr: impressions > 0 ? clicks / impressions : null,
      useLL,
    });
  }
  return out;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Core service-intent queries (someone looking for a lawyer). These are the
 * client's bread and butter — they are only ever flagged under a much
 * stricter evidence bar, and never auto-recommended for blocking lightly.
 */
export const COMMERCIAL_RE =
  /(lawyers?|solicitors?|attorneys?|barristers?|law firms?|legal (advice|help|services?|team|counsel)|conveyanc\w*)/i;

export function isCommercial(term: string): boolean {
  return COMMERCIAL_RE.test(term);
}

/** Strict bar for acting on a commercial term: ~95% confidence or 2 leads' worth of spend. */
export function meetsCommercialBar(t: { expectedLeads: number; spend: number }, cpl: number | null): boolean {
  return t.expectedLeads >= 3 || (cpl != null && t.spend >= 2 * cpl);
}

export function scoreRow(
  r: { accountId: string; clicks: number; impressions: number; spend: number; conversions: number; liveLeads: number; currency: string },
  base: Baseline & { useLL: boolean },
  qualityScore: number | null = null
): ScoredRow {
  const leads = leadsOf(r, base.useLL);
  const cpl = base.cpl ?? 0;
  const expectedLeads = r.clicks * base.leadRate;

  // 1. wasted spend
  let waste = 0;
  if (leads === 0 && cpl > 0) {
    const confidence = 1 - Math.exp(-expectedLeads);
    waste = confidence * clamp01(r.spend / (3 * cpl));
  }
  // 2. cost per lead vs account
  let cplComp = 0;
  if (leads > 0 && cpl > 0) {
    const ratio = r.spend / leads / cpl;
    cplComp = clamp01((ratio - 1) / 3);
  }
  // 3. relevance (CTR shortfall)
  let ctrComp = 0;
  if (r.impressions >= 50 && base.ctr && base.ctr > 0) {
    const termCtr = r.clicks / r.impressions;
    ctrComp = clamp01((base.ctr - termCtr) / base.ctr);
  }

  let score = 100 * (0.55 * waste + 0.3 * cplComp + 0.15 * ctrComp);
  // keywords: low QS amplifies, good QS dampens
  if (qualityScore != null) {
    if (qualityScore <= 4) score = Math.min(100, score * 1.2 + 8);
    else if (qualityScore >= 8) score *= 0.85;
  }
  // anything that produced a live lead is protected
  if (base.useLL && r.liveLeads > 0) score *= 0.25;
  score = Math.round(score);

  const leadWord = base.useLL ? "live lead" : "lead";
  const parts: string[] = [];
  if (leads === 0 && r.spend > 0)
    parts.push(
      `${money(r.spend, r.currency)} spend, 0 ${leadWord}s${
        expectedLeads >= 0.5 ? ` where ~${expectedLeads.toFixed(1)} expected at the account's lead rate` : ""
      }`
    );
  if (leads > 0 && cpl > 0 && r.spend / leads > cpl * 1.5)
    parts.push(`cost per ${leadWord} ${(r.spend / leads / cpl).toFixed(1)}× the account average`);
  if (ctrComp > 0.5) parts.push(`CTR well below the account average`);
  if (qualityScore != null && qualityScore <= 4) parts.push(`Quality Score ${qualityScore}`);
  if (parts.length === 0)
    parts.push(leads > 0 ? `${Math.round(leads)} ${leadWord}${leads >= 2 ? "s" : ""} at a healthy cost` : `low spend — not enough data to judge`);

  // verdicts demand material spend so we never act on noise
  const materialSpend = cpl > 0 ? r.spend >= 0.75 * cpl : r.spend >= 100;
  const verdict: ScoredRow["verdict"] =
    score >= 65 && materialSpend ? "PAUSE" : score >= 40 && materialSpend ? "REVIEW" : "KEEP";

  return { score, verdict, reason: parts.join("; "), expectedLeads, leads };
}

export interface ScoredTerm extends SearchTerm, ScoredRow {}
export interface ScoredKeyword extends Keyword, ScoredRow {}

export function scoreSearchTerms(terms: SearchTerm[]): { scored: ScoredTerm[]; base: Map<string, Baseline & { useLL: boolean }> } {
  const base = baselines(terms);
  const scored = terms
    .filter((t) => t.spend > 0)
    .map((t) => {
      const b = base.get(t.accountId)!;
      const row = { ...t, ...scoreRow(t, b) };
      // commercial queries get one verdict of grace unless the strict bar is met
      if (row.verdict !== "KEEP" && isCommercial(t.term) && !meetsCommercialBar(row, b.cpl)) {
        row.verdict = row.verdict === "PAUSE" ? "REVIEW" : "KEEP";
        if (row.verdict !== "KEEP") row.reason += "; core service query — held to a stricter bar";
      }
      return row;
    })
    .sort((a, b) => b.score - a.score || b.spend - a.spend);
  return { scored, base };
}

export function scoreKeywords(kws: Keyword[]): { scored: ScoredKeyword[]; base: Map<string, Baseline & { useLL: boolean }> } {
  const base = baselines(kws);
  const scored = kws
    .filter((k) => k.spend > 0)
    .map((k) => ({ ...k, ...scoreRow(k, base.get(k.accountId)!, k.qualityScore) }))
    .sort((a, b) => b.score - a.score || b.spend - a.spend);
  return { scored, base };
}
