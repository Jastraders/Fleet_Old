import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute('/dashboard/admin/reports/')({
  component: () => <div className="p-6"><h1 className="text-2xl font-semibold">Reports</h1><p className="text-muted-foreground">Reports section for admins.</p></div>,
});
