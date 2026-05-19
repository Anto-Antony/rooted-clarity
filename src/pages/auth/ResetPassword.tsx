import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle } from "lucide-react";

const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase parses the hash automatically on load; listen for the recovery event.
    let resolved = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && !resolved)) {
        resolved = true;
        setReady("ok");
      }
    });
    // Fallback: check existing session after a tick
    const t = setTimeout(async () => {
      if (resolved) return;
      const { data } = await supabase.auth.getSession();
      setReady(data.session ? "ok" : "invalid");
    }, 800);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = passwordSchema.safeParse(pw);
    if (!r.success) return toast.error(r.error.issues[0].message);
    if (pw !== confirm) return toast.error("Passwords do not match");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: r.data });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.auth.signOut();
    navigate("/auth/reset-success", { replace: true });
  };

  if (ready === "checking") {
    return (
      <AuthCard>
        <p className="text-center text-sm text-muted-foreground">Verifying reset link…</p>
      </AuthCard>
    );
  }

  if (ready === "invalid") {
    return (
      <AuthCard>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Reset link invalid or expired</h2>
          <p className="text-sm text-muted-foreground">
            Request a new password reset link to continue.
          </p>
          <Button asChild className="w-full">
            <Link to="/auth/forgot-password">Request new link</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="space-y-5">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Set a new password</h2>
          <p className="text-sm text-muted-foreground">Choose a strong password you haven't used before.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rp-pw">New password</Label>
            <Input
              id="rp-pw"
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">At least 8 characters. Avoid commonly leaked passwords.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-confirm">Confirm password</Label>
            <Input
              id="rp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Resetting…" : "Reset password"}
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}
