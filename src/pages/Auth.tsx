import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sprout } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(72);
const nameSchema = z.string().trim().min(1, "Name is required").max(100);

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // login
  const [li, setLi] = useState({ email: "", password: "" });
  // signup
  const [su, setSu] = useState({ full_name: "", email: "", password: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email_confirmed_at) navigate("/app", { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user?.email_confirmed_at) navigate("/app", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailR = emailSchema.safeParse(li.email);
    const pwR = passwordSchema.safeParse(li.password);
    if (!emailR.success) return toast.error(emailR.error.issues[0].message);
    if (!pwR.success) return toast.error(pwR.error.issues[0].message);

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailR.data,
      password: pwR.data,
    });
    setLoading(false);
    if (error) {
      if (/email not confirmed/i.test(error.message)) {
        toast.error("Please verify your email to continue.");
        navigate("/auth/verify-email", { state: { email: emailR.data } });
        return;
      }
      toast.error(error.message === "Invalid login credentials"
        ? "Invalid email or password."
        : error.message);
      return;
    }
    toast.success("Welcome back.");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameR = nameSchema.safeParse(su.full_name);
    const emailR = emailSchema.safeParse(su.email);
    const pwR = passwordSchema.safeParse(su.password);
    if (!nameR.success) return toast.error(nameR.error.issues[0].message);
    if (!emailR.success) return toast.error(emailR.error.issues[0].message);
    if (!pwR.success) return toast.error(pwR.error.issues[0].message);

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: emailR.data,
      password: pwR.data,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: nameR.data },
      },
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("already"))
        toast.error("This email is already registered. Sign in instead.");
      else toast.error(error.message);
      return;
    }
    toast.success("Account created. Check your inbox to verify your email.");
    navigate("/auth/verify-email", { state: { email: emailR.data } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
            <Sprout className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">RootedAcademy</h1>
          <p className="text-sm text-muted-foreground mt-1">Where Clarity Begins</p>
        </div>

        <div className="ra-card p-6 shadow-sm">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="li-email">Email</Label>
                  <Input
                    id="li-email"
                    type="email"
                    autoComplete="email"
                    value={li.email}
                    onChange={(e) => setLi({ ...li, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="li-password">Password</Label>
                    <Link to="/auth/forgot-password" className="text-xs text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="li-password"
                    type="password"
                    autoComplete="current-password"
                    value={li.password}
                    onChange={(e) => setLi({ ...li, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Full name</Label>
                  <Input
                    id="su-name"
                    value={su.full_name}
                    onChange={(e) => setSu({ ...su, full_name: e.target.value })}
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">Email</Label>
                  <Input
                    id="su-email"
                    type="email"
                    autoComplete="email"
                    value={su.email}
                    onChange={(e) => setSu({ ...su, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password">Password</Label>
                  <Input
                    id="su-password"
                    type="password"
                    autoComplete="new-password"
                    value={su.password}
                    onChange={(e) => setSu({ ...su, password: e.target.value })}
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    At least 6 characters. Avoid commonly leaked passwords.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating…" : "Create account"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  New accounts have no roles assigned. An administrator will grant access.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
