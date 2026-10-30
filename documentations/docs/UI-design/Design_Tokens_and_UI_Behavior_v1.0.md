# SaaS POS Cloud — Design Tokens & UI Behavior Standard

**Document ID:** SEC-DS-001  
**Version:** 1.0.0  
**Status:** Design foundation  
**Last updated:** 2026-10-27  
**Figma file:** https://www.figma.com/design/UcUf20X4qLOlrf8BSIIyGz

## 1. Purpose and design principles

This standard defines the visual language and interaction rules for SaaS POS Cloud, a multi-tenant ecommerce management SaaS platform. The interface should feel premium, clear, trustworthy, calm, and efficient for all user.

Principles:
1. Clarity before decoration.
2. Use semantic tokens rather than hard-coded component values.
3. Make tenant and institution scope explicit.
4. Accessible by default: keyboard support, visible focus, readable contrast.
5. Define loading, empty, success, error, offline/stale, and forbidden states.
6. Never present fabricated institutions, learners, grades, payments, or other operational records as real data.
7. Never show an operation as saved until the server confirms persistence.

## 2. Token architecture

Use three layers:
- **Primitive tokens:** raw colors and numeric foundations.
- **Semantic tokens:** purpose-based names such as `text/primary` and `bg/surface`.
- **Component tokens:** optional mappings for specific controls, derived from semantic tokens.

### Naming

Use slash-separated names in Figma and kebab-case CSS variables in code.

| Figma token | CSS custom property |
|---|---|
| `bg/canvas` | `--light-bg-canvas` / `--dark-bg-canvas` |
| `text/primary` | `--light-text-primary` / `--dark-text-primary` |
| `spacing/4` | `--spacing-4` |
| `radius/md` | `--radius-md` |
| `duration/fast` | `--duration-fast` |

### Figma collection note

The current Starter-plan file uses separate one-mode collections for Light and Dark:
- `Primitives`
- `Color / Light`
- `Color / Dark`
- `Spacing & Shape`
- `Motion`

If multi-mode collections become available, the two semantic color collections can be consolidated into one collection with Light and Dark modes.

## 3. Primitive color palette

| Token | Hex |
|---|---|
| `white/0` | `#FFFFFF` |
| `black/1000` | `#0B1020` |
| `navy/950` | `#10172A` |
| `navy/900` | `#17213A` |
| `navy/800` | `#202D4A` |
| `navy/700` | `#2C3A5A` |
| `slate/50` | `#F8FAFC` |
| `slate/100` | `#F1F5F9` |
| `slate/200` | `#E2E8F0` |
| `slate/300` | `#CBD5E1` |
| `slate/400` | `#94A3B8` |
| `slate/500` | `#64748B` |
| `slate/600` | `#475569` |
| `slate/700` | `#334155` |
| `slate/800` | `#1E293B` |
| `slate/900` | `#0F172A` |
| `blue/50` | `#EFF6FF` |
| `blue/100` | `#DBEAFE` |
| `blue/300` | `#93C5FD` |
| `blue/500` | `#3B82F6` |
| `blue/600` | `#2563EB` |
| `blue/700` | `#1D4ED8` |
| `teal/50` | `#F0FDFA` |
| `teal/500` | `#14B8A6` |
| `teal/600` | `#0D9488` |
| `green/50` | `#F0FDF4` |
| `green/600` | `#16A34A` |
| `amber/50` | `#FFFBEB` |
| `amber/600` | `#D97706` |
| `red/50` | `#FEF2F2` |
| `red/600` | `#DC2626` |
| `crimson/50` | `#FFF1F2` |
| `crimson/600` | `#E11D48` |
| `purple/50` | `#FAF5FF` |
| `purple/600` | `#9333EA` |

## 4. Semantic color roles

These are the initial mappings. Test actual foreground/background combinations for WCAG contrast before production.

