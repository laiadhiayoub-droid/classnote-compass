import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, BookOpen, Check, FileText, ImageOff, Loader2, Lock, Pencil, RefreshCw, X, ZoomIn, ZoomOut, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { generateFormattedPage, updateFormattedPage } from "@/lib/notebook.functions";
import { canReadFormatted, notebookDocumentSchema, type NotebookDocument } from "@/lib/notebook";
import { NotebookDiagram } from "@/components/NotebookDiagram";
import { useI18n } from "@/lib/i18n";
import { signLessonImage, IMAGE_URL_SECONDS, IMAGE_URL_STALE_MS } from "@/lib/storage-images";

type Page = {id:string;title:string;image_path:string;subject:string;description?:string|null;resource_links?:string[]};
export function BoundNotebookReader({pages, initialId, roles, onClose}: {pages:Page[];initialId:string|null;roles:string[];onClose:()=>void}) {
  const { t } = useI18n();
  const [index,setIndex] = useState(0);
  const [mode,setMode] = useState("original");
  const [busy,setBusy] = useState(false);
  const [failure,setFailure] = useState<string|null>(null);
  const [scale,setScale] = useState(1);
  const [editing,setEditing] = useState(false);
  const [draft,setDraft] = useState<NotebookDocument|null>(null);
  const [saving,setSaving] = useState(false);
  const generate = useServerFn(generateFormattedPage);
  const update = useServerFn(updateFormattedPage);
  const allowed = canReadFormatted(roles);
  const canEdit = roles.includes("admin") || roles.includes("writer");
  const pinch = useRef<{d:number;scale:number}|null>(null);
  const [downloading,setDownloading] = useState(false);
  const [imgError,setImgError] = useState(false);
  const [lightbox,setLightbox] = useState(false);
  const imageRetries = useRef(0);
  const activePageId = useRef<string | undefined>(undefined);
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());
  async function downloadImage() {
    if(!image.data || !page || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(image.data);
      if(!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${page.title}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 30000);
    } catch { toast.error(t("imageDownloadFailed")); } finally { setDownloading(false); }
  }
  useEffect(()=>{setIndex(Math.max(0,pages.findIndex(p=>p.id===initialId)));setMode("original");setFailure(null);setEditing(false);setDraft(null);setLightbox(false);},[initialId]);
  const page=initialId ? pages[index] : undefined;
  useEffect(()=>{activePageId.current=page?.id;setScale(1);setEditing(false);setDraft(null);setImgError(false);imageRetries.current=0;setLightbox(false);},[page?.id,initialId]);
  const image = useQuery({queryKey:["bound-image",page?.image_path],enabled:!!page,staleTime:IMAGE_URL_STALE_MS,refetchInterval:IMAGE_URL_STALE_MS,retry:2,queryFn:async()=>{
    if(!page) return null;
    return signLessonImage(page.image_path);
  }});
  const thumb = useQuery({queryKey:["bound-thumb",pages.map(p=>p.image_path).join("|")],enabled:initialId!==null&&pages.length>1,staleTime:IMAGE_URL_STALE_MS,refetchInterval:IMAGE_URL_STALE_MS,queryFn:async()=>{
    const {data,error}=await supabase.storage.from("lessons-images").createSignedUrls(pages.map(p=>p.image_path),IMAGE_URL_SECONDS);
    if(error) throw error;
    return new Map(data.map(d=>[d.path,d.signedUrl]));
  }});
  async function retryImage() {
    imageRetries.current = 0;
    setImgError(false);
    await image.refetch();
  }
  async function imageFailed() {
    setImgError(true);
    if (imageRetries.current >= 1) return;
    imageRetries.current += 1;
    const failedId = page?.id;
    const result = await image.refetch();
    if (!result.isError && failedId === activePageId.current) setImgError(false);
  }
  const formatted = useQuery({queryKey:["formatted-page",page?.id],enabled:!!page && mode==="formatted" && allowed,retry:false,queryFn:async()=>{
    if(!page) return null;
    const {data,error}=await supabase.from("formatted_pages").select("document,status,error_message").eq("lesson_id",page.id).maybeSingle();
    if(error) throw error;return data;
  }});
  const parsed=notebookDocumentSchema.safeParse(formatted.data?.document);
  async function prepare(resume = false, rebuild = false) {
    if(!page || busy) return;
    setBusy(true);setFailure(null);
    try { const result=await generate({data:{lessonId:page.id,resume,rebuild}}); if(result.status==="error")setFailure(result.message); await formatted.refetch(); }
    catch {setFailure(t("formatFailed"));} finally {setBusy(false);}
  }
  function startEdit() {
    if(!parsed.success) return;
    setDraft(structuredClone(parsed.data));
    setEditing(true);
  }
  async function saveEdit() {
    if(!page || !draft || saving) return;
    setSaving(true);
    try {
      await update({data:{lessonId:page.id,document:draft}});
      toast.success(t("editsSaved"));
      setEditing(false);setDraft(null);
      await formatted.refetch();
    } catch { toast.error(t("editsSaveFailed")); } finally { setSaving(false); }
  }
  function setRunText(bi:number, ri:number, text:string) {
    setDraft(d=>{ if(!d) return d; const next=structuredClone(d); const run=next.blocks[bi]?.runs[ri]; if(run) run.text=text; return next; });
  }
  function onTouchMove(e:React.TouchEvent) {
    if(e.touches.length!==2) return;
    const a=e.touches[0], b=e.touches[1];
    if(!a || !b) return;
    const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    if(!pinch.current){pinch.current={d,scale};return;}
    setScale(Math.min(3,Math.max(0.5,pinch.current.scale*(d/pinch.current.d))));
  }
  const showSideBySide = mode==="formatted" && allowed && parsed.success && formatted.data?.status==="ready" && image.data && !editing;
  return <Dialog open={!!initialId} onOpenChange={open=>{if(!open)onClose();}}>
    <DialogContent className="w-[96vw] sm:max-w-5xl max-h-[94vh] overflow-hidden p-0 gap-0">
      <DialogTitle className="sr-only">{page?.title || t("formattedNotebook")}</DialogTitle>
      <div className="flex flex-wrap gap-2 items-center border-b p-4 px-12">
        <div className="min-w-0 w-full sm:w-auto sm:flex-1"><h2 className="font-bold break-words">{page?.title}</h2><p className="text-xs text-muted-foreground">{t("pageXofY",{i:index+1,n:pages.length})}</p></div>
        <Button size="sm" className="h-10" variant={mode==="original"?"default":"outline"} onClick={()=>setMode("original")}><BookOpen className="size-4"/>{t("original")}</Button>
        <Button size="sm" className="h-10" variant={mode==="formatted"?"default":"outline"} onClick={()=>setMode("formatted")}>{allowed?<FileText className="size-4"/>:<Lock className="size-4"/>}{t("formattedNotebook")}</Button>
      </div>
      {pages.length > 1 && <div className="flex gap-2 overflow-x-auto border-b px-4 py-2" role="tablist" aria-label={t("pagesCount",{n:pages.length})}>
        {pages.map((p,i)=>{const thumbUrl=failedThumbs.has(p.id)?undefined:thumb.data?.get(p.image_path);return <Button variant="ghost" key={p.id} role="tab" aria-selected={i===index} onClick={()=>{setIndex(i);setFailure(null);}}
          className={`shrink-0 h-auto p-0 rounded-md border-2 overflow-hidden transition ${i===index?"border-primary ring-2 ring-primary/30":"border-border opacity-70 hover:opacity-100"}`}>
          {thumbUrl
             ? <img src={thumbUrl} alt={t("pageN",{n:i+1})} onError={()=>setFailedThumbs(previous=>new Set(previous).add(p.id))} className="h-16 w-auto max-w-24 object-cover"/>
            : <span className="grid h-16 w-12 place-items-center text-xs text-muted-foreground">{i+1}</span>}
         </Button>;})}
      </div>}
      {!!(page?.description || page?.resource_links?.length) && <div className="border-b px-4 py-3 space-y-2 max-h-36 overflow-auto">
        {page.description && <p className="text-sm whitespace-pre-wrap break-words">{page.description}</p>}
        {page.resource_links?.filter(link=>/^https?:\/\//i.test(link)).map((link,i)=><a key={i} href={link} target="_blank" rel="noopener noreferrer" className="block text-primary underline text-sm break-all" dir="ltr">{link}</a>)}
      </div>}
      {mode === "original" && <div className="flex justify-center gap-2 border-b p-2">
        <Button variant="ghost" size="icon" className="size-10" aria-label={t("zoomIn")} onClick={()=>setScale(s=>Math.min(3,s+0.25))}><ZoomIn className="size-4"/></Button>
        <Button variant="ghost" size="icon" className="size-10" aria-label={t("zoomOut")} onClick={()=>setScale(s=>Math.max(0.5,s-0.25))}><ZoomOut className="size-4"/></Button>
        {image.data && <Button variant="ghost" size="icon" className="size-10" disabled={downloading} onClick={downloadImage} aria-label={t("downloadImage")}>{downloading?<Loader2 className="size-4 animate-spin"/>:<Download className="size-4"/>}</Button>}
        {image.data && <Button variant="ghost" size="icon" className="size-10" asChild><a href={image.data} target="_blank" rel="noreferrer" aria-label={t("openFullSize")}><ExternalLink className="size-4"/></a></Button>}
      </div>}
      {editing && <div className="flex justify-center gap-2 border-b p-2">
        <Button size="sm" onClick={saveEdit} disabled={saving}>{saving?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}{t("saveEdits")}</Button>
        <Button size="sm" variant="outline" disabled={saving} onClick={()=>{setEditing(false);setDraft(null);}}><X className="size-4"/>{t("cancel")}</Button>
      </div>}
      <div className="overflow-y-auto bg-muted p-3 sm:p-6 min-h-64 max-h-[70vh]">
        {mode==="original" ? image.isLoading || (imgError && image.isFetching) ? <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary"/><p>{t("loadingPage")}</p>
          </div>
        : image.isError || !image.data || imgError ? <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ImageOff className="size-9 text-primary"/>
            <p>{t("imageLoadFailed")}</p>
            <Button variant="outline" size="sm" disabled={image.isFetching} onClick={()=>void retryImage()}><RefreshCw className="size-4"/>{t("retry")}</Button>
          </div>
        : <div className="overflow-auto flex justify-center" style={{touchAction:"pan-x pan-y"}} onTouchMove={onTouchMove} onTouchEnd={()=>{pinch.current=null;}}>
            <img className="max-w-full max-h-[70vh] object-contain mx-auto rounded-lg shadow-md select-none cursor-zoom-in" onClick={()=>setLightbox(true)} onError={()=>void imageFailed()} style={{transform:`scale(${scale})`,transformOrigin:"center top"}} src={image.data} alt={page?.title}/>
          </div>
        : !allowed ? <div className="text-center py-16 space-y-4"><Lock className="size-9 mx-auto text-primary"/><p>{t("lockedNotebook")}</p></div>
        : editing && draft ? <article className="digital-sheet mx-auto" dir={draft.direction}>
            <p className="text-xs text-muted-foreground mb-4">{t("editHint")}</p>
            {draft.blocks.map((block,i)=><div key={i} className={`document-block document-${block.kind}`}>
              {block.kind === "diagram" && <NotebookDiagram diagram={block.diagram}/>}
              {block.runs.map((run,j)=><span key={j} contentEditable suppressContentEditableWarning
                onBlur={e=>setRunText(i,j,e.currentTarget.textContent ?? "")}
                className="outline-none focus:bg-secondary/60 rounded-sm px-0.5"
                style={{color:run.color,backgroundColor:run.highlight ?? "transparent",fontWeight:run.bold?700:400,textDecoration:run.underline?"underline":"none"}}>{run.text}</span>)}
            </div>)}
          </article>
        : parsed.success && formatted.data?.status==="ready" ? <>
          {parsed.data.uncertain && <p className="text-sm text-destructive mb-3">{t("unclearParts")}</p>}
          {failure && <p role="alert" className="text-sm text-destructive mb-3">{failure}</p>}
          {canEdit && <div className="flex flex-wrap justify-end gap-2 mb-3">
            {roles.includes("admin") && <Button size="sm" variant="outline" disabled={busy} onClick={()=>prepare(false,true)}>{busy?<Loader2 className="size-4 animate-spin"/>:<RefreshCw className="size-4"/>}{t("rereadGraphics")}</Button>}
            <Button size="sm" variant="outline" disabled={busy} onClick={startEdit}><Pencil className="size-4"/>{t("editText")}</Button>
          </div>}
          <div className={showSideBySide ? "grid gap-4 lg:grid-cols-2 items-start" : ""}>
            {showSideBySide && <figure className="hidden lg:block sticky top-0">
              {imgError ? <Button variant="outline" disabled={image.isFetching} onClick={()=>void retryImage()}>{t("retry")}</Button> : <img className="w-full h-auto rounded-md border" onError={()=>void imageFailed()} src={image.data ?? undefined} alt={t("originalImage")}/>}
              <figcaption className="text-xs text-muted-foreground text-center mt-1">{t("originalImage")}</figcaption>
            </figure>}
            <article className="digital-sheet mx-auto" dir={parsed.data.direction}>
              {parsed.data.blocks.map((block,i)=><div key={i} className={`document-block document-${block.kind}`}>
                {block.kind === "diagram" && <NotebookDiagram diagram={block.diagram}/>}
                {block.runs.map((run,j)=><span key={j} style={{color:run.color,backgroundColor:run.highlight ?? "transparent",fontWeight:run.bold?700:400,textDecoration:run.underline?"underline":"none"}}>{run.text}</span>)}
              </div>)}
              <footer className="document-footer">{index+1}</footer>
            </article>
          </div>
        </> : <div className="text-center py-16 space-y-4">
          <FileText className="size-9 mx-auto text-primary"/>
          <p>{failure || formatted.data?.error_message || (formatted.isError?t("formatFailed"):t("formattedNotReady"))}</p>
          <Button onClick={()=>prepare()} disabled={busy || formatted.isLoading}>{busy?<Loader2 className="size-4 animate-spin"/>:<RefreshCw className="size-4"/>}{busy?t("formatting"):t("formatPage")}</Button>
          {roles.includes("admin") && (failure || formatted.data?.status === "error") && <Button variant="outline" disabled={busy} onClick={()=>prepare(true)}>{t("regenerateEnable")}</Button>}
        </div>}
      </div>
      <div className="flex items-center justify-between border-t p-3">
        <Button variant="outline" size="sm" className="h-10" disabled={index===0 || busy} onClick={()=>{setIndex(i=>i-1);setFailure(null);}}><ArrowRight className="size-4"/>{t("previous")}</Button>
        <span className="text-sm text-muted-foreground">{t("pageCounter",{i:index+1,n:pages.length})}</span>
        <Button variant="outline" size="sm" className="h-10" disabled={index>=pages.length-1 || busy} onClick={()=>{setIndex(i=>i+1);setFailure(null);}}>{t("next")}<ArrowLeft className="size-4"/></Button>
      </div>
      {lightbox && image.data && <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out" onClick={()=>setLightbox(false)}>
        {imgError ? <Button variant="outline" disabled={image.isFetching} onClick={()=>void retryImage()}>{t("retry")}</Button> : <img src={image.data} onError={()=>void imageFailed()} alt={page?.title} className="max-w-full max-h-full object-contain rounded-md"/>}
        <Button variant="ghost" size="icon" className="size-10 absolute top-4 end-4 text-white hover:bg-white/20" aria-label={t("close")} onClick={()=>setLightbox(false)}><X className="size-5"/></Button>
      </div>}
    </DialogContent>
  </Dialog>;
}
