import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PageContainer } from "@/components/scriba/ui/PageContainer";
import { LtiSetupSection } from "@/components/default/account/LtiSetupSection";
import { AiProviderSettingsSection } from "@/components/default/account/AiProviderSettingsSection";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  return (
    <PageContainer className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      <h1 className="text-2xl font-bold">Account Settings</h1>

      {/* Profile */}
      <div className="rounded-lg border p-6 space-y-3">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Name: </span>
            <span>{session.user.name ?? "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Email: </span>
            <span>{session.user.email}</span>
          </div>
        </div>
      </div>

      {/* LTI Setup */}
      <LtiSetupSection />

      {/* AI Settings */}
      <AiProviderSettingsSection />
    </PageContainer>
  );
}
