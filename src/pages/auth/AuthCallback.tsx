import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/auth/AuthCard";
import { toast } from "sonner";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let done = false;
    const finish = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (user?.email_confirmed_at) {
        toast.success("Email verified. Welcome!");
        navigate("/app", { replace: true });
      } else {
        navigate("/auth", { replace: true });
      }
    };
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      if (!done) {
        done = true;
        finish();
      }
    });
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        finish();
      }
    }, 1200);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [navigate]);

  return (
    <AuthCard>
      <p className="text-center text-sm text-muted-foreground">Completing sign in…</p>
    </AuthCard>
  );
}
