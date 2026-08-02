import "server-only";
import type { CurrencyCode, SearchTerm } from "../domain/types";
import { isCommercial, meetsCommercialBar, type Baseline, type ScoredTerm } from "./term-score";
import { readLiveCache } from "../data/live-sync";
import { ACCOUNT_BY_ID } from "../domain/accounts";

/**
 * Preemptive negative-keyword engine.
 *
 * 1. Clusters the waste-scored (Pause/Review) search terms into intent themes
 *    via deterministic pattern rules — nothing is classified by guesswork.
 * 2. Emits ready-to-paste negative lists per account (Pause terms as phrase
 *    negatives) with the 30-day spend they would have saved.
 * 3. Proposes ROOT negatives ("free", "template", "jobs"…) only where the
 *    root's ENTIRE query universe in that account — converters included —
 *    produced zero leads on material spend. That's what makes them safe to
 *    add preemptively: they also block unseen future queries with the same word.
 * 4. Quantifies the hidden-terms blind spot: account search spend Google did
 *    not attribute to any reported query.
 */

export interface Theme {
  key: string;
  label: string;
  why: string;
  pattern: RegExp;
}

const GLOBAL_THEMES: Theme[] = [
  {
    key: "free-diy",
    label: "Free / DIY / template seekers",
    why: "Looking for documents, not a lawyer",
    pattern: /\b(free|template|templates|sample|samples|example|examples|diy|download|pdf|form|forms|generator|do it yourself)\b/i,
  },
  {
    key: "jobs",
    label: "Job seekers & careers",
    why: "Employment intent, not client intent",
    pattern: /\b(job|jobs|career|careers|salary|salaries|hiring|vacancy|vacancies|recruit(ment|er)?|internship|graduate program|work experience|clerkship)\b/i,
  },
  {
    key: "study",
    label: "Students & definitions",
    why: "Research / study intent",
    pattern: /\b(what is|meaning|definition|define|course|courses|degree|study|university|uni|law school|exam|how to become|textbook)\b/i,
  },
  {
    key: "free-help",
    label: "Legal aid & pro bono",
    why: "Seeking free legal help",
    pattern: /\b(legal aid|pro bono|free lawyer|free legal|community legal|duty lawyer|government)\b/i,
  },
];

/** Foreign-jurisdiction patterns per market — queries the account can't serve. */
const JURISDICTION: Record<string, RegExp> = {
  AU: /\b(usa|u\.s\.|america|american|canada|canadian|india|indian|singapore|hong kong|england|scotland|ireland)\b/i,
  UK: /\b(australia|australian|sydney|melbourne|brisbane|nz|new zealand|auckland|usa|u\.s\.|america|american|canada|canadian|india|indian)\b/i,
  NZ: /\b(australia|australian|sydney|melbourne|uk|england|london|usa|u\.s\.|america|american|canada|canadian|india|indian)\b/i,
};

export interface ThemedCluster {
  key: string;
  label: string;
  why: string;
  pauseCount: number;
  reviewCount: number;
  spend: number; // 30d spend across pause+review terms in the theme
  examples: string[];
}

export interface AccountNegatives {
  accountId: string;
  accountName: string;
  market: string;
  currency: CurrencyCode;
  clusters: ThemedCluster[];
  /** proposed terms awaiting a human decision, sorted by spend */
  candidates: { term: string; spend: number; reason: string }[];
  rootSuggestions: { root: string; queries: number; spend: number; clicks: number }[];
  hiddenSpend: number | null; // search spend not attributed to any reported term
  hiddenPct: number | null;
  attributedSpend: number;
}

function themeOf(term: string, market: string): Theme | null {
  const j = JURISDICTION[market];
  if (j && j.test(term))
    return {
      key: "jurisdiction",
      label: "Wrong jurisdiction",
      why: `Queries this ${market} account can't serve`,
      pattern: j,
    };
  for (const t of GLOBAL_THEMES) if (t.pattern.test(term)) return t;
  return null;
}

/** Candidate root words for preemptive blocking, checked against the FULL term universe. */
const ROOT_CANDIDATES = [
  "free", "template", "templates", "sample", "diy", "pdf", "download",
  "job", "jobs", "salary", "career", "careers", "internship", "clerkship",
  "course", "degree", "university", "pro bono", "legal aid",
];

