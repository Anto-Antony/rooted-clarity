import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

type Course = { id: string; name: string; credits: number };

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  credits: z.number().int().min(0).max(100),
});

export default function Courses() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState({ name: "", credits: 3 });

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("name");
      if (error) throw error;
      return data as Course[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ name: form.name, credits: Number(form.credits) });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const payload = { name: parsed.data.name, credits: parsed.data.credits };
      if (editing) {
        const { error } = await supabase.from("courses").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("courses").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Course updated." : "Course created.");
      qc.invalidateQueries({ queryKey: ["courses"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Course deleted.");
      qc.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (e: any) => toast.error(e.message.includes("foreign key")
      ? "Cannot delete: classes reference this course."
      : e.message),
  });

  const openNew = () => { setEditing(null); setForm({ name: "", credits: 3 }); setOpen(true); };
  const openEdit = (c: Course) => { setEditing(c); setForm({ name: c.name, credits: c.credits }); setOpen(true); };

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Define the courses offered by your academy."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New course</Button>}
      />

      <div className="ra-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : courses.length === 0 ? (
          <EmptyState icon={BookOpen} title="No courses yet" description="Create your first course." action={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New course</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Credits</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.credits}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => del.mutate(c.id)} disabled={del.isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit course" : "New course"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Credits</Label>
              <Input type="number" min={0} max={100} value={form.credits}
                onChange={(e) => setForm({ ...form, credits: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
