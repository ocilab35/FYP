"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, DashboardCard, DashboardCardBody } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, User, getErrorMessage } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);

  const load = () => api.get("/admin/users").then((res) => setUsers(res.data.data?.items || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const toggle = async (id: string) => {
    try {
      await api.patch(`/admin/users/${id}/toggle-active`);
      toast.success("User status updated");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader role="admin" title="User Management" description="Manage all platform users and access status." />

      <DashboardCard padding="none" variant="elevated" className="overflow-hidden">
        <DashboardCardBody className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.first_name} {u.last_name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{u.role}</Badge></TableCell>
                  <TableCell><Badge variant={u.is_active ? "default" : "destructive"}>{u.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell>
                    {u.role !== "admin" && (
                      <Button size="sm" variant="outline" onClick={() => toggle(u.id)}>
                        {u.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DashboardCardBody>
      </DashboardCard>
    </div>
  );
}
