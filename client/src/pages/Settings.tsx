import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings2, Building2, Palette, Sun, Moon, Monitor,
  Save, Upload, Globe, ImageIcon, X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, ACCENT_COLORS, type Theme, type Language, type AccentColor } from "@/contexts/ThemeContext";
import { PageShell } from "@/components/layout/PageShell";
import { Link } from "wouter";
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

function GeneralSettings({ agency }: { agency: Agency }) {
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

  function onSubmit(values: GeneralFormValues) {
    updateMutation.mutate(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-indigo-500" />
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
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
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
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, or SVG. Max 5 MB.
                        </p>
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
              <Globe className="h-4 w-4 text-indigo-500" />
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
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
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
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
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

function AppearanceSettings() {
  const { theme, setTheme, accentColor, setAccentColor, language, setLanguage } = useTheme();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingTheme, setPendingTheme] = useState<Theme>(theme);
  const [pendingLanguage, setPendingLanguage] = useState<Language>(language);
  const [pendingAccent, setPendingAccent] = useState<AccentColor>(accentColor);

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sun className="h-4 w-4 text-indigo-500" />
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
            <Palette className="h-4 w-4 text-indigo-500" />
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
            Selected:{" "}
            <span className="font-medium capitalize">
              {ACCENT_COLORS.find((c) => c.value === pendingAccent)?.label}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-indigo-500" />
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

export default function Settings() {
  const { userProfile } = useAuth();

  const agencyId = userProfile?.agencyId;
  const isAdmin = userProfile?.role === "OWNER" || userProfile?.role === "ADMIN";

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

  return (
    <PageShell
      breadcrumbs={[{ label: "Workspace" }, { label: "Settings" }]}
      title={
        <span className="flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-indigo-500" />
          Settings
        </span>
      }
      description={
        isAdmin
          ? "Manage your workspace configuration and personal preferences."
          : "Manage your personal preferences."
      }
    >
      <div className="max-w-2xl mx-auto">
        {isAdmin ? (
              <Tabs defaultValue="general">
                <TabsList className="mb-6">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="team" asChild>
                    <Link href="/team">
                      <span className="flex items-center gap-1">Team ↗</span>
                    </Link>
                  </TabsTrigger>
                  <TabsTrigger value="appearance">Appearance</TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                  {isLoading ? (
                    <div className="space-y-4">
                      {[1, 2].map((i) => (
                        <Card key={i}>
                          <CardContent className="pt-6">
                            <div className="space-y-3">
                              <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
                              <div className="h-9 bg-muted animate-pulse rounded" />
                              <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
                              <div className="h-9 bg-muted animate-pulse rounded" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : agency ? (
                    <GeneralSettings agency={agency} />
                  ) : (
                    <p className="text-muted-foreground">Could not load agency settings.</p>
                  )}
                </TabsContent>

                <TabsContent value="appearance">
                  <AppearanceSettings />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-6">
                <div className="text-sm text-muted-foreground border border-border rounded-lg px-4 py-3 bg-muted/30">
                  You can manage your personal preferences below. Contact an admin to change workspace-level settings.
                </div>
            <AppearanceSettings />
          </div>
        )}
      </div>
    </PageShell>
  );
}
