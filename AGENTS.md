<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Store formatted notebook documents separately from ordinary lesson metadata with subscriber/admin SELECT RLS; never return generated content from the publishing endpoint to writers.
- Generate one source page per authenticated server request and render validated structured blocks, not arbitrary HTML, to keep source formatting safe and retries page-scoped.
- Formatted text uses the image-to-answers analysis prompt and Markdown normalization through the AI Gateway SDK; retain the existing separate validated diagram reconstruction and reader layout so importing text logic cannot replace diagram presentation. Store analysis with the protected document and render Markdown without injected HTML or remote OCR images.
- Reconstruct notebook diagrams as validated whitelisted SVG primitives rendered by React, never injected markup; retain legacy text blocks and preserve the last ready document if an explicit admin regeneration fails.
- Bind uploaded batches using the existing root lesson/continuation relationship and deterministic page ordering to preserve existing notebooks.
- All UI text goes through the STRINGS map in `src/lib/i18n.tsx` (ar/en/fr/es) via `useI18n().t(key, vars)`; per-language subject, semester, content-type and timetable labels live in `src/lib/library.ts` and `src/lib/timetable.ts`. Never hardcode UI strings in components.
- Smart OCR lives in `src/lib/ocr.ts`; `structureOcrText` stays a pure, tested function, and photo scanning runs client-side via tesseract.js only on explicit user action.
- Uploads go through the shared `uploadPhotoRows` helper in `src/routes/index.tsx`; writers/admins use `UploadDialog`, students use the simplified `SummaryDialog`, which always merges multi-photo summaries into one grouped card.
- The `hidden` role hides a user's identity and content from everyone but themselves and admins: enforced by the lessons SELECT RLS policy plus the client-side `authorVisible` filter — never bypass either.
- Use the tested visibility predicate in publishing helpers for author filtering; unknown visibility must fail closed to avoid exposing hidden accounts during loading.
- Filter notebook covers and opened notebook pages through the shared classNotebookPages predicate so summaries cannot leak through sibling views.
- The dedicated suggestions route loads authenticated community data via a query-backed loader; its directory RPC returns shared profile fields and excludes hidden and banned accounts server-side, while suggestion SELECT policies protect hidden authors and banned viewers.
- Keep profile fields in profiles, roles in user_roles, and validate profile writes with a database trigger; use the authenticated admin profile RPC for atomic profile/role updates so students cannot escalate privileges.
- Share profile editing and completion through StudentProfileDialog; gate the student tour on completed profile fields, and create durable admin registration alerts on profile insertion rather than browser visits.
- Keep first-time tour completion scoped to the authenticated student ID in browser storage so shared devices do not suppress other students' tours.
- Keep lesson images private; use renewable signed URLs and bounded image-load retries in the shared reader so all preview surfaces share the same recovery.
- Email pre-registration is admin-managed through restricted RPCs; an auth lifecycle trigger consumes it once for verified Google accounts so user-editable metadata cannot grant roles.
- Admin lesson previews reuse the bound notebook reader and deterministic page ordering so grouped uploads remain intact.

