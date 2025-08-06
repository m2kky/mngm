import { useState } from "react";
import { Navigate } from "wouter";
import { ChevronRight, ChevronLeft, Check, Users, Building } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const steps = [
  {
    id: 1,
    title: "Welcome to Workit.OS",
    description: "Let's get you set up with your workspace"
  },
  {
    id: 2,
    title: "Choose Your Role",
    description: "This helps us customize your experience"
  },
  {
    id: 3,
    title: "Workspace Setup",
    description: "Join an existing workspace or create a new one"
  },
  {
    id: 4,
    title: "Personal Information",
    description: "Tell us a bit about yourself"
  },
  {
    id: 5,
    title: "All Set!",
    description: "Your workspace is ready to go"
  }
];

const roles = [
  { id: "team_leader", name: "Team Leader", description: "Manage teams and projects" },
  { id: "supervisor", name: "Supervisor", description: "Oversee team performance and attendance" },
  { id: "employee", name: "Employee", description: "Complete tasks and track time" },
  { id: "hr", name: "HR / Life Coach", description: "Support team wellness and development" },
  { id: "client", name: "Client", description: "View project progress and provide feedback" }
];

export default function Onboarding() {
  const { userProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<"join" | "create">("join");
  const [workspaceCode, setWorkspaceCode] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");

  // If user already has profile, redirect to dashboard
  if (userProfile?.workspaceId) {
    return <Navigate to="/dashboard" />;
  }

  const progress = (currentStep / steps.length) * 100;

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    // TODO: Save user profile and workspace settings to Firebase
    console.log("Onboarding complete", {
      selectedRole,
      workspaceMode,
      workspaceCode,
      workspaceName,
      name,
      language
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-2xl">W</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Welcome to Workit.OS
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                The complete workforce management platform designed for modern teams. Let's get you started!
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Choose Your Role
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Select the role that best describes your position
              </p>
            </div>
            
            <RadioGroup value={selectedRole} onValueChange={setSelectedRole}>
              <div className="grid gap-4">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center space-x-3">
                    <RadioGroupItem value={role.id} id={role.id} />
                    <Label
                      htmlFor={role.id}
                      className="flex-1 cursor-pointer p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {role.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {role.description}
                      </div>
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
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Workspace Setup
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Join an existing workspace or create a new one
              </p>
            </div>

            <RadioGroup value={workspaceMode} onValueChange={(value) => setWorkspaceMode(value as "join" | "create")}>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="join" id="join" />
                  <Label htmlFor="join" className="flex items-center space-x-2 cursor-pointer">
                    <Users className="h-5 w-5" />
                    <span>Join existing workspace</span>
                  </Label>
                </div>
                
                {workspaceMode === "join" && (
                  <div className="ml-7 space-y-2">
                    <Label htmlFor="workspaceCode">Workspace Code</Label>
                    <Input
                      id="workspaceCode"
                      placeholder="Enter workspace invitation code"
                      value={workspaceCode}
                      onChange={(e) => setWorkspaceCode(e.target.value)}
                      className="bg-white/10 border-white/20"
                    />
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="create" id="create" />
                  <Label htmlFor="create" className="flex items-center space-x-2 cursor-pointer">
                    <Building className="h-5 w-5" />
                    <span>Create new workspace</span>
                  </Label>
                </div>

                {workspaceMode === "create" && (
                  <div className="ml-7 space-y-2">
                    <Label htmlFor="workspaceName">Workspace Name</Label>
                    <Input
                      id="workspaceName"
                      placeholder="e.g. Digital Agency Pro"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
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
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                Personal Information
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Tell us a bit about yourself
              </p>
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
                  <SelectTrigger className="bg-white/10 border-white/20">
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
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                All Set! 🎉
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Your workspace is ready. You can now start managing tasks, tracking time, and collaborating with your team.
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-left max-w-sm mx-auto">
              <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Setup Summary:</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Role: {roles.find(r => r.id === selectedRole)?.name}</li>
                <li>• Workspace: {workspaceMode === "join" ? "Joining existing" : "Creating new"}</li>
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
      case 1:
        return true;
      case 2:
        return selectedRole !== "";
      case 3:
        return workspaceMode === "join" ? workspaceCode !== "" : workspaceName !== "";
      case 4:
        return name !== "";
      case 5:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-2xl mx-auto py-8">
        {/* Progress Header */}
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
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {steps[currentStep - 1]?.description}
          </p>
        </div>

        {/* Step Content */}
        <GlassCard className="p-8 mb-8">
          {renderStepContent()}
        </GlassCard>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
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
            <Button
              onClick={handleComplete}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
            >
              Get Started
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              disabled={!isStepValid()}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
