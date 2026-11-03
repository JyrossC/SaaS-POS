# SaaS POS Cloud — Design Tokens & UI Behavior Standard
## Design Token & UI Behavior Specification

- **Document ID:** SEC-DS-001
- **System Version**: OS v1.0 (Sovereign Hospitality Edition)
- **Specification Status**: Standard / Approved Reference Architecture
- **Standards Compliance**: W3C Design Tokens Community Group (DTCG) Draft Specification, WCAG 2.1 Level AA Accessibility Standards, Universal Frontend Design Constitution
- **Repository Path**: `docs/DESIGN_SYSTEM.md`
- **Artifact Path**: `design_tokens_and_ui_behaviors.md`

---

## Table of Contents
- [SaaS POS Cloud — Design Tokens \& UI Behavior Standard](#saas-pos-cloud--design-tokens--ui-behavior-standard)
  - [Design Token \& UI Behavior Specification](#design-token--ui-behavior-specification)
  - [Table of Contents](#table-of-contents)
  - [1. Executive Summary \& Design Philosophy](#1-executive-summary--design-philosophy)
    - [Core Tenets](#core-tenets)
  - [2. Universal Anti-Slop \& Design Constitution](#2-universal-anti-slop--design-constitution)
    - [A. Zero-Pill \& Metadata Discipline](#a-zero-pill--metadata-discipline)
    - [B. Eradication of Mechanical Clutter](#b-eradication-of-mechanical-clutter)
    - [C. Spatial Math \& Viewport Integrity](#c-spatial-math--viewport-integrity)
  - [3. Design Token System](#3-design-token-system)
    - [3.1 Color Tokens \& 60-30-10 Distribution](#31-color-tokens--60-30-10-distribution)
      - [Palette Tokens Specification Table](#palette-tokens-specification-table)
    - [3.2 Typography Tokens \& Hierarchy](#32-typography-tokens--hierarchy)
      - [Typography Scale Tokens](#typography-scale-tokens)
    - [3.3 Spatial Spacing, Sizing \& Grid Tokens](#33-spatial-spacing-sizing--grid-tokens)
      - [Structural Rules:](#structural-rules)
    - [3.4 Elevation, Surface \& Glassmorphism Tokens](#34-elevation-surface--glassmorphism-tokens)
      - [Ambient Background Lighting Tokens:](#ambient-background-lighting-tokens)
    - [3.5 Border, Radius \& Mathematical Ratios](#35-border-radius--mathematical-ratios)
      - [Nested Radius Math](#nested-radius-math)
      - [Standard Radius Scale](#standard-radius-scale)
    - [3.6 Motion, Curves \& Interaction Timing](#36-motion-curves--interaction-timing)
      - [Latency Budget Rules:](#latency-budget-rules)
      - [Cubic-Bezier Curves](#cubic-bezier-curves)
  - [4. Machine-Readable Token Exports](#4-machine-readable-token-exports)
    - [4.1 W3C DTCG Standard JSON Token Schema](#41-w3c-dtcg-standard-json-token-schema)
    - [4.2 Tailwind CSS Theme Extension Object](#42-tailwind-css-theme-extension-object)
    - [4.3 Native CSS Custom Properties (:root)](#43-native-css-custom-properties-root)
    - [4.4 TypeScript Token Interfaces \& Design Dictionary Schema](#44-typescript-token-interfaces--design-dictionary-schema)
  - [5. Exhaustive UI Behavioral Specifications](#5-exhaustive-ui-behavioral-specifications)
    - [5.1 Multi-Step Platform Installation Wizard (If decided for implementation)](#51-multi-step-platform-installation-wizard-if-decided-for-implementation)
      - [Step Behavior Matrix](#step-behavior-matrix)
    - [5.2 Modals, Drawers \& Floating Glass Docks](#52-modals-drawers--floating-glass-docks)
      - [Modal Dialogue Choreography](#modal-dialogue-choreography)
      - [Floating Sidebar Glass Dock (Layout.tsx)](#floating-sidebar-glass-dock-layouttsx)
    - [5.3 Form Controls, Validation \& Live Feedback](#53-form-controls-validation--live-feedback)
      - [Input Field Behavioral States](#input-field-behavioral-states)
    - [5.4 Micro-Interactions, Hover Mechanics \& Latency Budgets](#54-micro-interactions-hover-mechanics--latency-budgets)
      - [Button Press \& Hover Physics](#button-press--hover-physics)
    - [5.5 Toast Notifications \& Real-Time Alerts](#55-toast-notifications--real-time-alerts)
  - [6. Component Pattern Catalog \& Implementation Guide](#6-component-pattern-catalog--implementation-guide)
    - [A. Segmented Tab Filter (Interactive Button Group)](#a-segmented-tab-filter-interactive-button-group)
    - [B. Glassmorphic Luxury Property Card](#b-glassmorphic-luxury-property-card)
  - [7. Governance, Audit \& Verification Checklist](#7-governance-audit--verification-checklist)

---

## 1. Executive Summary & Design Philosophy

The SaaS POS Cloud — Design Tokens & UI Behavior Standard design system bridges ultra-luxury hospitality elegance with sovereign cloud-native administrative rigor. Unlike generic SaaS interfaces that rely on predictable templates or toy-like gamified badges, SaaS POS Cloud evokes the quiet confidence, dark atmospheric depth, and bespoke tactile craftsmanship of a five-star private estate.

### Core Tenets
1. **Sovereign Dark Atmosphere**: Backgrounds are grounded in nocturnal obsidian (`#000000`, `#050505`) and muted charcoal (`#121212`), illuminated by subtle diffused amber/gold ambient glows rather than harsh bright white surfaces.
2. **Brushed Metallic Intent**: Accent color is strictly concentrated in luxury gold tones (`#D4AF37`, `#AA8C2C`) applied with mathematical restraint (the 10% accent rule) to guide user focus to primary decisions, transactional confirmations, and executive status.
3. **Tactile Glassmorphism**: Floating panels, docks, and modal surfaces utilize high-index backdrop blurs (12px to 20px) with razor-thin hairline borders (`1px solid rgba(255, 255, 255, 0.08)`), emulating smoked crystal and brushed anodized aluminum.
4. **Single-Source Consistency**: Every interactive state, button, typography size, and surface border is derived from machine-readable tokens to eliminate drift between design prototypes, web components, and backend schemas.

---

## 2. Universal Anti-Slop & Design Constitution

To guarantee that the application remains distinctive, elegant, and production-grade, the design system enforces strict anti-pattern prohibitions across all views:

### A. Zero-Pill & Metadata Discipline
- **Prohibition on Static Pill Badges**: Never wrap static metadata (such as categories, tags, dates, publication timestamps, counts, room statuses, or read times) in rounded pill boxes, bordered capsules, or colorful candy chips.
- **Clean Typographic Formatting**: All informational metadata must be rendered as clean, unboxed text separated by subtle typographic characters (`·`, `/`, `-`).
  - *Incorrect*: `<span className="bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 text-xs">Deluxe Suite</span>`
  - *Correct*: `<div className="flex items-center gap-2 text-xs text-gray-400"><span>Bossy Premium</span><span aria-hidden="true">·</span><span>450 sq ft</span><span aria-hidden="true">·</span><span>Oceanfront</span></div>`
- **Interactive Controls vs. Static Metadata**: Functional controls that trigger state changes or filtering when clicked (e.g., segmented controls, room status filters) are explicit button elements (`<button>`) styled as unified segmented groups, never standalone floating pill tags.

### B. Eradication of Mechanical Clutter
- **No Code-Comment Headers**: Prohibit prefixing section headers with comment syntax (`//`, `/* */`, `>_`, `#`) or mechanical snake_case identifiers (`// 01_SUITES_AVAILABLE`). Use title-cased editorial headers.
- **Natural Editorial Numbering**: Curated multi-step processes use dignified editorial numerals (`01. Security Handshake`, `02. Super Administrator Credentials`), never simulated terminal prompts (`>_ STEP_01`).
- **No Hallucinated Telemetry or Scorecards**: Prohibit arbitrary single-number AI scores (e.g. `98/100 WELLNESS SCORE`) or fake engine tickers pinned to the bottom of the viewport (`STATUS: ONLINE // LATENCY: 1.2ms`) unless representing real streaming telemetry.
- **Human Functional Verbs**: Buttons use crisp, unambiguous verbs (`"Proceed to Authentication"`, `"Save Gateway Settings"`, `"Verify Credentials"`, `"Reserve Suite"`). Roleplay jargon (`"Invoke Sovereign Portal"`, `"Engage Alchemical Matrix"`) is strictly prohibited.

### C. Spatial Math & Viewport Integrity
- **Single-Elevation Depth**: Strict ban on nested "cards within cards". Content hierarchy is established via generous whitespace (2rem–3rem), subtle surface background deltas ($\le 12\%$), and hairline dividers (`1px solid rgba(255, 255, 255, 0.06)`).
- **Nested Radius Rule**: Whenever a nested container sits inside a padded parent container:
  $$r_{\text{inner}} = r_{\text{outer}} - \text{padding}$$
- **Button Padding Ratio**: Horizontal padding is approximately double the vertical padding (`py-2 px-4` or `py-3 px-6`).

---

## 3. Design Token System

### 3.1 Color Tokens & 60-30-10 Distribution

The palette is allocated according to the classical 60-30-10 interior architecture distribution rule:
- **60% Dominant Neutral Canvas**: Obsidian Black (`#000000`, `#050505`) and Dark Charcoal (`#121212`).
- **30% Structural Surfaces**: Smoked Glass (`rgba(20, 20, 20, 0.6)`), Translucent Hairline Borders (`rgba(255, 255, 255, 0.08)`), and Antique Cream body text (`#F5F5F0`).
- **10% Accent Intent**: Brushed Metallic Gold (`#D4AF37`, `#AA8C2C`) and purposeful semantic state indicators.

#### Palette Tokens Specification Table

| Token Identifier | Hex / CSS Value | RGB Channels | Role & Semantic Intent | WCAG AA Contrast on #000000 |
| :--- | :--- | :--- | :--- | :--- |
| `color.luxury.gold` | `#D4AF37` | `212, 175, 55` | Primary brand accent, primary CTA, active navigation, focus halo | 9.8:1 (Pass AAA) |
| `color.luxury.gold-dim`| `#AA8C2C` | `170, 140, 44` | Hover accent, secondary gold icons, subtle borders | 6.5:1 (Pass AA) |
| `color.luxury.gold-light`| `#F5E6BE` | `245, 230, 190` | High-light gold gradient top-stop, VIP insignia highlight | 14.2:1 (Pass AAA) |
| `color.luxury.gold-dark` | `#705915` | `112, 89, 21` | Depressed/active button background, dark badge trim | 3.1:1 (Structural) |
| `color.luxury.gold-glow` | `rgba(212, 175, 55, 0.15)` | `212, 175, 55, 0.15` | Focus rings, backdrop aura, ambient light source | N/A (Atmospheric) |
| `color.luxury.black` | `#050505` | `5, 5, 5` | Surface panel backgrounds, nested card backing | N/A (Canvas) |
| `color.luxury.charcoal`| `#121212` | `18, 18, 18` | Elevated card fill, inputs, sidebar docking fill | N/A (Surface) |
| `color.luxury.charcoal-elevated`| `#1C1C1E` | `28, 28, 30` | Hovered rows, floating dropdowns, popover containers | N/A (Surface) |
| `color.luxury.cream` | `#F5F5F0` | `245, 245, 240` | Primary readable prose, high-contrast headings | 18.5:1 (Pass AAA) |
| `color.luxury.muted` | `#94A3B8` | `148, 163, 184` | Secondary text, field labels, inactive tabs | 7.3:1 (Pass AA) |
| `color.luxury.hairline`| `rgba(255, 255, 255, 0.08)` | `255, 255, 255, 0.08` | Structural bounding lines, table dividers, panel rims | N/A (Hairline) |
| `color.semantic.emerald`| `#10B981` | `16, 185, 129` | Confirmed bookings, system verified, nominal DB status | 8.2:1 (Pass AAA) |
| `color.semantic.amber` | `#F59E0B` | `245, 158, 11` | Pending settlement, system uninstalled, warnings | 9.4:1 (Pass AAA) |
| `color.semantic.crimson`| `#EF4444` | `239, 68, 68` | Critical security alert, setup route sealed, error state | 5.8:1 (Pass AA) |
| `color.semantic.purple` | `#8B5CF6` | `139, 92, 246` | Sovereign crypto ledger, Web3 escrow, Royal VIP tier | 6.1:1 (Pass AA) |

---

### 3.2 Typography Tokens & Hierarchy

The application enforces the **2+1 Typographic Rule**:
1. **Display Face (`font-serif`)**: `Playfair Display` (Latin Serif) — used for brand wordmarks, presidential suite names, and hero headlines.
2. **Interface & Prose Face (`font-sans`)**: `Inter` (Neo-Grotesque Sans) — used for all functional controls, navigation links, form labels, and body text.
3. **Data & Numerical Face (`font-mono`)**: `JetBrains Mono` with `tabular-nums` — used strictly for financial balances, room tariffs, room keys, cryptographic hashes, countdown timers, and port configurations.

#### Typography Scale Tokens

| Token | Size | Line Height | Letter Spacing | Font Family | Default Weight | Target Applications |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `type.scale.display-xl` | `clamp(2.25rem, 4vw, 3.75rem)` | `1.1` | `-0.02em` | `Playfair Display` | 700 (Bold) | Landing hero headlines, VIP arrival welcomes |
| `type.scale.display-lg` | `2.25rem (36px)` | `1.15` | `-0.015em` | `Playfair Display` | 600 (SemiBold) | Section hero titles, installer step titles |
| `type.scale.display-md` | `1.5rem (24px)` | `1.25` | `-0.01em` | `Playfair Display` | 600 (SemiBold) | Modal headings, hotel suite card titles |
| `type.scale.body-lg` | `1.125rem (18px)` | `1.5` | `0` | `Inter` | 400 (Regular) | Lead introductory paragraphs |
| `type.scale.body-base` | `1.0rem (16px)` | `1.6` | `0` | `Inter` | 400 / 500 | Standard prose, form input text, modal body |
| `type.scale.body-sm` | `0.875rem (14px)` | `1.5` | `0.01em` | `Inter` | 400 / 500 | Sidebar items, table data cells, button labels |
| `type.scale.meta-xs` | `0.75rem (12px)` | `1.4` | `0.02em` | `Inter` | 500 / 600 | Unboxed metadata, input labels, badge text |
| `type.scale.kicker-micro`| `0.625rem (10px)`| `1.2` | `0.2em` | `Inter` | 600 (SemiBold) | Uppercase subtitles (`OS v26.2`, `MEMBERSHIP`) |
| `type.scale.data-mono` | `0.875rem (14px)` | `1.4` | `0` | `JetBrains Mono` | 500 (`tabular-nums`)| Currency figures (`TSh 1,200,000`), port entries |

---

### 3.3 Spatial Spacing, Sizing & Grid Tokens

Built upon an immutable **4px Harmonic Baseline Grid**:

```
 4px    8px    12px   16px   20px   24px   32px   40px   48px   64px   80px
 ───    ───    ────   ────   ────   ────   ────   ────   ────   ────   ────
  1      2      3      4      5      6      8      10     12     16     20
```

#### Structural Rules:
- **Container Inset Principle**: Outer padding of any card or container must be strictly greater than or equal to the inner gap between its child components:
  $$\text{Padding}_{\text{outer}} \ge \text{Gap}_{\text{inner}} \quad (\text{Minimum Card Padding} = 16\text{px} \text{ / } \text{space-4})$$
- **Desktop Grid Baseline**: 1440px viewport width with 280px fixed glass sidebar and responsive fluid workspace canvas.
- **Touch Target Accessibility**: Minimum interactive touch target height is $40\text{px}$ on desktop and $44\text{px}$ on mobile (`min-h-[44px]`).

---

### 3.4 Elevation, Surface & Glassmorphism Tokens

SmartGuest employs atmospheric smoked glass rather than garish layered drop shadows.

```css
/* Glassmorphism System Specifications */
.glass-panel {
  background: rgba(20, 20, 20, 0.60);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 16px 40px 0 rgba(0, 0, 0, 0.6);
}

.glass-card {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}
```

#### Ambient Background Lighting Tokens:
- **Atmospheric Gold Glow**: `w-[50%] h-[50%] bg-luxury-gold/5 blur-[120px] rounded-full` positioned at `top-[-20%] left-[-10%]`.
- **Deep Nocturnal Ocean Glow**: `w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full` positioned at `bottom-[-20%] right-[-10%]`.

---

### 3.5 Border, Radius & Mathematical Ratios

#### Nested Radius Math
To avoid visual tension, internal elements inherit outer curvature minus the inset spacing:

```
┌──────────────────────────────────────────────┐  r_outer = 1.5rem (24px)
│   padding = 1rem (16px)                      │
│   ┌──────────────────────────────────────┐   │
│   │                                      │   │  r_inner = 24px - 16px = 8px
│   │                                      │   │  (rounded-lg)
│   └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

#### Standard Radius Scale
- `radius.sm`: `0.25rem (4px)` — Small tags, fine controls
- `radius.md`: `0.5rem (8px)` — Form inputs, standard buttons, inner cards
- `radius.lg`: `0.75rem (12px)` — Interactive modal controls, alert banners
- `radius.xl`: `1.0rem (16px)` — Standard cards, dialog boxes
- `radius.2xl`: `1.5rem (24px)` — Master feature containers, wizard stages
- `radius.full`: `9999px` — User avatars, circular icon triggers, status beacons

---

### 3.6 Motion, Curves & Interaction Timing

#### Latency Budget Rules:
- **Routine Micro-Interactions**: $\le 200\text{ms}$ execution latency. Button presses, tab switches, and hover highlights must complete within this window.
- **Modal & Drawer Revealing**: $200\text{ms} - 350\text{ms}$ with smooth deceleration curve.
- **Compositor Property Restriction**: Only animate `transform`, `opacity`, and `filter`. Animating layout geometry (`width`, `height`, `margin`, `padding`) is strictly banned.

#### Cubic-Bezier Curves
- **Standard Easing (Decel Settle)**: `cubic-bezier(0.16, 1, 0.3, 1)` — for modals, cards, floating docks.
- **Snappy Bounce**: `cubic-bezier(0.32, 0.72, 0, 1)` — for mobile drawer slide reveals.
- **Ambient Breathing**: `cubic-bezier(0.4, 0, 0.6, 1)` — for slow 4s radial glows.

---

## 4. Machine-Readable Token Exports

### 4.1 W3C DTCG Standard JSON Token Schema

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "luxury": {
      "gold": {
        "$value": "#D4AF37",
        "$type": "color",
        "$description": "Sovereign gold primary brand accent and CTA fill."
      },
      "goldDim": {
        "$value": "#AA8C2C",
        "$type": "color",
        "$description": "Muted burnished gold for secondary interactive states."
      },
      "goldLight": {
        "$value": "#F5E6BE",
        "$type": "color",
        "$description": "Champagne highlight tone for luxury gradient tops."
      },
      "black": {
        "$value": "#050505",
        "$type": "color",
        "$description": "Nocturnal surface base."
      },
      "charcoal": {
        "$value": "#121212",
        "$type": "color",
        "$description": "Elevated card and sidebar foundation."
      },
      "cream": {
        "$value": "#F5F5F0",
        "$type": "color",
        "$description": "High-contrast antique white text."
      },
      "glass": {
        "$value": "rgba(255, 255, 255, 0.05)",
        "$type": "color",
        "$description": "Subtle card translucent sheen."
      }
    },
    "semantic": {
      "success": {
        "$value": "#10B981",
        "$type": "color",
        "$description": "Verified status, confirmed suite booking, active ledger."
      },
      "warning": {
        "$value": "#F59E0B",
        "$type": "color",
        "$description": "Pending settlement, setup required, warning flag."
      },
      "danger": {
        "$value": "#EF4444",
        "$type": "color",
        "$description": "Permanent seal, critical system halt, authentication error."
      },
      "crypto": {
        "$value": "#8B5CF6",
        "$type": "color",
        "$description": "Royal VIP tier and decentralized escrow protocol."
      }
    }
  },
  "typography": {
    "fontFamily": {
      "display": {
        "$value": ["Playfair Display", "serif"],
        "$type": "fontFamily"
      },
      "body": {
        "$value": ["Inter", "sans-serif"],
        "$type": "fontFamily"
      },
      "data": {
        "$value": ["JetBrains Mono", "monospace"],
        "$type": "fontFamily"
      }
    }
  },
  "duration": {
    "instant": {
      "$value": "100ms",
      "$type": "duration"
    },
    "micro": {
      "$value": "200ms",
      "$type": "duration"
    },
    "surface": {
      "$value": "350ms",
      "$type": "duration"
    }
  },
  "cubicBezier": {
    "luxury": {
      "$value": [0.16, 1, 0.3, 1],
      "$type": "cubicBezier"
    }
  }
}
```

---

### 4.2 Tailwind CSS Theme Extension Object

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        luxury: {
          gold: '#D4AF37',
          'gold-dim': '#AA8C2C',
          'gold-light': '#F5E6BE',
          'gold-dark': '#705915',
          black: '#050505',
          charcoal: '#121212',
          'charcoal-elevated': '#1C1C1E',
          glass: 'rgba(255, 255, 255, 0.05)',
          cream: '#F5F5F0',
        },
        semantic: {
          emerald: '#10B981',
          amber: '#F59E0B',
          crimson: '#EF4444',
          royal: '#8B5CF6',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
        md: '12px',
        xl: '20px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in-up': 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          'from': { backgroundPosition: '0 0' },
          'to': { backgroundPosition: '-200% 0' },
        }
      }
    }
  }
};
```

---

### 4.3 Native CSS Custom Properties (:root)

```css
:root {
  /* Brand Palette */
  --shee-color-gold: #D4AF37;
  --shee-color-gold-dim: #AA8C2C;
  --shee-color-gold-light: #F5E6BE;
  --shee-color-gold-dark: #705915;
  --shee-color-gold-glow: rgba(212, 175, 55, 0.15);
  
  /* Canvas & Surfaces */
  --shee-color-canvas: #000000;
  --shee-color-panel: #050505;
  --shee-color-charcoal: #121212;
  --shee-color-charcoal-elevated: #1C1C1E;
  --shee-color-cream: #F5F5F0;
  --shee-color-muted: #94A3B8;
  --shee-color-hairline: rgba(255, 255, 255, 0.08);

  /* Semantic Telemetry */
  --shee-color-success: #10B981;
  --shee-color-warning: #F59E0B;
  --shee-color-danger: #EF4444;
  --shee-color-royal: #8B5CF6;

  /* Typography */
  --shee-font-display: 'Playfair Display', Georgia, serif;
  --shee-font-interface: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --shee-font-data: 'JetBrains Mono', monospace;

  /* Elevation & Blur */
  --shee-blur-glass: 20px;
  --shee-blur-card: 12px;
  --shee-ease-luxury: cubic-bezier(0.16, 1, 0.3, 1);
  --shee-duration-micro: 200ms;
}
```

---

### 4.4 TypeScript Token Interfaces & Design Dictionary Schema

```typescript
export interface SmartGuestDesignTokens {
  color: {
    luxury: {
      gold: string;
      goldDim: string;
      goldLight: string;
      goldDark: string;
      goldGlow: string;
      black: string;
      charcoal: string;
      charcoalElevated: string;
      cream: string;
      muted: string;
      hairline: string;
    };
    semantic: {
      success: string;
      warning: string;
      danger: string;
      royal: string;
    };
  };
  typography: {
    fontFamily: {
      display: string;
      interface: string;
      data: string;
    };
    scale: Record<'displayXl' | 'displayLg' | 'displayMd' | 'bodyLg' | 'bodyBase' | 'bodySm' | 'metaXs', string>;
  };
  motion: {
    duration: {
      instant: number; // 100ms
      micro: number;   // 200ms
      surface: number; // 350ms
    };
    easing: {
      luxury: string;
      drawer: string;
    };
  };
}

export const SHEE_TOKENS: SmartGuestDesignTokens = {
  color: {
    luxury: {
      gold: '#D4AF37',
      goldDim: '#AA8C2C',
      goldLight: '#F5E6BE',
      goldDark: '#705915',
      goldGlow: 'rgba(212, 175, 55, 0.15)',
      black: '#050505',
      charcoal: '#121212',
      charcoalElevated: '#1C1C1E',
      cream: '#F5F5F0',
      muted: '#94A3B8',
      hairline: 'rgba(255, 255, 255, 0.08)',
    },
    semantic: {
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      royal: '#8B5CF6',
    },
  },
  typography: {
    fontFamily: {
      display: '"Playfair Display", serif',
      interface: '"Inter", sans-serif',
      data: '"JetBrains Mono", monospace',
    },
    scale: {
      displayXl: 'clamp(2.25rem, 4vw, 3.75rem)',
      displayLg: '2.25rem',
      displayMd: '1.5rem',
      bodyLg: '1.125rem',
      bodyBase: '1.0rem',
      bodySm: '0.875rem',
      metaXs: '0.75rem',
    },
  },
  motion: {
    duration: {
      instant: 100,
      micro: 200,
      surface: 350,
    },
    easing: {
      luxury: 'cubic-bezier(0.16, 1, 0.3, 1)',
      drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
    },
  },
};
```

---

## 5. Exhaustive UI Behavioral Specifications

### 5.1 Multi-Step Platform Installation Wizard (If decided for implementation)

The installation wizard provides sovereign initialization when deploying SmartGuest for the first time. Its UI behavior adheres to strict state validation:

```
┌────────────────────────────────────────────────────────────────────────┐
│               STAGE STEP SPINE (Progressive Disclosure)                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌──────────────┬────────────────┼──────────────┬──────────────┐
    │              │                │              │              │
┌───▼────────┐ ┌───▼────────┐ ┌─────▼────────┐ ┌───▼────────┐ ┌───▼────────┐
│  Stage 01  │ │  Stage 02  │ │   Stage 03   │ │  Stage 04  │ │  Stage 05  │
│  Security  │ │  Super     │ │   Platform   │ │  Banking & │ │  SMTP &    │
│  Handshake │ │  Admin     │ │   Branding   │ │  Payments  │ │  Dispatch  │
└───┬────────┘ └───┬────────┘ └─────┬────────┘ └───┬────────┘ └───┬────────┘
    │              │                │              │              │
    └──────────────┴────────────────┼──────────────┴──────────────┘
                                    │
                      ┌─────────────▼─────────────┐
                      │         Stage 06          │
                      │  Genesis Review & Seal    │
                      └───────────────────────────┘
```

#### Step Behavior Matrix
1. **Stage 1 (Deployment Handshake)**:
   - *State Transition*: Input is locked until user enters `DEPLOYMENT_SETUP_SECRET`. On submission, triggers timing-safe backend verification.
   - *Active Visual Indicator*: Step badge transitions from hollow circle to metallic gold ring (`border-luxury-gold text-luxury-gold`).
   - *Validation Gate*: Server returns a 15-minute cryptographically signed `setupToken`. Next buttons remain disabled until `setupToken` is held in memory.
2. **Stage 2 (Super Administrator Credentials)**:
   - *Password Entropy Meter*: Listens to `onChange` and dynamically computes character length ($\ge 8$), lowercase, uppercase, numerical, and symbol rules.
   - *Visual Feedback*: Renders a 4-segment segmented bar that transitions from crimson (`bg-red-500`) to amber (`bg-yellow-500`) to gold (`bg-luxury-gold`) to emerald (`bg-emerald-500`).
   - *State Caching*: If user navigates backward, password values remain safely cached in React state without requiring re-entry.
3. **Stage 3 (Platform Identity & Regional Currency)**:
   - *Interactive Segmented Selector*: Currency selector allows switching between `TZS` (Tanzanian Shilling, default), `USD`, `KES`, `EUR`, and `GBP`.
   - *Live String Formatting*: Dynamically updates the preview of room suite deposits and commission splits.
4. **Stage 4 (Banking & AzamPay Integration)**:
   - *Environment Toggle*: Interactive toggle between `Sandbox (Testing)` and `Production (Live Settlement)`.
   - *Secret Masking*: Keys are masked by default with an eye-icon toggle to reveal credentials.
5. **Stage 5 (SMTP Communications Dispatch)**:
   - *Port Dynamic Auto-Fill*: Selecting `TLS (Secure)` automatically suggests Port `465` or `587`.
6. **Stage 6 (Genesis Review & Atomic Sealing)**:
   - *Verification Manifest*: Aggregates all configured parameters in a read-only high-density inspection grid.
   - *Execution Animation*: Clicking "Seal Platform & Launch" changes button to an active spinner (`animate-spin`), disables all form inputs, transmits the atomic payload, sets `.platform-installed.lock`, and transitions directly into the authenticated Super Admin executive console.

---

### 5.2 Modals, Drawers & Floating Glass Docks

#### Modal Dialogue Choreography
1. **Mounting**:
   - `backdrop`: Fades from `opacity: 0` to `opacity: 1` over $200\text{ms}$ with `backdrop-filter: blur(20px)`.
   - `content`: Scales from `transform: scale(0.97)` to `scale(1)` with `opacity: 0` to `opacity: 1` over $200\text{ms}$ (`ease-out`).
2. **Dismissal**:
   - Responds to `Escape` keypress, backdrop click, or explicit Close button.
   - Reverses transformation with zero layout flash.
3. **Focus Management**:
   - Focus is automatically trapped within the modal container. `Tab` and `Shift+Tab` cycle strictly across modal affordances.

#### Floating Sidebar Glass Dock (Layout.tsx)
- **Desktop (md:)**: Floats as an offset glass dock (`h-[calc(100vh-2rem)] my-4 ml-4 w-72 rounded-[2rem] glass-panel`).
- **Mobile (<md:)**: Slides from left off-screen (`-translate-x-[120%]` $\to$ `translate-x-0`) using `transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1)` with a full-viewport dimming scrim.

---

### 5.3 Form Controls, Validation & Live Feedback

#### Input Field Behavioral States
- **Idle State**: Hairline border `border-white/10`, background `bg-black/40`, placeholder `text-gray-600`.
- **Hover State**: Border brightens to `border-white/20`.
- **Focus State**: Hairline transitions to `border-luxury-gold`, surrounded by a 1px diffuse ambient gold halo ring (`ring-1 ring-luxury-gold/50`).
- **Error State**: Border highlights in crimson (`border-red-500`), paired with a leading exclamation icon and descriptive red text below the input. (No color-only signaling).
- **Disabled State**: Opacity drops to `opacity-40`, cursor changes to `cursor-not-allowed`, and pointer events are inhibited.

```tsx example
// Canonical Form Input Component Pattern
<div className="space-y-1.5">
  <label className="block text-xs uppercase tracking-wider text-gray-400 font-medium">
    Platform Administrator Email
  </label>
  <div className="relative">
    <input
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 
                 text-luxury-cream text-sm placeholder-gray-600 focus:outline-none 
                 focus:border-luxury-gold focus:ring-1 focus:ring-luxury-gold/50 
                 transition-all duration-200"
      placeholder="executive@smartguest.com"
    />
  </div>
</div>
```

---

### 5.4 Micro-Interactions, Hover Mechanics & Latency Budgets

#### Button Press & Hover Physics
- **Hover ($\le 150\text{ms}$)**: Smooth background brightness shift (`hover:bg-yellow-500` or `hover:border-luxury-gold`), paired with a slight upward translation (`hover:-translate-y-[1px]`).
- **Active / Depressed ($\le 50\text{ms}$)**: Physical tactile press response using `active:scale-[0.98]` and `active:translate-y-0`.
- **Loading State**: Button width is constrained to prevent layout shift (`min-w-[120px]`). Primary label text is replaced with a 16px metallic gold spinner (`animate-spin`).

```tsx example
// Canonical Primary Luxury Action Button
<button
  disabled={isLoading}
  className="relative px-6 py-3 rounded-xl bg-gradient-to-r from-luxury-gold to-yellow-500 
             text-black font-semibold text-sm tracking-wide shadow-lg shadow-luxury-gold/20 
             hover:shadow-luxury-gold/30 hover:-translate-y-0.5 active:translate-y-0 
             active:scale-[0.98] transition-all duration-200 disabled:opacity-50 
             disabled:pointer-events-none disabled:transform-none flex items-center justify-center gap-2"
>
  {isLoading ? <SpinnerIcon className="animate-spin w-4 h-4 text-black" /> : 'Confirm Reservation'}
</button>
```

---

### 5.5 Toast Notifications & Real-Time Alerts

- **Placement**: Fixed to top-right viewport (`top-6 right-6 z-50`).
- **Stacking**: Stacked vertically with an 8px gap. Maximum 3 visible toasts.
- **Dismissal Timing**: Automatic 4000ms timer with a thin gold hairline progress bar depleting from right to left.
- **Pause on Hover**: Hovering over the notification pauses the countdown timer.

---

## 6. Component Pattern Catalog & Implementation Guide

### A. Segmented Tab Filter (Interactive Button Group)
```tsx example
<div className="flex items-center gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
  {['All Suites', 'Ocean Villa', 'Presidential', 'Penthouse'].map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap shrink-0 ${
        activeTab === tab
          ? 'bg-luxury-gold text-black font-semibold shadow-md shadow-luxury-gold/20'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {tab}
    </button>
  ))}
</div>
```

### B. Glassmorphic Luxury Property Card
```tsx example
<div className="glass-card rounded-2xl p-6 border border-white/5 hover:border-luxury-gold/30 transition-all duration-300 group">
  <div className="flex justify-between items-start mb-4">
    <div>
      <span className="text-[10px] uppercase tracking-widest text-luxury-gold font-medium">Mbezi Store</span>
      <h3 className="font-serif text-xl text-white mt-1 group-hover:text-luxury-gold transition-colors">The Royal Coral Suite</h3>
    </div>
    <div className="text-right">
      <span className="font-mono text-sm font-semibold text-white tabular-nums">TSh 1,850,000</span>
      <p className="text-[10px] text-gray-500">per night / tax incl.</p>
    </div>
  </div>
  
  {/* Unboxed Metadata with Typographic Separator */}
  <div className="flex items-center gap-2 text-xs text-gray-400 mb-6">
    <span>Private Plunge Pool</span>
    <span aria-hidden="true">·</span>
    <span>Personal Butler</span>
    <span aria-hidden="true">·</span>
    <span>Helipad Access</span>
  </div>

  <button className="w-full py-2.5 rounded-xl border border-luxury-gold/40 text-luxury-gold text-xs font-semibold hover:bg-luxury-gold hover:text-black transition-all duration-200">
    Save
  </button>
</div>
```

---

## 7. Governance, Audit & Verification Checklist

Before releasing or updating any UI view within SaaS POS cloud, verify compliance against this 14-point checklist:

1. **Anti-Slop Cleanliness**: Zero `//` comment headers, zero mechanical snake_case prefixes, zero ornamental bottom telemetry tickers.
2. **Zero-Pill Restraint**: Static metadata uses unboxed text separated by `·` or `/`; no pill badge capsules on informational content.
3. **Top Bar Contract**: Maximum 3 zones separated by `gap-8` (1-line Brand wordmark, 4–5 single-line navigation links, 1 primary action button).
4. **Single-Line Controls**: All buttons, links, and segmented tabs use `whitespace-nowrap shrink-0` with zero line breaks.
5. **Color Discipline (60-30-10)**: 60% dark canvas, 30% structural surfaces/borders, 10% gold/intent accents.
6. **No Hue-Only Signaling**: Errors and warnings pair explicit status colors with text and SVG iconography.
7. **Typographic Hierarchy**: Distinct display face (`Playfair Display`), interface face (`Inter`), and monospace data (`JetBrains Mono` with `tabular-nums`).
8. **Spatial Padding Math**: Container outer padding $\ge$ inner child gap (minimum 16px).
9. **Nested Radius Equation**: $r_{\text{inner}} = r_{\text{outer}} - \text{padding}$.
10. **Button Aspect Ratio**: Horizontal padding is approximately double the vertical padding (`py-2 px-4`).
11. **Motion Latency Ceiling**: Micro-interactions complete in $\le 200\text{ms}$; compositor-only properties (`transform`, `opacity`) are animated.
12. **WCAG AA Legibility**: Contrast ratios meet or exceed 4.5:1 for body copy and 3.0:1 for large display headlines.
13. **Mobile Sticky Constraint**: Combined height of fixed/sticky elements does not exceed 15% of the mobile viewport.
14. **Installation Wizard Lockdown**: All setup endpoints and wizard states permanently reject requests once initial platform installation is flagged.

---
*Authored and Approved for SaaS POS Cloud — Design Tokens & UI Behavior Standard Architecture Governance.*
