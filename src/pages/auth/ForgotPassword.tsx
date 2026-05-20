import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCooldown } from "@/hooks/useCooldown";
import { KeyRound } from "lucide-react";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { remaining, start, active } = useCooldown(`reset:${email}`, 60);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = emailSchema.safeParse(email);
    if (!r.success) return toast.error(r.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(r.data, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    // Same response regardless to prevent enumeration
    setSubmitted(true);
    start();
    if (error && !/rate|limit/i.test(error.message)) {
      // log internally only
      console.error("resetPasswordForEmail", error);
    }
    toast.success("If an account exists, a reset link has been sent.");
  };

  return (
    <AuthCard>
      <div className="space-y-5">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Forgot password</h2>
          <p className="text-sm text-muted-foreground">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fp-email">Email</Label>
            <Input
              id="fp-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || (submitted && active)}>
            {loading ? "Sending…" : submitted && active ? `Resend in ${remaining}s` : "Send reset link"}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">Back to sign in</Link>
        </p>
      </div>
    </AuthCard>
  );
}
