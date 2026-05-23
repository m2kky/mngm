import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronRight, ChevronLeft, Check, Users, Building, Loader2 } from "lucide-react";
import { useAuth, getAuthToken } from "@/contexts/AuthContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { User, Role } from "@shared/schema";

const steps = [
  { id: 1, title: "Welcome to Workit.OS", description: "Let's get you set up with your workspace" },
  { id: 2, title: "Choose Your Role", description: "This helps us customize your experience" },
  { id: 3, title: "Agency Setup", description: "Set up your agency or join an existing one" },
  { id: 4, title: "Personal Information", description: "Tell us a bit about yourself" },
  { id: 5, title: "All Set!", description: "Your workspace is ready to go" }
];

const roles = [
  { id: "admin", name: "Admin / Owner", description: "Full control over the agency and all settings" },
  { id: "project_manager", name: "Project Manager", description: "Manage teams and projects" },
  { id: "team_member", name: "Team Member", description: "Complete tasks and track time" },
  { id: "client", name: "Client", description: "View project progress and provide feedback" }
];

const roleToDbEnum: Record<string, Role> = {
  admin: "ADMIN",
  project_manager: "PROJECT_MANAGER",
  team_member: "TEAM_MEMBER",
  client: "CLIENT",
};

const timezones = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris / Berlin (CET)" },
  { value: "Europe/Istanbul", label: "Istanbul (TRT)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Riyadh", label: "Riyadh (AST)" },
  { value: "Africa/Cairo", label: "Cairo (EET)" },
  { value: "Asia/Kolkata", label: "Mumbai / Delhi (IST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

const currencies = [
  { value: "USD", label: "USD – US Dollar" },
  { value: "EUR", label: "EUR – Euro" },
  { value: "GBP", label: "GBP – British Pound" },
  { value: "AED", label: "AED – UAE Dirham" },
  { value: "SAR", label: "SAR – Saudi Riyal" },
  { value: "EGP", label: "EGP – Egyptian Pound" },
  { value: "INR", label: "INR – Indian Rupee" },
  { value: "SGD", label: "SGD – Singapore Dollar" },
  { value: "JPY", label: "JPY – Japanese Yen" },
  { value: "CAD", label: "CAD – Canadian Dollar" },
  { value: "AUD", label: "AUD – Australian Dollar" },
];

export default function Onboarding() {
  const { currentUser, userProfile, refreshUserProfile, setUserProfile } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<"join" | "create">("create");
  const [workspaceCode, setWorkspaceCode] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("USD");
  const [name, setName] = useState(userProfile?.name ?? "");
  const [language, setLanguage] = useState("en");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userProfile?.agencyId) {
      setLocation("/dashboard");
    }
  }, [userProfile?.agencyId, setLocation]);

  if (userProfile?.agencyId) return null;

  const progress = (currentStep / steps.length) * 100;

  const nextStep = () => {
    if (currentStep < steps.length) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleComplete = async () => {
    if (!currentUser) {
      toast({ title: "Not signed in", description: "Please sign in to continue.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = getAuthToken();
      const authHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      };

      let agencyId: string;

      if (workspaceMode === "create") {
        const agencyRes = await fetch("/api/agencies", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ name: agencyName, timezone, currency, ownerId: currentUser.id }),
        });
        if (!agencyRes.ok) throw new Error(`Failed to create agency: ${await agencyRes.text()}`);
        const agency = await agencyRes.json();
        agencyId = agency.id;
      } else {
        toast({
          title: "Join via code coming soon",
          description: "Workspace join via invitation code is not yet available.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const dbRole: Role = roleToDbEnum[selectedRole] ?? "TEAM_MEMBER";

      const userRes = await fetch(`/api/users/${currentUser.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          agencyId,
          name: name || userProfile?.name || null,
          language,
          role: dbRole,
        }),
      });
      if (!userRes.ok) throw new Error(`Failed to update user: ${await userRes.text()}`);

      const resolvedName = name.trim() || userProfile?.name || null;
      const updatedProfile: User = {
        ...currentUser,
        name: resolvedName,
        language,
        role: dbRole,
        agencyId,
        updatedAt: new Date(),
      };
      setUserProfile(updatedProfile);

      await refreshUserProfile();

      toast({ title: "Welcome to Workit.OS!", description: "Your agency has been created successfully." });
      setLocation("/dashboard");
    } catch (err: unknown) {
      console.error("Onboarding error:", err);
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({
        title: "Something went wrong",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-sm">
              <span className="text-primary-foreground font-bold text-2xl">W</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Welcome to Workit.OS
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                The complete workforce management platform designed for modern agencies. Let's get you started!
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Choose Your Role</h2>
              <p className="text-gray-600 dark:text-gray-400">Select the role that best describes your position</p>
            </div>
            <RadioGroup value={selectedRole} onValueChange={setSelectedRole}>
              <div className="grid gap-3">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center space-x-3">
                    <RadioGroupItem value={role.id} id={role.id} />
                    <Label
                      htmlFor={role.id}
                      className="flex-1 cursor-pointer p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="font-medium text-gray-800 dark:text-gray-200">{role.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{role.description}</div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Agency Setup</h2>
              <p className="text-gray-600 dark:text-gray-400">Set up your agency or join an existing one</p>
            </div>

            <RadioGroup value={workspaceMode} onValueChange={(v) => setWorkspaceMode(v as "join" | "create")}>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="create" id="create" />
                  <Label htmlFor="create" className="flex items-center space-x-2 cursor-pointer">
                    <Building className="h-5 w-5" />
                    <span>Create a new agency</span>
                  </Label>
                </div>

                {workspaceMode === "create" && (
                  <div className="ml-7 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="agencyName">Agency Name</Label>
                      <Input
                        id="agencyName"
                        placeholder="e.g. Creative Studio Pro"
                        value={agencyName}
                        onChange={(e) => setAgencyName(e.target.value)}
                        className="bg-white/10 border-white/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger id="timezone" className="bg-white/10 border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timezones.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger id="currency" className="bg-white/10 border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3 opacity-50">
                  <RadioGroupItem value="join" id="join" disabled />
                  <Label htmlFor="join" className="flex items-center space-x-2 cursor-not-allowed">
                    <Users className="h-5 w-5" />
                    <span>Join an existing agency</span>
                    <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">Coming soon</span>
                  </Label>
                </div>

                {workspaceMode === "join" && (
                  <div className="ml-7 space-y-2">
                    <Label htmlFor="workspaceCode">Invitation Code</Label>
                    <Input
                      id="workspaceCode"
                      placeholder="Enter your invitation code"
                      value={workspaceCode}
                      onChange={(e) => setWorkspaceCode(e.target.value)}
                      className="bg-white/10 border-white/20"
                    />
                  </div>
                )}
              </div>
            </RadioGroup>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">Personal Information</h2>
              <p className="text-gray-600 dark:text-gray-400">Tell us a bit about yourself</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white/10 border-white/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Preferred Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language" className="bg-white/10 border-white/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية (Arabic)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">All Set!</h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Your agency workspace is ready. Click "Get Started" to begin managing tasks, tracking time, and collaborating with your team.
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-left max-w-sm mx-auto">
              <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Setup Summary:</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Role: {roles.find((r) => r.id === selectedRole)?.name ?? "—"}</li>
                <li>• Agency: {agencyName || "—"}</li>
                <li>• Timezone: {timezones.find((t) => t.value === timezone)?.label ?? timezone}</li>
                <li>• Currency: {currency}</li>
                <li>• Language: {language === "en" ? "English" : "Arabic"}</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1: return true;
      case 2: return selectedRole !== "";
      case 3:
        if (workspaceMode === "create") return agencyName.trim() !== "";
        return workspaceCode.trim() !== "";
      case 4: return name.trim() !== "";
      case 5: return true;
      default: return false;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background p-4">
      <div className="max-w-2xl mx-auto py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              {steps[currentStep - 1]?.title}
            </h1>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Step {currentStep} of {steps.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-gray-600 dark:text-gray-400 mt-2">{steps[currentStep - 1]?.description}</p>
        </div>

        <GlassCard className="p-8 mb-8">{renderStepContent()}</GlassCard>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1 || isSubmitting}
            className="bg-white/10 hover:bg-white/20 border-white/20"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex space-x-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index + 1 === currentStep
                    ? "bg-indigo-500"
                    : index + 1 < currentStep
                    ? "bg-green-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              />
            ))}
          </div>

          {currentStep === steps.length ? (
            <Button onClick={handleComplete} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  Get Started
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={nextStep} disabled={!isStepValid()}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
