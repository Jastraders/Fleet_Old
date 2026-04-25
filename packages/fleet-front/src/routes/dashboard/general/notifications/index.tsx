import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BellIcon, RefreshCcwIcon, EyeIcon, TrashIcon, CheckIcon, XIcon } from "lucide-react";
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

  const deleteNotification = useMutation({
    ...orpc.general.notifications.delete.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const reviewNotification = useMutation({
    ...orpc.general.notifications.review.mutationOptions(),
  });
  const resolveAccessRequest = useMutation({
    ...orpc.general.access.resolve.mutationOptions(),
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
                {item.type === "access_request" ? (
                  <p className="text-sm text-muted-foreground mt-1">{item.message}</p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    {meta.renewalType ?? "Renewal"} renewal for {meta.vehicleName ?? "Vehicle"} is due in {meta.daysRemaining ?? "-"} day(s). Renewal date: {meta.renewalDate ?? "-"}.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.type !== "access_request" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate({
                            to: "/dashboard/accountant/journal-entries/new",
                            search: {
                              sourceNotificationId: item.id,
                              prefillVehicleId: meta.vehicleId ?? "",
                              prefillExpenseCategoryId: meta.expenseCategoryId ?? "",
                              prefillTransactionDate: new Date().toISOString().slice(0, 10),
                              prefillNextRenewalDate: meta.renewalDate ?? "",
                              prefillNotes: `${meta.renewalType ?? "Renewal"} renewal for ${meta.vehicleName ?? "Vehicle"}`,
                            } as never,
                          })
                        }
                      ><RefreshCcwIcon className="h-4 w-4" />Renew</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          reviewNotification.mutate({ id: item.id } as never, {
                            onSuccess: (result: any) => {
                              navigate({ to: "/dashboard/accountant/expenses", search: { search: result?.search ?? undefined } as never });
                            },
                          });
                        }}
                      ><EyeIcon className="h-4 w-4" />Review</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => navigate({ to: (meta.pageName === "Drivers" ? "/dashboard/accountant/drivers" : meta.pageName === "Vehicles" ? "/dashboard/accountant/vehicles" : meta.pageName === "Expense Categories" ? "/dashboard/accountant/expense-categories" : meta.pageName === "Journal Entries" ? "/dashboard/accountant/journal-entries" : "/dashboard/accountant/expenses"), search: { search: meta.primaryLabel ?? undefined } as never })}><EyeIcon className="h-4 w-4" />Review</Button>
                      <Button size="sm" onClick={() => resolveAccessRequest.mutate({ notificationId: item.id, decision: "allow" } as never)}><CheckIcon className="h-4 w-4" />Allow Access</Button>
                      <Button size="sm" variant="destructive" onClick={() => resolveAccessRequest.mutate({ notificationId: item.id, decision: "deny" } as never)}><XIcon className="h-4 w-4" />Deny Access</Button>
                    </>
                  )}
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
