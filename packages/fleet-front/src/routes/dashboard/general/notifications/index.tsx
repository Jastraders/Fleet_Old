import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BellIcon, CheckIcon, EyeIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { orpc } from "@/orpc";

export const Route = createFileRoute('/dashboard/general/notifications/')({
  component: RouteComponent,
});

function RouteComponent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(orpc.general.notifications.list.queryOptions({ input: { filter: 'all' } }));

  const markRead = useMutation({
    ...orpc.general.notifications.markRead.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const deleteNotification = useMutation({
    ...orpc.general.notifications.delete.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <div className="p-4 md:p-6">
      <Card className="shadow-lg border-0 bg-gradient-to-b from-white to-slate-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellIcon className="h-5 w-5" />Notifications Inbox</CardTitle>
          <CardDescription>Latest renewal and access notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.length === 0 ? <p className="text-sm text-muted-foreground">No notifications available.</p> : data.map((item: any) => {
            const meta = (() => { try { return item.metadata ? JSON.parse(item.metadata) : {}; } catch { return {}; } })();
            return (
              <div key={item.id} className="rounded-xl border bg-white p-4 shadow-sm">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  "{meta.renewalType ?? 'Renewal'}" renewal of "{meta.vehicleName ?? 'Vehicle'}" is within "{meta.daysRemaining ?? '-'}" days. Renewal date is on "{meta.renewalDate ?? '-'}", last renewed date is "{meta.lastRenewedDate ?? '-'}".
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => markRead.mutate({ id: item.id } as never)}><CheckIcon className="h-4 w-4" />Mark as read</Button>
                  <Button size="sm" variant="outline" onClick={() => navigate({ to: '/dashboard/accountant/expenses', search: { search: meta.renewalType ?? undefined } as never })}><EyeIcon className="h-4 w-4" />Review</Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteNotification.mutate({ id: item.id } as never)}><TrashIcon className="h-4 w-4" />Delete</Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