| Semantic token | Light | Dark | Usage |
|---|---|---|---|
| `bg/canvas` | `slate/50` | `navy/950` | App background |
| `bg/surface` | `white/0` | `navy/900` | Cards, forms, panels |
| `bg/surface-raised` | `white/0` | `navy/800` | Popovers, elevated surfaces |
| `bg/subtle` | `slate/100` | `navy/800` | Secondary surface |
| `bg/brand` | `blue/600` | `blue/500` | Primary action |
| `bg/brand-hover` | `blue/700` | `blue/300` | Hover; verify foreground contrast |
| `bg/selected` | `blue/50` | `navy/700` | Selected item |
| `bg/success` | `green/50` | `green/50` | Success surface |
| `bg/warning` | `amber/50` | `amber/50` | Warning surface |
| `bg/danger` | `red/50` | `red/50` | Error surface |
| `bg/critical` | `crimson/50` | `crimson/50` | Critical/destructive emphasis |
| `text/primary` | `slate/900` | `slate/50` | Main content |
| `text/secondary` | `slate/600` | `slate/300` | Supporting content |
| `text/muted` | `slate/500` | `slate/400` | Metadata |
| `text/inverse` | `white/0` | `navy/950` | Text on inverse surfaces |
| `text/brand` | `blue/700` | `blue/300` | Links and brand emphasis |
| `text/success` | `green/600` | `green/600` | Success message/icon |
| `text/warning` | `amber/600` | `amber/600` | Warning message/icon |
| `text/danger` | `red/600` | `red/600` | Error message/icon |
| `border/default` | `slate/200` | `navy/700` | Standard borders |
| `border/strong` | `slate/300` | `slate/500` | Strong boundaries |
| `border/focus` | `blue/600` | `blue/300` | Focus ring |
| `border/danger` | `red/600` | `red/600` | Invalid field |
| `icon/primary` | `slate/700` | `slate/100` | Main icons |
| `icon/secondary` | `slate/500` | `slate/400` | Supporting icons |
| `icon/brand` | `blue/600` | `blue/300` | Brand/action icons |

Color rules:
- Keep neutral surfaces dominant; use color to communicate meaning.
- Reserve crimson/red for destructive actions and critical errors.
- Pair status colors with text and/or icons; never use color alone.
- Verify dark-theme status colors and hover colors against their actual backgrounds.
- Do not assume contrast compliance from token names; measure real combinations.

## 5. Typography

**Typeface:** Inter.

| Style | Weight | Size | Line height | Usage |
|---|---|---:|---:|---|
| `display/lg` | Bold | 40 px | 48 px | Major page statement |
| `heading/h1` | Bold | 32 px | 40 px | Page title |
| `heading/h2` | Bold | 28 px | 36 px | Main section |
| `heading/h3` | Semi Bold | 24 px | 32 px | Subsection |
| `heading/h4` | Semi Bold | 20 px | 28 px | Panel heading |
| `title/lg` | Semi Bold | 18 px | 26 px | Card/dialog title |
| `title/md` | Semi Bold | 16 px | 24 px | Compact title |
| `body/lg` | Regular | 16 px | 26 px | Prominent body copy |
| `body/md` | Regular | 14 px | 22 px | Default content |
| `body/sm` | Regular | 13 px | 20 px | Dense supporting text |
| `label/md` | Medium | 13 px | 18 px | Form label |
| `label/sm` | Semi Bold | 12 px | 16 px | Table/compact label |
| `caption` | Regular | 12 px | 16 px | Metadata |
| `overline` | Semi Bold | 11 px | 14 px | Short category label |

Typography rules:
- Use sentence case for titles, buttons, menus, and helper text.
- Use captions only for secondary information, not critical instructions.
- Use tabular numerals for finance and analytics values where supported.
- Keep paragraph line lengths comfortable and avoid ad hoc font sizes.

## 6. Spacing, shape, and dimensions

### Spacing scale

| Token | Value |
|---|---:|
| `spacing/0` | 0 px |
| `spacing/1` | 4 px |
| `spacing/2` | 8 px |
| `spacing/3` | 12 px |
| `spacing/4` | 16 px |
| `spacing/5` | 20 px |
| `spacing/6` | 24 px |
| `spacing/8` | 32 px |
| `spacing/10` | 40 px |
| `spacing/12` | 48 px |

Use 4 px as the micro-step and 8 px as the main spacing rhythm.

### Radius scale

| Token | Value |
|---|---:|
| `radius/none` | 0 px |
| `radius/xs` | 4 px |
| `radius/sm` | 6 px |
| `radius/md` | 10 px |
| `radius/lg` | 14 px |
| `radius/xl` | 20 px |
| `radius/2xl` | 28 px |
| `radius/full` | 999 px |

### Common dimensions

