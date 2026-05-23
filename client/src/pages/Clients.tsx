// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Building2, Plus, MoreVertical, Edit, Trash, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { PageShell } from "@/components/layout/PageShell";
import { useDetailPanel } from "@/components/detail/DetailPanel";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
  status: string;
  industry?: string | null;
  website?: string | null;
  notes?: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  AT_RISK: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  INACTIVE: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

export default function Clients() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { open: openDetail } = useDetailPanel();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteClientId, setInviteClientId] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState({ name: "", email: "" });
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const agencyId = userProfile?.agencyId;

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients", { agencyId }],
    queryFn: async () => {
      const res = await fetch(`/api/clients?agencyId=${agencyId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("wk_token")}` },
      });
      if (!res.ok) throw new Error("Failed to load clients");
      return res.json();
    },
    enabled: !!agencyId,
  });

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    industry: "",
    website: "",
    status: "ACTIVE",
    notes: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/clients", { ...data, agencyId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", { agencyId }] });
      toast({ title: "Client created successfully" });
      setCreateOpen(false);
      setFormData({ name: "", email: "", industry: "", website: "", status: "ACTIVE", notes: "", iconColor: "#6366f1" });
    },
    onError: (err: any) => {
      toast({ title: "Error creating client", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("PUT", `/api/clients/${editingClientId}`, { ...data, agencyId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", { agencyId }] });
      toast({ title: "Client updated successfully" });
      setCreateOpen(false);
      setEditingClientId(null);
      setFormData({ name: "", email: "", industry: "", website: "", status: "ACTIVE", notes: "", iconColor: "#6366f1" });
    },
    onError: (err: any) => {
      toast({ title: "Error updating client", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (clientId: string) => {
      await apiRequest("DELETE", `/api/clients/${clientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", { agencyId }] });
      toast({ title: "Client deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error deleting client", description: err.message, variant: "destructive" });
    },
  });

  
  const inviteMutation = useMutation({
    mutationFn: async (data: { clientId: string; name: string; email: string }) => {
      const res = await apiRequest("POST", `/api/clients/${data.clientId}/invite`, {
        name: data.name,
        email: data.email
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Invitation sent!", description: `An invitation has been sent to ${data.portalUser.email}` });
      setInviteOpen(false);
      setInviteClientId(null);
      setInviteData({ name: "", email: "" });
    },
    onError: (err: any) => {
      toast({ title: "Error sending invitation", description: err.message, variant: "destructive" });
    },
  });

  const handleCreateSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (editingClientId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  
  const handleInviteSubmit = () => {
    if (!inviteClientId) return;
    if (!inviteData.name.trim() || !inviteData.email.trim()) {
      toast({ title: "Name and Email are required", variant: "destructive" });
      return;
    }
    inviteMutation.mutate({ clientId: inviteClientId, ...inviteData });
  };

  const handleEditClick = (client: Client) => {
    setFormData({
      name: client.name,
      email: "", // Not strictly fetched in list, but schema allows it
      industry: client.industry || "",
      website: client.website || "",
      status: client.status,
      notes: client.notes || "",
      iconColor: client.iconColor || "#6366f1",
    });
    setEditingClientId(client.id);
    setCreateOpen(true);
  };

  const handleCloseModal = () => {
    setCreateOpen(false);
    setEditingClientId(null);
    setFormData({ name: "", email: "", industry: "", website: "", status: "ACTIVE", notes: "", iconColor: "#6366f1" });
  };

  const filteredClients = clients.filter((c) =>
    search ? c.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <PageShell
      breadcrumbs={[{ label: "Workspace" }, { label: "Clients" }]}
      title={
        <span className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-500" />
          Clients
        </span>
      }
      description={`${clients.length} total clients`}
      primaryAction={
        <Button
          onClick={() => {
            setEditingClientId(null);
            setFormData({ name: "", email: "", industry: "", website: "", status: "ACTIVE", notes: "", iconColor: "#6366f1" });
            setCreateOpen(true);
          }}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      }
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Search */}
        <div className="flex gap-3 items-center">
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm bg-white/70 dark:bg-slate-800/70"
          />
        </div>

        {/* Clients Table */}
        <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-white/20">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center">
                <Users className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">No clients found</h3>
                <p className="text-slate-500 mb-4 max-w-sm">Get started by adding your first client to manage their projects and tasks.</p>
                <Button variant="outline" onClick={() => {
                  setEditingClientId(null);
                  setFormData({ name: "", email: "", industry: "", website: "", status: "ACTIVE", notes: "", iconColor: "#6366f1" });
                  setCreateOpen(true);
                }}>Add your first client</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openDetail("client", client.id)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: client.iconColor || "#64748b" }} />
                          {client.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500">{client.industry || "—"}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          STATUS_COLORS[client.status] ?? "bg-gray-100 text-gray-700"
                        )}>
                          {client.status.replace("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500" onClick={(e) => e.stopPropagation()}>
                        {client.website ? (
                          <a href={client.website} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">
                            {client.website.replace(/^https?:\/\//, "")}
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                  setInviteClientId(client.id);
                                  setInviteData({ name: client.name, email: "" });
                                  setInviteOpen(true);
                                }}>
                                  <User className="h-4 w-4 mr-2" />
                                  Invite to Portal
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditClick(client)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600 dark:text-red-400" onClick={() => {
                                if(confirm('Are you sure you want to delete this client?')) deleteMutation.mutate(client.id);
                              }}>
                                <Trash className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Client Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClientId ? "Edit Client" : "Add New Client"}</DialogTitle>
            <DialogDescription>
              {editingClientId ? "Update the client details below." : "Enter the client details to start tracking their projects."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input
                placeholder="e.g. Acme Corp"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label>Label Color</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
                  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef",
                  "#f43f5e", "#64748b"
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, iconColor: color })}
                    className={`w-8 h-8 rounded-full border-2 ${formData.iconColor === color ? 'border-foreground shadow-sm scale-110' : 'border-transparent hover:scale-105'} transition-all`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            
            <div className="space-y-2">
              <Label>Client Email</Label>
              <Input
                type="email"
                placeholder="client@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={createMutation.isPending || updateMutation.isPending}
              />
              <p className="text-[11px] text-muted-foreground">
                An invitation to their client portal will be sent to this email automatically.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input
                  placeholder="e.g. Technology"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="AT_RISK">At Risk</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                type="url"
                placeholder="https://example.com"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Additional info..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>Cancel</Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingClientId ? "Save Changes" : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    
      {/* Invite Client Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => !open && setInviteOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Client to Portal</DialogTitle>
            <DialogDescription>
              Send an invitation to this client to access their dedicated portal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input
                placeholder="e.g. John Doe"
                value={inviteData.name}
                onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                disabled={inviteMutation.isPending}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                disabled={inviteMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInviteSubmit} disabled={inviteMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
              {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageShell>
  );
}
