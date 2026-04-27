import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABEL } from "@/lib/roles";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
});

export default function Profile() {
  const { user, roles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", address: "" });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, phone, address")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setForm({ full_name: data.full_name ?? "", phone: data.phone ?? "", address: data.address ?? "" });
        setLoading(false);
      });
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved.");
  };

  return (
    <div>
      <PageHeader title="Profile" description="Your personal details." />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="ra-card p-5 md:col-span-1">
          <div className="ra-section-title mb-2">Account</div>
          <div className="text-sm text-muted-foreground">{user?.email}</div>
          <div className="ra-section-title mt-4 mb-2">Roles</div>
          {roles.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No roles assigned</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {roles.map((r) => (
                <span key={r} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {ROLE_LABEL[r]}
                </span>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={save} className="ra-card p-5 md:col-span-2 space-y-4">
          <div className="ra-section-title">Personal details</div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
