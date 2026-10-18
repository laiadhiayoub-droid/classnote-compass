# Notebook implementation
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
- [ ] Simplify student summaries and store optional descriptions/resource links.
- [ ] Reorder uploads and bind grouped pages into one card.
- [ ] Translate the full interface in four languages.
- [ ] Verify existing automatic image optimization/editing.
- [ ] Add private suggestions and admin student-list toggle.
- [ ] Add standalone hidden role with enforced identity privacy.
- [ ] Verify authenticated flows and mobile layouts; clean temporary content.
