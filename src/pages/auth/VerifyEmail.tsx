import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { useCooldown } from "@/hooks/useCooldown";
import { useAuth } from "@/hooks/useAuth";

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const stateEmail = (location.state as { email?: string } | null)?.email;
  const email = stateEmail ?? user?.email ?? "";
  const [loading, setLoading] = useState(false);
  const { remaining, start, active } = useCooldown(`resend-verify:${email}`, 60);

  useEffect(() => {
    if (user?.email_confirmed_at) navigate("/app", { replace: true });
  }, [user, navigate]);

  const resend = async () => {
    if (!email) return toast.error("No email on file. Please sign up again.");
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Verification email sent. Check your inbox.");
    start();
  };

  return (
    <AuthCard>
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Verify your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to{" "}
          <span className="font-medium text-foreground">{email || "your email"}</span>.
          Click the link to activate your account.
        </p>
        <Button onClick={resend} disabled={loading || active} className="w-full">
          {loading ? "Sending…" : active ? `Resend in ${remaining}s` : "Resend verification email"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Already verified?{" "}
          <Link to="/auth" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </AuthCard>
  );
}
