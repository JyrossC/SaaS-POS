# Design System

This platform should have a premium, enterprise-ready visual language that feels polished without becoming visually noisy or over-designed.

## Design direction

- restrained luxury aesthetic
- strong typography hierarchy
- clean spacing system
- minimal but intentional accent color usage
- accessible contrast, clarity, and labeling

## Brand palette

| Purpose | Color | Hex |
|---|---|---|
| Primary brand | Deep Burgundy | `#701C35` |
| Primary hover | Dark Burgundy | `#571429` |
| Main background | Soft Ivory | `#FAF9F6` |
| Card background | Pure White | `#FFFFFF` |
| Main text | Charcoal | `#24242B` |
| Secondary text | Slate Gray | `#6B7280` |
| Borders | Warm Gray | `#E7E2E3` |
| Success | Deep Green | `#18794E` |
| Warning | Amber | `#B7791F` |
| Danger | Crimson | `#C6283D` |
| Information | Deep Blue | `#2457A7` |

Use burgundy for key actions and brand emphasis. Use crimson only for destructive or high-risk actions.

## CSS tokens

```css
:root {
  --color-brand: #701c35;
  --color-brand-hover: #571429;
  --color-background: #faf9f6;
  --color-surface: #ffffff;
  --color-text-primary: #24242b;
  --color-text-secondary: #6b7280;
  --color-border: #e7e2e3;
  --color-success: #18794e;
  --color-warning: #b7791f;
  --color-danger: #c6283d;
  --color-info: #2457a7;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  --shadow-card: 0 2px 8px rgb(36 36 43 / 5%);
}
```

## Typography

Recommended font pairing:

- Headings: Manrope
- Body and UI: Inter
- Financial tables: Inter with tabular numerals

Use a restrained set of weights:

- 400 Regular
- 500 Medium
- 600 Semibold
- 700 Bold

## Layout principles

- Fixed or collapsible sidebar
- Clear page titles and consistent gutters
- Compact tables with readable spacing
- Predictable modal structures
- Responsive layouts across desktop, tablet, and mobile
- Clear action hierarchy with primary, secondary, and destructive states

## Component guidance

Use reusable primitives for:

- buttons
- inputs and forms
- tables
- cards
- modals
- alerts
- pagination
- status badges

Each component should support loading, success, empty, and error states.

## POS-specific guidance

POS screens should prioritize:

- high-speed checkout
- keyboard-friendly flows
- focused actions
- minimal cognitive load
- clear item totals and payment state

## Accessibility

- ensure sufficient contrast ratios
- provide focus styles for all interactive elements
- support keyboard navigation
- avoid color-only meaning for states
- keep labels clear for forms and destructive actions

## Implementation checklist

- [ ] Design tokens are centralized
- [ ] Components reuse the same visual language
- [ ] Empty states are readable and actionable
- [ ] POS screens remain fast and focused
- [ ] Accessible contrast and focus states are maintained
