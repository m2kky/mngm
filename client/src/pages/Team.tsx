import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, UserPlus, MoreVertical, Shield, UserX, UserCheck,
  Copy, Check, Mail, ChevronDown, Search, Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { PageShell } from "@/components/layout/PageShell";
import { useDetailPanel } from "@/components/detail/DetailPanel";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  image: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  inviteLink?: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  TEAM_LEADER: "Team Leader",
  SUPERVISOR: "Supervisor",
  EMPLOYEE: "Employee",
  HR: "HR",
  PROJECT_MANAGER: "Project Manager",
  TEAM_MEMBER: "Team Member",
  CLIENT: "Client",
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  ADMIN: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  TEAM_LEADER: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  SUPERVISOR: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  EMPLOYEE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  HR: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
  PROJECT_MANAGER: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
  TEAM_MEMBER: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  CLIENT: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  DEACTIVATED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  INVITED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

function getInitials(name: string | null, email: string) {
  if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return email.slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function Team() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [inviteOpen, setInviteOpen] = useState(false);
  const { open: openDetail } = useDetailPanel();

  // QuickCreate / palette deep-link: /team#invite opens the invite dialog.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#invite") return;
    setInviteOpen(true);
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("TEAM_MEMBER");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const agencyId = userProfile?.agencyId;
  const isAdmin = userProfile?.role === "OWNER" || userProfile?.role === "ADMIN";

  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["/api/agencies", agencyId, "users"],
    queryFn: async () => {
      const res = await fetch(`/api/agencies/${agencyId}/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("wk_token")}` },
      });
      if (!res.ok) throw new Error("Failed to load members");
      return res.json();
    },
    enabled: !!agencyId,
  });

  const { data: invitations = [], isLoading: invLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/agencies", agencyId, "invitations"],
    queryFn: async () => {
      const res = await fetch(`/api/agencies/${agencyId}/invitations`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("wk_token")}` },
      });
      if (!res.ok) throw new Error("Failed to load invitations");
      return res.json();
    },
    enabled: !!agencyId && isAdmin,
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const res = await apiRequest("POST", `/api/agencies/${agencyId}/members/invite`, { email, role });
      return res.json();
    },
    onSuccess: (data) => {
      setInviteLink(data.inviteLink);
      queryClient.invalidateQueries({ queryKey: ["/api/agencies", agencyId, "invitations"] });
      toast({ title: "Invitation created", description: `Invite link generated for ${inviteEmail}` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/agencies/${agencyId}/members/${userId}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies", agencyId, "users"] });
      toast({ title: "Role updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("PATCH", `/api/agencies/${agencyId}/members/${userId}/deactivate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies", agencyId, "users"] });
      toast({ title: "Member deactivated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("PATCH", `/api/agencies/${agencyId}/members/${userId}/reactivate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies", agencyId, "users"] });
      toast({ title: "Member reactivated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await apiRequest("PATCH", `/api/agencies/${agencyId}/invitations/${invitationId}/revoke`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies", agencyId, "invitations"] });
      toast({ title: "Invitation revoked" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleInviteSubmit = () => {
    if (!inviteEmail.trim()) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseInvite = () => {
    setInviteOpen(false);
    setInviteEmail("");
    setInviteRole("TEAM_MEMBER");
    setInviteLink(null);
    setCopied(false);
  };

  const filteredMembers = members.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      m.email.toLowerCase().includes(q) ||
      (m.name ?? "").toLowerCase().includes(q) ||
      ROLE_LABELS[m.role]?.toLowerCase().includes(q);
    const matchesRole = roleFilter === "ALL" || m.role === roleFilter;
    const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const pendingInvites = invitations.filter((i) => i.status === "PENDING");

  return (
    <PageShell
      breadcrumbs={[{ label: "Insights" }, { label: "Team" }]}
      title={
        <span className="flex items-center gap-2">
          <Users className="h-6 w-6 text-indigo-500" />
          Team Members
        </span>
      }
      description={`${members.length} member${members.length !== 1 ? "s" : ""} in this workspace`}
      primaryAction={
        isAdmin && (
          <Button
            onClick={() => setInviteOpen(true)}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
            data-testid="button-invite-member"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )
      }
    >
      <div className="max-w-6xl mx-auto space-y-6">
            {/* Search + filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search members..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-white/70 dark:bg-slate-800/70"
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-44 bg-white/70 dark:bg-slate-800/70">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All roles</SelectItem>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="TEAM_LEADER">Team Leader</SelectItem>
                  <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="PROJECT_MANAGER">Project Manager</SelectItem>
                  <SelectItem value="TEAM_MEMBER">Team Member</SelectItem>
                  <SelectItem value="CLIENT">Client</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 bg-white/70 dark:bg-slate-800/70">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
                </SelectContent>
              </Select>

              {(roleFilter !== "ALL" || statusFilter !== "ALL" || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSearch(""); setRoleFilter("ALL"); setStatusFilter("ALL"); }}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Clear filters
                </Button>
              )}
            </div>

            {/* Members table */}
            <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-white/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Members</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {membersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full" />
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    No members found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        {isAdmin && <TableHead className="w-12" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => (
                        <TableRow key={member.id} className={cn(member.status === "DEACTIVATED" && "opacity-60")}>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => openDetail("member", member.id)}
                              data-testid={`member-row-${member.id}`}
                              className="flex items-center gap-3 text-left rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={member.image ?? undefined} />
                                <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs">
                                  {getInitials(member.name, member.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm text-gray-900 dark:text-white">
                                  {member.name ?? "(No name)"}
                                  {member.id === userProfile?.id && (
                                    <span className="ml-2 text-xs text-gray-400">(you)</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                              </div>
                            </button>
                          </TableCell>
                          <TableCell>
                            {isAdmin && member.role !== "OWNER" && member.id !== userProfile?.id ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className={cn(
                                    "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
                                    ROLE_COLORS[member.role] ?? "bg-gray-100 text-gray-700"
                                  )}>
                                    {member.role === "OWNER" && <Crown className="h-3 w-3" />}
                                    {ROLE_LABELS[member.role] ?? member.role}
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  {["ADMIN", "TEAM_LEADER", "SUPERVISOR", "EMPLOYEE", "HR", "PROJECT_MANAGER", "TEAM_MEMBER", "CLIENT"].map((r) => (
                                    <DropdownMenuItem
                                      key={r}
                                      onClick={() => roleMutation.mutate({ userId: member.id, role: r })}
                                      className={cn(member.role === r && "font-semibold")}
                                    >
                                      {ROLE_LABELS[r]}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className={cn(
                                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                                ROLE_COLORS[member.role] ?? "bg-gray-100 text-gray-700"
                              )}>
                                {member.role === "OWNER" && <Crown className="h-3 w-3" />}
                                {ROLE_LABELS[member.role] ?? member.role}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "px-2 py-1 rounded-full text-xs font-medium",
                              STATUS_COLORS[member.status] ?? "bg-gray-100 text-gray-700"
                            )}>
                              {member.status.charAt(0) + member.status.slice(1).toLowerCase()}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                            {member.createdAt ? formatDate(member.createdAt) : "—"}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              {member.role !== "OWNER" && member.id !== userProfile?.id && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {member.status === "ACTIVE" ? (
                                      <DropdownMenuItem
                                        onClick={() => deactivateMutation.mutate(member.id)}
                                        className="text-red-600 dark:text-red-400"
                                      >
                                        <UserX className="h-4 w-4 mr-2" />
                                        Deactivate
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() => reactivateMutation.mutate(member.id)}
                                        className="text-green-600 dark:text-green-400"
                                      >
                                        <UserCheck className="h-4 w-4 mr-2" />
                                        Reactivate
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Pending Invitations (admin only) */}
            {isAdmin && pendingInvites.length > 0 && (
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-white/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4 text-indigo-500" />
                    Pending Invitations
                    <Badge variant="secondary" className="ml-1">{pendingInvites.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInvites.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="text-sm">{inv.email}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "px-2 py-1 rounded-full text-xs font-medium",
                              ROLE_COLORS[inv.role] ?? "bg-gray-100 text-gray-700"
                            )}>
                              {ROLE_LABELS[inv.role] ?? inv.role}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(inv.expiresAt)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 h-8"
                              onClick={() => revokeInviteMutation.mutate(inv.id)}
                            >
                              Revoke
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) handleCloseInvite(); else setInviteOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a Team Member</DialogTitle>
            <DialogDescription>
              Enter their email and role. An invite link will be generated — share it directly with them.
            </DialogDescription>
          </DialogHeader>

          {!inviteLink ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviteMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole} disabled={inviteMutation.isPending}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="TEAM_LEADER">Team Leader</SelectItem>
                    <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="PROJECT_MANAGER">Project Manager</SelectItem>
                    <SelectItem value="TEAM_MEMBER">Team Member</SelectItem>
                    <SelectItem value="CLIENT">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <Shield className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-400">
                  Invite link created for <strong>{inviteEmail}</strong>. Copy and share it with them — it expires in 7 days.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Invite Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="text-xs font-mono bg-gray-50 dark:bg-slate-900/50"
                  />
                  <Button variant="outline" size="sm" className="shrink-0" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {!inviteLink ? (
              <>
                <Button variant="outline" onClick={handleCloseInvite}>Cancel</Button>
                <Button
                  onClick={handleInviteSubmit}
                  disabled={inviteMutation.isPending}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                >
                  {inviteMutation.isPending ? "Creating..." : "Generate Invite Link"}
                </Button>
              </>
            ) : (
              <Button onClick={handleCloseInvite} className="w-full">Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
