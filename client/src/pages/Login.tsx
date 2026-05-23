import { useState, useEffect } from "react";
import { Redirect, useSearch } from "wouter";
import { Loader2, Mail, Lock, Eye, EyeOff, User, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { currentUser, signIn, signUp, verifyOtp } = useAuth();
  const { toast } = useToast();
  const search = useSearch();

  const params = new URLSearchParams(search);
  const inviteToken = params.get("invite") ?? null;

  const [mode, setMode] = useState<"signin" | "register" | "otp">(inviteToken ? "register" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; role: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteToken) return;
    fetch(`/api/invitations/by-token/${inviteToken}`)
      .then((res) => {
        if (!res.ok) throw new Error("Invalid or expired invite link");
        return res.json();
      })
      .then((data) => {
        setInviteInfo(data);
        setEmail(data.email);
        if (data.status !== "PENDING") {
          setInviteError("This invite has already been used or revoked.");
        } else if (new Date(data.expiresAt) < new Date()) {
          setInviteError("This invite link has expired.");
        }
      })
      .catch((err) => {
        setInviteError(err.message ?? "Invalid invite link");
      });
  }, [inviteToken]);

  if (currentUser) {
    return <Redirect to="/dashboard" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        toast({ title: "Welcome back!" });
      } else if (mode === "otp") {
        await verifyOtp(email, otpValue);
        toast({ title: "Email verified successfully!" });
      } else {
        const res = await signUp(name, email, password, inviteToken ?? undefined);
        if (res.requiresVerification) {
          setMode("otp");
          toast({
            title: "Check your email",
            description: "We've sent a 6-digit verification code to your email.",
          });
        } else {
          toast({
            title: "Account created!",
            description: inviteToken ? "You've joined the workspace." : "Let's set up your workspace.",
          });
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 dark:bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-5 shadow-sm">
            <span className="text-primary-foreground font-bold text-xl">W</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Welcome to Workit.OS
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {mode === "otp"
              ? "Verify your email address"
              : inviteToken
              ? "You've been invited to join a workspace"
              : mode === "signin"
              ? "Sign in to your workspace"
              : "Create your account"}
          </p>
        </div>

        {inviteToken && inviteError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
            {inviteError}
          </div>
        )}

        {inviteToken && inviteInfo && !inviteError && (
          <div className="p-3 rounded-lg bg-primary/8 border border-primary/20 text-primary text-sm text-center">
            Invited as <strong>{inviteInfo.role.replace("_", " ")}</strong> — create your account below.
          </div>
        )}

        <div className="bg-background border border-border rounded-xl shadow-sm p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "otp" ? (
              <div className="space-y-4 flex flex-col items-center">
                <div className="text-center space-y-2">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <KeyRound className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code sent to <br />
                    <span className="font-medium text-foreground">{email}</span>
                  </p>
                </div>
                <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue} disabled={isLoading}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            ) : (
              <>
                {mode === "register" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-9"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      required
                      disabled={isLoading || (!!inviteToken && !!inviteInfo)}
                      autoComplete="email"
                    />
                  </div>
                  {inviteToken && inviteInfo && (
                    <p className="text-xs text-muted-foreground">Email is pre-filled from your invitation.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-10"
                      required
                      disabled={isLoading}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      minLength={8}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {mode === "register" && (
                    <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                  )}
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || (!!inviteToken && !!inviteError) || (mode === "otp" && otpValue.length < 6)}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {mode === "signin" ? "Sign In" : mode === "otp" ? "Verify Email" : "Create Account"}
            </Button>
          </form>

          {!inviteToken && mode !== "otp" && (
            <p className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className="text-primary hover:underline font-medium underline-offset-2"
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="text-primary hover:underline font-medium underline-offset-2"
                  >
                    Sign In
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
