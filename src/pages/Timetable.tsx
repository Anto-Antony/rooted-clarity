import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ClassRow = { id: string; section: string; academic_year: string; course_id: string };
type Course = { id: string; name: string };
type Staff = { id: string; full_name: string };
type Slot = {
  id: string; class_id: string; day_of_week: number; period: number;
  subject: string; teacher_id: string | null; start_time: string | null; end_time: string | null;
};

export default function Timetable() {
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [form, setForm] = useState({
    day_of_week: 0, period: 1, subject: "", teacher_id: "none",
    start_time: "", end_time: "",
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, section, academic_year, course_id").order("academic_year", { ascending: false });
      if (error) throw error;
      return data as ClassRow[];
    },
  });
  const { data: courses = [] } = useQuery({
    queryKey: ["courses-min-tt"],
    queryFn: async () => (await supabase.from("courses").select("id, name")).data as Course[] ?? [],
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff-min-tt"],
    queryFn: async () => (await supabase.from("staff").select("id, full_name").eq("status", "active").order("full_name")).data as Staff[] ?? [],
  });
  const courseById = useMemo(() => Object.fromEntries(courses.map(c => [c.id, c.name])), [courses]);
  const staffById = useMemo(() => Object.fromEntries(staff.map(s => [s.id, s.full_name])), [staff]);

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["timetable", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase.from("timetable_slots").select("*").eq("class_id", classId).order("day_of_week").order("period");
      if (error) throw error;
      return data as Slot[];
    },
  });

  const openNew = (day?: number, period?: number) => {
    setEditing(null);
    setForm({ day_of_week: day ?? 0, period: period ?? 1, subject: "", teacher_id: "none", start_time: "", end_time: "" });
    setOpen(true);
  };
  const openEdit = (s: Slot) => {
    setEditing(s);
    setForm({
      day_of_week: s.day_of_week, period: s.period, subject: s.subject,
      teacher_id: s.teacher_id ?? "none",
      start_time: s.start_time ?? "", end_time: s.end_time ?? "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!classId) throw new Error("Select a class first");
      if (!form.subject.trim()) throw new Error("Subject required");
      const payload = {
        class_id: classId,
        day_of_week: form.day_of_week,
        period: form.period,
        subject: form.subject.trim(),
        teacher_id: form.teacher_id === "none" ? null : form.teacher_id,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
      };
      if (editing) {
        const { error } = await supabase.from("timetable_slots").update(payload).eq("id", editing.id);
        if (error) throw error;
        await supabase.rpc("resync_future_sessions", { _slot_id: editing.id });
      } else {
        const { error } = await supabase.from("timetable_slots").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["timetable", classId] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await supabase.rpc("resync_future_sessions", { _slot_id: id });
      const { error } = await supabase.from("timetable_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Slot removed"); qc.invalidateQueries({ queryKey: ["timetable", classId] }); },
    onError: (e: any) => toast.error(e.message),
  });


  const periods = Array.from({ length: 8 }, (_, i) => i + 1);
  const slotMap = useMemo(() => {
    const m: Record<string, Slot> = {};
    slots.forEach(s => { m[`${s.day_of_week}-${s.period}`] = s; });
    return m;
  }, [slots]);

  return (
    <div>
      <PageHeader title="Timetable" description="Weekly class schedule per section." />
      <div className="ra-card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="space-y-1 min-w-[260px]">
          <Label>Class</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {courseById[c.course_id] ?? "—"} · {c.section} · {c.academic_year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => openNew()} disabled={!classId}><Plus className="h-4 w-4 mr-1" /> Add slot</Button>
      </div>

      {!classId ? (
        <EmptyState icon={Calendar} title="Pick a class" description="Choose a class above to view its timetable." />
      ) : isLoading ? (
        <div className="ra-card p-8 text-center text-muted-foreground text-sm">Loading…</div>
      ) : (
        <div className="ra-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left font-medium w-20">Period</th>
                {DAYS.map((d, i) => <th key={i} className="px-3 py-2 text-left font-medium">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {periods.map(p => (
                <tr key={p} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">P{p}</td>
                  {DAYS.map((_, dIdx) => {
                    const s = slotMap[`${dIdx}-${p}`];
                    return (
                      <td key={dIdx} className="px-2 py-2 align-top">
                        {s ? (
                          <div className="rounded-md border border-border bg-primary/5 p-2 cursor-pointer hover:bg-primary/10" onClick={() => openEdit(s)}>
                            <div className="font-medium text-xs">{s.subject}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {s.teacher_id ? staffById[s.teacher_id] : "—"}
                            </div>
                            {s.start_time && <div className="text-[10px] text-muted-foreground">{s.start_time}–{s.end_time}</div>}
                          </div>
                        ) : (
                          <button className="w-full h-12 rounded-md border border-dashed border-border text-muted-foreground hover:border-primary/40 text-xs" onClick={() => openNew(dIdx, p)}>+</button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit slot" : "Add slot"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Day</Label>
                <Select value={String(form.day_of_week)} onValueChange={v => setForm({ ...form, day_of_week: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Period</Label>
                <Input type="number" min={1} max={12} value={form.period} onChange={e => setForm({ ...form, period: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Mathematics" />
            </div>
            <div className="space-y-1">
              <Label>Teacher</Label>
              <Select value={form.teacher_id} onValueChange={v => setForm({ ...form, teacher_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Start</Label><Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div>
              <div className="space-y-1"><Label>End</Label><Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editing && <Button variant="ghost" onClick={() => del.mutate(editing.id)}><Trash2 className="h-4 w-4 mr-1 text-destructive" /> Delete</Button>}
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
