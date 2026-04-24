import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute('/dashboard/general/notifications')({
  component: () => <Outlet />,
});