export function buildNegatives(
  allTerms: SearchTerm[],
  scored: ScoredTerm[],
  base: Map<string, Baseline & { useLL: boolean }>
): AccountNegatives[] {
  // last-30d Google search spend per account for the hidden-terms stat
  const cache = readLiveCache();
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const searchSpend = new Map<string, number>();
  for (const r of cache?.rows ?? []) {
    if (r.channel !== "google_ads" || r.campaignType !== "Search" || r.date < cutoff) continue;
    searchSpend.set(r.accountId, (searchSpend.get(r.accountId) ?? 0) + r.spend);
  }

  const accounts = [...new Set(allTerms.map((t) => t.accountId))];
  const out: AccountNegatives[] = [];

  for (const accountId of accounts) {
    const acct = ACCOUNT_BY_ID[accountId];
    if (!acct) continue;
    const acctAll = allTerms.filter((t) => t.accountId === accountId);
    const acctScored = scored.filter((t) => t.accountId === accountId);
    const cpl = base.get(accountId)?.cpl ?? null;
    // Negative-worthiness has its own gate: zero leads where at least one was
    // statistically expected (Poisson, from clicks x account lead rate), or
    // meaningful spend relative to a lead's cost. Looser than the pause gate —
    // blocking a query is cheap and reversible.
    const isCandidate = (t: ScoredTerm) => {
      // core service queries only qualify under the strict commercial bar
      if (isCommercial(t.term)) return t.leads === 0 && meetsCommercialBar(t, cpl);
      return (
        t.verdict !== "KEEP" ||
        (t.leads === 0 && (t.expectedLeads >= 1 || (cpl != null && t.spend >= 0.5 * cpl)))
      );
    };
    const isStrong = (t: ScoredTerm) => {
      if (isCommercial(t.term))
        return t.leads === 0 && (t.expectedLeads >= 4 || (cpl != null && t.spend >= 3 * cpl));
      return (
        t.verdict === "PAUSE" ||
        (t.leads === 0 && (t.expectedLeads >= 1.3 || (cpl != null && t.spend >= 0.75 * cpl)))
      );
    };
    const candidates = acctScored.filter(isCandidate);
    if (candidates.length === 0 && acctAll.length === 0) continue;

    // ---- themes over pause/review terms ----
    const clusterMap = new Map<string, ThemedCluster>();
    for (const t of candidates) {
      const theme = themeOf(t.term, acct.market) ?? {
        key: "other",
        label: "Other confirmed low performers",
        why: "No lead on material spend at the account's lead rate",
        pattern: /$^/,
      };
      const c =
        clusterMap.get(theme.key) ??
        { key: theme.key, label: theme.label, why: theme.why, pauseCount: 0, reviewCount: 0, spend: 0, examples: [] };
      if (isStrong(t)) c.pauseCount++;
      else c.reviewCount++;
      c.spend += t.spend;
      if (c.examples.length < 3) c.examples.push(t.term);
      clusterMap.set(theme.key, c);
    }

    // ---- candidate rows for the approval workflow ----
    const seen = new Set<string>();
    const candidateRows: { term: string; spend: number; reason: string }[] = [];
    for (const t of [...candidates].sort((a, b) => b.spend - a.spend)) {
      const key = t.term.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      candidateRows.push({ term: t.term, spend: t.spend, reason: t.reason });
    }

    // ---- preemptive root negatives: safe only if the root's whole universe
    //      (every reported query containing it, converters included) has zero leads ----
    const roots: AccountNegatives["rootSuggestions"] = [];
    const acctUsesLL = acctAll.some((t) => t.liveLeads > 0);
    for (const root of ROOT_CANDIDATES) {
      const re = new RegExp(`\\b${root.replace(/ /g, "\\s+")}\\b`, "i");
      const matches = acctAll.filter((t) => re.test(t.term));
      if (matches.length < 3) continue;
      const spend = matches.reduce((s, t) => s + t.spend, 0);
      const clicks = matches.reduce((s, t) => s + t.clicks, 0);
      const leads = matches.reduce((s, t) => s + (acctUsesLL ? t.liveLeads : t.conversions), 0);
      if (leads > 0) continue; // a single converter disqualifies the root
      if (spend < 50) continue; // not material
      roots.push({ root, queries: matches.length, spend, clicks });
    }
    roots.sort((a, b) => b.spend - a.spend);

    // ---- hidden search-term spend ----
    const attributedSpend = acctAll.reduce((s, t) => s + t.spend, 0);
    const total = searchSpend.get(accountId) ?? null;
    const hiddenSpend = total != null ? Math.max(total - attributedSpend, 0) : null;

    out.push({
      accountId,
      accountName: acct.name,
      market: acct.market,
      currency: acct.currency as CurrencyCode,
      clusters: [...clusterMap.values()].sort((a, b) => b.spend - a.spend),
      candidates: candidateRows,
      rootSuggestions: roots.slice(0, 8),
      hiddenSpend,
      hiddenPct: total ? (hiddenSpend ?? 0) / total : null,
      attributedSpend,
    });
  }

  return out.sort(
    (a, b) => b.candidates.reduce((s, c) => s + c.spend, 0) - a.candidates.reduce((s, c) => s + c.spend, 0)
  );
}
