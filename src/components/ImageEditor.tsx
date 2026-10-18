import { useEffect, useRef, useState } from "react";
import { RotateCw, Eraser, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEFAULT_EDITS, renderEdited, type ImageEdits } from "@/lib/image-process";

export function ImageEditor({ file, edits, open, onOpenChange, onSave }: {
  file: File | null; edits: ImageEdits; open: boolean;
  onOpenChange: (o: boolean) => void; onSave: (e: ImageEdits) => void;
}) {
  const [draft, setDraft] = useState<ImageEdits>(edits);
  const [preview, setPreview] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { if (open) setDraft(edits); }, [open, edits]);
  useEffect(() => {
    if (!open || !file) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const c = await renderEdited(file, draft, 700);
      setPreview(c.toDataURL("image/jpeg", 0.8));
    }, 150);
    return () => clearTimeout(timer.current);
  }, [open, file, draft]);

  const crop = (side: keyof ImageEdits["crop"], label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}: {draft.crop[side]}%</Label>
      <Slider min={0} max={40} step={1} value={[draft.crop[side]]}
        onValueChange={([v]) => setDraft((d) => ({ ...d, crop: { ...d.crop, [side]: v ?? 0 } }))} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="pe-8">تعديل الصورة</DialogTitle></DialogHeader>
        <div className="rounded-md border bg-muted grid place-items-center min-h-48">
          {preview ? <img src={preview} alt="معاينة" className="max-h-72 object-contain" /> : <span className="text-sm text-muted-foreground">…</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10" onClick={() => setDraft((d) => ({ ...d, rotation: ((d.rotation + 90) % 360) as ImageEdits["rotation"] }))}>
            <RotateCw className="size-4" /> تدوير
          </Button>
          <Button variant={draft.cleanup ? "default" : "outline"} className="h-10" onClick={() => setDraft((d) => ({ ...d, cleanup: !d.cleanup }))}>
            <Eraser className="size-4" /> تنظيف الخلفية
          </Button>
          <Button variant="ghost" className="h-10" onClick={() => setDraft(DEFAULT_EDITS)}>
            <RotateCcw className="size-4" /> إعادة ضبط
          </Button>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">التباين: {draft.contrast.toFixed(2)}</Label>
          <Slider min={0.5} max={2} step={0.05} value={[draft.contrast]} onValueChange={([v]) => setDraft((d) => ({ ...d, contrast: v ?? 1 }))} />
        </div>
        <p className="text-xs font-bold text-muted-foreground">قصّ الحواف</p>
        <div className="grid grid-cols-2 gap-3">
          {crop("top", "أعلى")}{crop("bottom", "أسفل")}{crop("right", "يمين")}{crop("left", "يسار")}
        </div>
        <Button className="w-full h-11" onClick={() => { onSave(draft); onOpenChange(false); }}>حفظ التعديلات</Button>
      </DialogContent>
    </Dialog>
  );
}
