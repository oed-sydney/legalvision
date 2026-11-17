"use client";

import { useState } from "react";
import { updateUserRole } from "@/app/(dashboard)/admin/actions";
import { StatusPill } from "@/components/ui/StatusPill";

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "internal" | "client" | "viewer";
  status: string;
  leadRecordAccess: boolean;
  lastLoginAt: string | null;
  markets: string[];
};

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "internal", label: "Team" },
  { value: "client", label: "Client" },
  { value: "viewer", label: "Viewer" },
] as const;

const ROLE_TONE = { admin: "info", internal: "success", client: "purple", viewer: "grey" } as const;

const HEAD = ["Name", "Email", "Role", "Scope", "Lead records", "Status", "Last login"];

/**
 * Users & roles table with an inline, admin-only role editor. Changing the role calls the
 * server action (which re-validates admin + guards the last admin); the cell updates
 * optimistically and rolls back on error.
 */
export function UsersRolesTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [rows, setRows] = useState<UserRow[]>(users);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [note, setNote] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  async function change(id: string, nextRole: UserRow["role"]) {
    const original = rows.find((r) => r.id === id);
    if (!original || original.role === nextRole) return;

    setSavingId(id);
    setNote(null);
    // Optimistic: reflect the new role (and its market/lead implications) immediately.
    const promoted = nextRole === "admin" || nextRole === "internal";
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? { ...r, role: nextRole, leadRecordAccess: promoted, markets: promoted ? [] : r.markets }
          : r
      )
    );

    const res = await updateUserRole({ userId: id, role: nextRole });
    setSavingId(null);

    if (!res.ok) {
      setRows((rs) => rs.map((r) => (r.id === id ? original : r))); // roll back to the pre-change row
      setNote({ id, text: res.error, ok: false });
      return;
    }
    setNote({ id, text: "Role updated", ok: true });
    setTimeout(() => setNote((n) => (n?.id === id ? null : n)), 2500);
  }

  return (
    <div className="overflow-x-auto lv-scroll">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--lv-border)] text-[11px] uppercase tracking-wide text-secondary">
            {HEAD.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const busy = savingId === u.id;
            const isSelf = u.id === currentUserId;
            return (
              <tr key={u.id} className="border-b border-[var(--lv-border)] last:border-0 align-middle">
                <td className="px-3 py-2.5 pl-0 font-medium text-ink">
                  {u.name ?? "—"}
                  {isSelf && <span className="ml-1.5 text-[11px] font-normal text-muted">(you)</span>}
                </td>
                <td className="px-3 py-2.5 text-secondary">{u.email}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <StatusPill tone={ROLE_TONE[u.role]} dot={false}>
                      {u.role}
                    </StatusPill>
                    <select
                      aria-label={`Change role for ${u.email}`}
                      value={u.role}
                      disabled={busy}
                      onChange={(e) => change(u.id, e.target.value as UserRow["role"])}
                      className="rounded-md border border-[var(--lv-border)] bg-white px-2 py-1 text-[12px] text-ink disabled:opacity-60"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    {busy && <span className="text-[11px] text-muted">Saving…</span>}
                    {!busy && note?.id === u.id && (
                      <span
                        className={`text-[11px] ${note.ok ? "text-[var(--lv-success)]" : "text-[var(--lv-danger)]"}`}
                      >
                        {note.text}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-secondary">{u.markets.length ? u.markets.join(", ") : "All"}</td>
                <td className="px-3 py-2.5 text-secondary">{u.leadRecordAccess ? "Yes" : "No"}</td>
                <td className="px-3 py-2.5 text-secondary">
                  <StatusPill
                    tone={u.status === "active" ? "success" : u.status === "invited" ? "warning" : "grey"}
                    dot={false}
                  >
                    {u.status}
                  </StatusPill>
                </td>
                <td className="px-3 py-2.5 text-secondary">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().slice(0, 10) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-muted">
        Promoting to Admin or Team grants all markets and lead-record access; demoting to Client or Viewer
        removes them. The last active admin can&apos;t be demoted.
      </p>
    </div>
  );
}
