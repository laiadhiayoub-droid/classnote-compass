# Notebook implementation
- [x] Import image-to-answers analysis prompt, Arabic Markdown normalization and text analysis into formatted notebooks; retain existing diagram reconstruction, renderer, reader layout and timers. Eight text-pipeline regression tests pass; build OK.
- [ ] Verify live formatted generation/readback with a source notebook (blocked: the available signed-in student library contains zero notebooks and has no formatted-reading permission; no sample records added).
- [x] Upgrade student directory cards and secure profile fields; exclude hidden and banned accounts in the directory RPC.
- [x] Add required student profile completion and anytime profile editing.
- [x] Add persistent admin registration alerts and full student profile/role editing.
- [x] Test profile completion, optional links and age rules; verify admin save/reload, restore original data, profile settings, directory cards, mobile dialog and alert review/dismissal; all 52 tests pass.
- [ ] Verify first-login completion and new-registration trigger with a real new student (blocked: no new student sign-in); database privacy rollback regression retained in src/test/student-profile.sql, but sandbox lacks authenticated RPC execution permissions.
- [x] Add first-time student tour with per-user local completion; test skip/finish and inspect desktop/mobile steps using simulated student roles, without changing real accounts.
- [x] Repair private image URL renewal and bounded preview retries; verify the existing photo, download, forced failures and successful retry.
- [x] Remove directory search; verify directory on desktop/mobile without horizontal overflow.
- [x] Add admin lesson/summary previews using the shared bound reader; verify the existing lesson image from admin.
- [x] Add secure email pre-registration with verified Google name/role binding; verify admin save, reload readback and cancellation.
- [ ] Verify actual new Google-account preset binding (blocked: no new student sign-in; rollback SQL checks cannot run under the sandbox connection's restricted permissions). Regression SQL is retained in src/test/email-preregistration.sql for a privileged test runner.
- [x] Separate notebook-only home content from summaries, including opened notebooks; retain summary reading from its own view.
- [x] Replace suggestion popup with a dedicated labelled navigation page.
- [x] Add protected non-hidden student directory and student-readable suggestion threads.
- [x] Test content separation and access gating; verify signed-in suggestion saving/readback/deletion and layouts at 949px and 390px.
- [ ] Verify hidden-directory and banned-access end-to-end as a regular student (blocked: only the primary admin account exists; no sample accounts requested).
- [x] Reconstruct source experiments as safe, responsive SVG diagrams.
- [x] Bind multiple uploaded photos as ordered pages and add page navigation.
- [x] Add admin-managed subscriber membership and protected formatted documents.
- [x] Generate formatted pages preserving source structure and colors.
- [ ] Verify grant/revoke and locked reading with a non-admin account (blocked: only the primary admin exists).

# Comprehensive UI/UX enhancements
- [x] Fix icon/text overlap in modal headers (RTL close X padding).
- [x] Summaries section: dashboard button, dedicated view, subject pill filter bar.
- [x] All students can submit summaries (RLS + storage policies); author name on summary cards.
- [x] Bookmarks: star toggle on lessons/summaries + "مفضلاتي" view (bookmarks table with RLS).
- [x] Admin delete for lessons/summaries with confirmation dialog.
- [x] Filter drawer: student filter removed, درس renamed كراس, semester + unit dropdowns.
- [x] In-notebook grouping by semester then unit.
- [x] Shareable link copy (?lesson=<id> deep link) + image lightbox on click.
- [x] Download button uses fetch-blob direct download.

# Header, image tools & OCR
- [x] Home tab + clickable logo reset filters.
- [x] Dark/light toggle and language menu (ar/es/en/fr for header & nav).
- [x] Auto-enhance + WebP compression; crop/rotate/contrast/cleanup editor.
- [x] Browser OCR auto-fill of unit/domain (editable).

# Uploaded platform updates
- [x] Simplify student summaries and store optional descriptions/resource links.
- [x] Reorder uploads and bind grouped pages into one card.
- [x] Translate interface controls in four languages, including upload placeholders.
- [x] Verify existing image-processing checks; optimization/editing remain available.
- [x] Add admin-only suggestions and admin student-list toggle.
- [x] Add standalone hidden role with enforced identity privacy and fail-closed author filtering.
- [x] Verify signed-in optional-link controls, suggestion submission/admin readback/deletion, student-list toggle, and phone layout without horizontal overflow.
- [ ] Verify actual notebook publishing and student-only permissions (blocked: no source photos or non-admin student account; old-data import deferred).
- [x] Skip old-data import for now, as requested; do not add sample lessons or student accounts.