| Token | Value | Usage |
|---|---:|---|
| `size/icon-sm` | 16 px | Dense inline icon |
| `size/icon-md` | 20 px | Standard icon |
| `size/icon-lg` | 24 px | Prominent icon |
| `size/control-sm` | 32 px | Compact control |
| `size/control-md` | 40 px | Standard control |
| `size/control-lg` | 48 px | Touch-friendly control |
| `size/sidebar-expanded` | 264 px | Desktop sidebar |
| `size/sidebar-collapsed` | 76 px | Desktop icon rail |
| `size/topbar` | 64 px | Desktop top bar |
| `layout/content-max` | 1440 px | Maximum content width |

### Responsive guidance

- Mobile: below 640 px
- Tablet: 640–1023 px
- Desktop: 1024–1439 px
- Wide desktop: 1440 px and above

Use a 12-column grid for wide desktop pages as appropriate, starting with 24 px gutters. Aim for 40–48 px primary controls and touch targets. Validate breakpoints against real pages and content.

## 7. Elevation

| Token | Initial treatment | Usage |
|---|---|---|
| `shadow/sm` | 1 px y / 3 px blur / low opacity | Small floating elements |
| `shadow/md` | 4 px y / 12 px blur / low opacity | Menus and popovers |
| `shadow/lg` | 12 px y / 28 px blur / moderate opacity | High-elevation overlays |

Shadows communicate elevation; they do not replace clear borders or surface contrast.

## 8. Motion and transitions

| Token | Duration | Use |
|---|---:|---|
| `duration/instant` | 100 ms | Tiny feedback changes |
| `duration/fast` | 160 ms | Hover and color changes |
| `duration/standard` | 220 ms | Common transitions |
| `duration/slow` | 320 ms | Larger panel transitions |
| `duration/overlay` | 240 ms | Dialog/backdrop |

Behavior:
- Hover: 120–160 ms color/elevation transition.
- Press: 100–160 ms; optional subtle scale to 0.98 for tactile controls.
- Focus-visible: immediate 2 px ring with about 2 px offset.
- Popover/menu: 160–240 ms opacity plus 4–8 px movement.
- Drawer/modal: 220–320 ms; animate backdrop separately.
- Loading: use stable skeletons or inline progress; avoid unnecessary flashing.
- Background refresh: keep existing data visible when safe.

Respect `prefers-reduced-motion`. Remove travel and scale animations where possible and use immediate changes or subtle opacity. Motion must not be required to understand state.

## 9. Navigation architecture

### Application shell
1. **Sidebar:** role-aware navigation and expandable groups.
2. **Top bar:** current scope, page context, search where relevant, notifications, help, and account menu.
3. **Main content:** title, primary actions, filters, and content.
4. **Contextual panel:** only where it improves the task.

### Suggested navigation groups
- Overview
- Institutions
- People & Roles
- Academics
- Timetable
- Attendance
- Admissions & Enrolment
- Fees & Billing
- Finance
- Reports & Insights
- Settings

Visibility must depend on role, subscription entitlements, institution type, and enabled modules.

### Navigation states
Default, hover, focus-visible, active/current route, expanded/collapsed, disabled, loading, and useful notification counts. Combine active background, icon/text treatment, and semantics such as `aria-current="page"`; do not rely on color alone.

### Responsive behavior
- Desktop: 264 px expanded sidebar, 76 px collapsed rail, 64 px top bar.
- Tablet: dismissible sidebar drawer.
- Mobile: compact top bar and role-aware navigation drawer.
- On drawer close, restore focus to the trigger.
- Icon-only navigation must have accessible names and tooltips.

### Tenant scope
- Show the active organization/institution scope clearly.
- Changing scope must refresh tenant-dependent data, navigation, and breadcrumbs.
- Never silently mix institution records.
- Never trust a client-supplied tenant ID as authorization.
- Resolve and enforce membership and scope on the server.
- For unauthorized deep links, show an access-denied state without leaking another tenant's records.

## 10. Component interaction states

Define these states wherever applicable:

| State | Expected behavior |
|---|---|
| Default | Clear label and expected action |
| Hover | Subtle feedback; not the only cue |
| Focus-visible | Strong keyboard focus indicator |
| Pressed | Immediate tactile response |
| Selected | Persistent and distinguishable from hover |
| Disabled | Clearly unavailable; explain why if not obvious |
| Loading | Show progress and prevent unsafe duplicate submissions |
| Success | Confirm only after server confirmation |
| Error | Explain issue and recovery path |
| Empty | Explain absence and next valid action |
| Read-only | Make non-editable state clear |
| Stale/offline | Show last sync and queued/unavailable action status |

