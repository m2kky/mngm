import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings2, Building2, Palette, Sun, Moon, Monitor,
  Save, Upload, Globe, ImageIcon, X, User, Bell, Plug,
  CreditCard, AlertTriangle, AlignJustify,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  useTheme, ACCENT_COLORS,
  type Theme, type Language, type AccentColor, type Density,
} from "@/contexts/ThemeContext";
import { PageShell } from "@/components/layout/PageShell";
import { cn } from "@/lib/utils";

interface Agency {
  id: string;
  name: string;
  logo: string | null;
  timezone: string;
  currency: string;
}

const generalFormSchema = z.object({
  name: z.string().min(1, "Agency name is required"),
  logo: z.string().optional(),
  timezone: z.string().min(1, "Timezone is required"),
  currency: z.string().min(1, "Currency is required"),
});

type GeneralFormValues = z.infer<typeof generalFormSchema>;

const TIMEZONES = [
  { value: "Africa/Cairo", label: "Cairo (EET, UTC+2)" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "New York (EST/EDT)" },
  { value: "America/Chicago", label: "Chicago (CST/CDT)" },
  { value: "America/Denver", label: "Denver (MST/MDT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Asia/Dubai", label: "Dubai (GST, UTC+4)" },
  { value: "Asia/Riyadh", label: "Riyadh (AST, UTC+3)" },
  { value: "Asia/Kolkata", label: "Mumbai/Delhi (IST, UTC+5:30)" },
  { value: "Asia/Singapore", label: "Singapore (SGT, UTC+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST, UTC+9)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
];

const CURRENCIES = [
  { value: "EGP", label: "EGP — Egyptian Pound" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
  { value: "KWD", label: "KWD — Kuwaiti Dinar" },
  { value: "QAR", label: "QAR — Qatari Riyal" },
  { value: "BHD", label: "BHD — Bahraini Dinar" },
  { value: "JOD", label: "JOD — Jordanian Dinar" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "INR", label: "INR — Indian Rupee" },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Workspace Settings ───────────────────────────────────────────────────────

function WorkspaceSettings({ agency }: { agency: Agency }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const form = useForm<GeneralFormValues>({
    resolver: zodResolver(generalFormSchema),
    defaultValues: {
      name: agency.name,
      logo: agency.logo ?? "",
      timezone: agency.timezone,
      currency: agency.currency,
    },
  });

  const logoValue = form.watch("logo");

  const updateMutation = useMutation({
    mutationFn: async (data: GeneralFormValues) => {
      const res = await apiRequest("PUT", `/api/agencies/${agency.id}`, {
        name: data.name,
        timezone: data.timezone,
        currency: data.currency,
        logo: data.logo || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies", agency.id] });
      toast({ title: "Settings saved", description: "Workspace settings have been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  async function handleLogoUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Logo must be under 5 MB", variant: "destructive" });
      return;
    }
    setLogoUploading(true);
    try {
      const content = await fileToBase64(file);
      const res = await apiRequest("POST", "/api/files/upload", {
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        content,
        folder: "logos",
      });
      const uploaded = await res.json();
      form.setValue("logo", uploaded.fileUrl, { shouldDirty: true });
      toast({ title: "Logo uploaded", description: "Click Save Changes to apply." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setLogoUploading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Agency Identity
            </CardTitle>
            <CardDescription>
              Basic information about your workspace, visible to all team members.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agency Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Marketing Agency" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agency Logo</FormLabel>
                  <FormControl>
                    <div className="flex items-start gap-3">
                      {logoValue ? (
                        <div className="relative flex-shrink-0">
                          <img
                            src={logoValue}
                            alt="Logo preview"
                            className="h-16 w-16 rounded-lg object-cover border border-border"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <button
                            type="button"
                            onClick={() => form.setValue("logo", "", { shouldDirty: true })}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center flex-shrink-0 bg-muted/20">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLogoUpload(e.target.files)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={logoUploading}
                          onClick={() => logoInputRef.current?.click()}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {logoUploading ? "Uploading…" : "Upload Image"}
                        </Button>
                        <p className="text-xs text-muted-foreground">PNG, JPG, or SVG. Max 5 MB.</p>
                        <input type="hidden" {...field} />
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-primary" />
              Regional Settings
            </CardTitle>
            <CardDescription>
              Configure timezone and currency used across reports and time tracking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Appearance Settings ──────────────────────────────────────────────────────

function AppearanceSettings() {
  const { theme, setTheme, accentColor, setAccentColor, language, setLanguage, density, setDensity } = useTheme();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingTheme, setPendingTheme] = useState<Theme>(theme);
  const [pendingLanguage, setPendingLanguage] = useState<Language>(language);
  const [pendingAccent, setPendingAccent] = useState<AccentColor>(accentColor);
  const [pendingDensity, setPendingDensity] = useState<Density>(density);

  const saveMutation = useMutation({
    mutationFn: async (vars: { theme: Theme; language: Language; accentColor: AccentColor }) => {
      if (!userProfile?.id) throw new Error("Not logged in");
      const res = await apiRequest("PUT", `/api/users/${userProfile.id}`, {
        theme: vars.theme,
        language: vars.language,
        accentColor: vars.accentColor,
      });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setTheme(variables.theme);
      setLanguage(variables.language);
      setAccentColor(variables.accentColor);
      setDensity(pendingDensity);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Preferences saved", description: "Your appearance settings have been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const themeOptions = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  const densityOptions = [
    { value: "comfortable" as const, label: "Comfortable", description: "More breathing room" },
    { value: "compact" as const, label: "Compact", description: "More content on screen" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sun className="h-4 w-4 text-primary" />
            Color Mode
          </CardTitle>
          <CardDescription>
            Choose between light and dark mode, or follow your system setting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPendingTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all duration-200",
                  pendingTheme === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-muted-foreground/50 text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-primary" />
            Accent Color
          </CardTitle>
          <CardDescription>
            Pick a primary color applied throughout the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.label}
                onClick={() => setPendingAccent(color.value)}
                className={cn(
                  "w-10 h-10 rounded-full border-4 transition-all duration-200",
                  pendingAccent === color.value
                    ? "border-foreground scale-110 shadow-md"
                    : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: `hsl(${color.hsl})` }}
              />
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Selected: <span className="font-medium capitalize">{ACCENT_COLORS.find((c) => c.value === pendingAccent)?.label}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlignJustify className="h-4 w-4 text-primary" />
            Layout Density
          </CardTitle>
          <CardDescription>
            Control how compact or spacious the interface feels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {densityOptions.map(({ value, label, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPendingDensity(value)}
                className={cn(
                  "flex flex-col items-start gap-1 p-4 rounded-lg border-2 text-left transition-all duration-200",
                  pendingDensity === value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                <div className={cn("flex gap-0.5 mb-1", pendingDensity === value ? "opacity-100" : "opacity-40")}>
                  {value === "comfortable" ? (
                    [0,1,2].map(i => <div key={i} className="w-6 h-1.5 rounded-full bg-current" style={{marginBottom: i < 2 ? 3 : 0}} />)
                  ) : (
                    [0,1,2,3].map(i => <div key={i} className="w-6 h-1 rounded-full bg-current" style={{marginBottom: i < 3 ? 2 : 0}} />)
                  )}
                </div>
                <span className={cn("text-sm font-medium", pendingDensity === value ? "text-primary" : "text-foreground")}>
                  {label}
                </span>
                <span className="text-xs text-muted-foreground">{description}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" />
            Language
          </CardTitle>
          <CardDescription>
            Choose the display language for your interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 max-w-xs">
            {(["en", "ar"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setPendingLanguage(lang)}
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium",
                  pendingLanguage === lang
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-muted-foreground/50 text-muted-foreground"
                )}
              >
                {lang === "en" ? "🇬🇧 English" : "🇸🇦 العربية"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={saveMutation.isPending}
          className="gap-2"
          onClick={() => saveMutation.mutate({ theme: pendingTheme, language: pendingLanguage, accentColor: pendingAccent })}
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving…" : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}

// ─── Profile Settings ─────────────────────────────────────────────────────────

function ProfileSettings() {
  const { userProfile } = useAuth();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            Personal Information
          </CardTitle>
          <CardDescription>
            Your public profile visible to team members.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
              {(userProfile?.name ?? userProfile?.email ?? "?")[0].toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{userProfile?.name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{userProfile?.email}</p>
              <Badge variant="outline" className="mt-1 text-xs capitalize">
                {(userProfile?.role ?? "member").toLowerCase()}
              </Badge>
            </div>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Profile editing is managed through your authentication provider. Contact an admin to update your name or role.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Stub sections ────────────────────────────────────────────────────────────

function StubSection({ icon: Icon, title, description, badge }: {
  icon: React.ElementType; title: string; description: string; badge?: string;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-primary" />
            {title}
            {badge && <Badge variant="secondary" className="text-[10px] ml-1">{badge}</Badge>}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <Icon className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-medium mb-1">Coming soon</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              This section is under development and will be available in an upcoming release.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DangerZoneSection({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="space-y-6">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect your entire workspace. Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <div>
              <p className="text-sm font-medium">Delete Workspace</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently deletes all data, projects, tasks, and team members.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled
              title="Contact support to delete your workspace"
            >
              Delete
            </Button>
          </div>
          <p className="text-xs text-muted-foreground px-1">
            To delete your workspace, please contact support. This action cannot be undone.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Settings page ────────────────────────────────────────────────────────────

import { PropertyManager } from "@/components/properties/PropertyManager";

type Section =
  | "workspace"
  | "custom_properties"
  | "appearance"
  | "profile"
  | "notifications"
  | "integrations"
  | "billing"
  | "danger";

export default function Settings() {
  const { userProfile } = useAuth();

  const agencyId = userProfile?.agencyId;
  const isAdmin = userProfile?.role === "OWNER" || userProfile?.role === "ADMIN";

  const [activeSection, setActiveSection] = useState<Section>(isAdmin ? "workspace" : "appearance");

  const { data: agency, isLoading } = useQuery<Agency>({
    queryKey: ["/api/agencies", agencyId],
    queryFn: async () => {
      const res = await fetch(`/api/agencies/${agencyId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("wk_token")}` },
      });
      if (!res.ok) throw new Error("Failed to load agency");
      return res.json();
    },
    enabled: !!agencyId,
  });

  type NavItem = { id: Section; label: string; icon: React.ElementType; adminOnly?: boolean; danger?: boolean };

  const navItems: NavItem[] = [
    ...(isAdmin ? [{ id: "workspace" as Section, label: "Workspace", icon: Building2, adminOnly: true }] : []),
    ...(isAdmin ? [{ id: "custom_properties" as Section, label: "Custom Properties", icon: Settings2, adminOnly: true }] : []),
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "integrations", label: "Integrations", icon: Plug },
    { id: "billing", label: "Billing", icon: CreditCard },
    ...(isAdmin ? [{ id: "danger" as Section, label: "Danger Zone", icon: AlertTriangle, danger: true }] : []),
  ];

  function renderContent() {
    switch (activeSection) {
      case "workspace":
        return isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
                    <div className="h-9 bg-muted animate-pulse rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : agency ? (
          <WorkspaceSettings agency={agency} />
        ) : (
          <p className="text-muted-foreground text-sm">Could not load workspace settings.</p>
        );
      case "custom_properties":
        return <PropertyManager entityType="TASK" />;
      case "appearance":    return <AppearanceSettings />;
      case "profile":       return <ProfileSettings />;
      case "notifications": return <StubSection icon={Bell} title="Notification Preferences" description="Control which events trigger notifications and how you receive them." badge="Soon" />;
      case "integrations":  return <StubSection icon={Plug} title="Integrations" description="Connect external tools like Slack, GitHub, Notion, and more to your workspace." badge="Soon" />;
      case "billing":       return <StubSection icon={CreditCard} title="Billing & Subscription" description="Manage your plan, view invoices, and update payment methods." badge="Soon" />;
      case "danger":        return <DangerZoneSection isAdmin={isAdmin} />;
      default:              return null;
    }
  }

  const activeItem = navItems.find((n) => n.id === activeSection);

  return (
    <PageShell
      breadcrumbs={[{ label: "Workspace" }, { label: "Settings" }]}
      title={
        <span className="flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-primary" />
          Settings
        </span>
      }
      description={
        isAdmin
          ? "Manage your workspace configuration and personal preferences."
          : "Manage your personal preferences."
      }
    >
      <div className="flex gap-8 items-start">
        {/* ── Left nav ── */}
        <nav className="w-48 shrink-0 space-y-0.5" aria-label="Settings navigation">
          {navItems.map(({ id, label, icon: Icon, danger }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              data-testid={`settings-nav-${id}`}
              className={cn(
                "flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                danger
                  ? activeSection === id
                    ? "bg-destructive/10 text-destructive font-medium"
                    : "text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                  : activeSection === id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 max-w-2xl">
          {renderContent()}
        </div>
      </div>
    </PageShell>
  );
}
