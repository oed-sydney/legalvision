import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle } from "@/components/ui/Card";
import { getSessionProfile } from "@/lib/auth/session";
import { ChangePasswordForm } from "@/components/shell/ChangePasswordForm";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  internal: "Team",
  client: "Client",
  viewer: "Viewer",
};

export default async function AccountPage() {
  const me = await getSessionProfile();

  return (
    <div>
      <PageHeader title="Account" subtitle="Your profile and sign-in details" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Profile</CardTitle>
          <dl className="space-y-2 text-[13px]">
            <Row k="Name" v={me?.name ?? "—"} />
            <Row k="Email" v={me?.email ?? "—"} />
            <Row k="Role" v={me ? ROLE_LABEL[me.role] ?? me.role : "—"} />
            <Row k="Markets" v={me?.markets && me.markets.length ? me.markets.join(", ") : "All"} />
          </dl>
        </Card>
        <Card>
          <CardTitle>Change password</CardTitle>
          <ChangePasswordForm />
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--lv-border)] pb-2 last:border-0">
      <dt className="text-secondary">{k}</dt>
      <dd className="font-medium text-ink">{v}</dd>
    </div>
  );
}

export const dynamic = "force-dynamic";