## 11. Data states and UI behavior

Every data-driven page must define relevant loading, empty, success, error, partial, stale/offline, and forbidden states.

### Loading
- Preserve page structure.
- Use skeletons matching the final layout when useful.
- Use inline spinners for short actions.
- Use determinate progress when total work is known.
- Avoid blanking the whole page for a small update.

### Empty
- Explain what is missing and, when known, why.
- Offer the next valid action.
- Do not seed fake business data.
- Do not show creation actions to users without permission.

### Success
- Confirm only after the server reports success.
- Update the record and dependent counts after confirmation.
- Use concise toasts for low-risk operations and inline confirmation for important workflows.

### Error
- Use plain language and explain next steps.
- Preserve valid form input.
- Distinguish validation, permission, connectivity, conflict, and server errors.
- Offer retry only when safe.
- Never expose stack traces, secrets, or sensitive tenant information.

### Stale/offline
- Show last synchronization time.
- Distinguish cached/read-only data from unsynchronized changes.
- Never claim an offline write is server-saved.
- Show queued changes and provide a retry/sync path.
- Resolve conflicts explicitly rather than silently overwriting newer data.

### Forbidden
- Explain that the current account lacks permission.
- Offer an access-request path where appropriate.
- Do not reveal whether another tenant owns the requested record.
- Enforce permissions on the server, even if the UI hides routes.

### Partial data
Keep successful sections visible and identify failed sections. Offer targeted retries where possible.

## 12. Forms, tables, and analytics

### Forms
- Place labels above fields by default.
- Mark required fields clearly.
- Validate after blur and on submit; avoid aggressive errors while typing.
- Associate errors programmatically with fields.
- Preserve valid values after server errors.
- Prevent duplicate submissions where appropriate.
- Show Saving/Saved/Failed for autosave.
- Handle concurrent edits and conflicts.
- Normalize input without silently changing legitimate user intent.
- Server-side validation and authorization are mandatory.

### Tables and lists
- Align numeric values consistently; right-align numeric columns where appropriate.
- Use tabular numerals for finance/analytics where supported.
- Show sort direction, visible filters, and removable filter chips.
- Show an actionable empty result when filters match nothing.
- Use pagination or virtualization for large data sets.
- Report visible range and total when known.
- Plan horizontal overflow on small screens intentionally.

### Finance and academic data
- Use decimal-safe backend calculations; JavaScript floating-point arithmetic must not be authoritative for money.
- Display currency consistently and include currency code when ambiguous.
- Distinguish draft, posted, overdue, reversed, and reconciled records.
- Correct posted accounting entries through approved reversal/correction workflows.
- Distinguish missing, not assessed, exempt, absent, and zero academic values.
- Enforce permissions for reports and exports.

### Analytics
- Identify the period, filters, and scope behind each metric.
- Label estimates and AI-generated insights.
- Never fabricate trends, counts, comparisons, or sample transactions in production.
- Restrict analytical queries to authorized data.

## 13. Dialogs and destructive actions

- Use dialogs for decisions requiring focused attention.
- Give every dialog a clear title and specific primary action.
- Support Escape where safe, trap focus in modals, and restore focus on close.
- Confirm irreversible actions with the object and consequence.
- Prefer archive/soft-delete where policy permits.
- Reserve crimson/red for destructive and critical actions.
- Consider re-authentication for sensitive operations.
- Do not imply a payment, deletion, cancellation, or submission succeeded until the server confirms it.

## 14. AI assistance UI

- Label AI-generated recommendations and summaries.
- State the reporting period and authorized data sources.
- Communicate uncertainty; do not present predictions as facts.
- Require human confirmation for consequential actions.
- Do not allow arbitrary model-generated SQL to bypass authorization.
- Never expose another institution's data through prompts or summaries.
- Provide a fallback when AI is unavailable.
- Do not invent operational records to make dashboards appear populated.

## 15. Accessibility

Target WCAG 2.2 AA as the baseline, subject to implementation testing.

