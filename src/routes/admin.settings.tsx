import { createFileRoute } from "@tanstack/react-router";
import { DraftForm } from "@/components/admin/DraftForm";
import { adminHead } from "@/components/admin/adminUser";
import { settingsGroups } from "@/lib/global-settings";

export const Route = createFileRoute("/admin/settings")({
  head: () => adminHead("Global settings"),
  component: Settings,
});

/**
 * Global settings (spec: Core scope → Global settings): one tab per group, the platform's
 * (general, logo & icon, announcement, footer, search & sharing) then the site's own.
 */
function Settings() {
  return (
    <DraftForm
      contentKey="settings"
      title="Global settings"
      summary="Used across the whole site. Changes go live when you publish."
      tabs
      sections={settingsGroups()}
    />
  );
}