- Maintain sufficient contrast for text, icons, controls, borders, and focus.
- Support keyboard navigation across menus, dialogs, forms, and tables.
- Use semantic HTML and accessible names for icon-only controls.
- Associate labels, helper text, and errors with form fields.
- Announce dynamic status updates when appropriate.
- Do not rely on color, sound, animation, or position alone.
- Support zoom and narrow viewports without losing essential actions.
- Respect reduced-motion settings.
- Test with keyboard-only use and representative screen-reader workflows.

Measure contrast on actual combinations; token names alone do not prove compliance.

## 16. CSS implementation starter

This is a starter mapping, not a complete export. Verify values against Figma and test contrast before production.

```css
:root {
  --font-family-sans: "Inter", system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;

  --spacing-0: 0;
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 999px;

  --duration-instant: 100ms;
  --duration-fast: 160ms;
  --duration-standard: 220ms;
  --duration-slow: 320ms;
  --duration-overlay: 240ms;

  --light-bg-canvas: #f8fafc;
  --light-bg-surface: #ffffff;
  --light-bg-subtle: #f1f5f9;
  --light-bg-brand: #2563eb;
  --light-text-primary: #0f172a;
  --light-text-secondary: #475569;
  --light-text-muted: #64748b;
  --light-text-brand: #1d4ed8;
  --light-border-default: #e2e8f0;
  --light-border-focus: #2563eb;

  --color-bg-canvas: var(--light-bg-canvas);
  --color-bg-surface: var(--light-bg-surface);
  --color-bg-subtle: var(--light-bg-subtle);
  --color-bg-brand: var(--light-bg-brand);
  --color-text-primary: var(--light-text-primary);
  --color-text-secondary: var(--light-text-secondary);
  --color-text-muted: var(--light-text-muted);
  --color-text-brand: var(--light-text-brand);
  --color-border-default: var(--light-border-default);
  --color-border-focus: var(--light-border-focus);
}

[data-theme="dark"] {
  --color-bg-canvas: #10172a;
  --color-bg-surface: #17213a;
  --color-bg-subtle: #202d4a;
  --color-bg-brand: #3b82f6;
  --color-text-primary: #f8fafc;
  --color-text-secondary: #cbd5e1;
  --color-text-muted: #94a3b8;
  --color-text-brand: #93c5fd;
  --color-border-default: #2c3a5a;
  --color-border-focus: #93c5fd;
}

body {
  font-family: var(--font-family-sans);
  background: var(--color-bg-canvas);
  color: var(--color-text-primary);
}

:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Implementation requirements:
- The CSS snippet is not a full token export.
- Do not ship the dark theme until the full semantic palette has been reviewed.
- Prefer one centralized theme provider or root `data-theme` attribute.
- Avoid duplicating token values across components or stylesheets.
- If using CSS Modules or a utility framework, map these semantic names into it rather than creating a competing palette.

## 17. Definition of done for UI components

- [ ] Uses semantic tokens instead of arbitrary values.
- [ ] Defines relevant default, hover, focus-visible, pressed, disabled, loading, success, and error states.
- [ ] Keyboard interaction and accessible naming work.
- [ ] Contrast and focus visibility have been checked.
- [ ] Relevant loading, empty, error, offline/stale, and forbidden states are implemented.
- [ ] Works on mobile, tablet, desktop, and wide layouts.
- [ ] Does not expose unauthorized tenant data or actions.
- [ ] Distinguishes server-confirmed success from pending/failed requests.
- [ ] Respects reduced-motion settings.
- [ ] Automated tests cover meaningful interaction and error paths.
- [ ] Introduces no fabricated production business data.
- [ ] Figma and implementation remain consistent.

## 18. Governance

- Add or change tokens centrally; avoid one-off values.
- Record why new semantic tokens are needed.
- Update Figma, CSS mappings, component docs, and tests together.
- Treat public token names as an implementation contract.
- Review changes in both Light and Dark themes.
- Review accessibility, responsive behavior, and tenant-scope implications for shared components.
- Keep this document versioned alongside source code.

## 19. Figma inventory

The connected Figma file includes a `Foundations & UI Behavior` page with color specimens, typography specimens, navigation example, interaction states, data-state cards, layout guidance, and implementation notes.

Current reported inventory:
- 5 variable collections
- 120 variables
- 14 text styles
- 3 effect styles

**Figma file:** https://www.figma.com/design/UcUf20X4qLOlrf8BSIIyGz

These counts describe the Figma file; they do not mean the application already consumes all tokens or implements every behavior.
