# Design System: Subtitle Group Site

## 1. Visual Theme & Atmosphere
A restrained Swiss-industrial interface for a content-and-download system. The product should feel like a release operations board printed on engineering paper: hard edges, visible structure, oversized headlines, monospace metadata, and deliberate negative space. The layout variance is high, but the behavior is calm. This project does not rely on decorative motion or gradients; visual authority comes from hierarchy, rhythm, and editorial tension.

- Density: 5/10
- Variance: 7/10
- Motion: 2/10
- Chosen mode: Swiss Industrial Print

## 2. Color Palette & Roles
- **Paper Canvas** `#F4F1E8`: Primary site background
- **Plate White** `#FAF8F1`: Raised inner panels and content blocks
- **Carbon Ink** `#111111`: Headings, body text, primary borders
- **Ash Metal** `#5D584F`: Secondary text and metadata
- **Dust Line** `#D5CEC0`: Structural dividers and subtle borders
- **Hazard Red** `#C63A28`: Single accent for CTAs, active states, badges, and focus treatment
- **Signal Wash** `#E8DED1`: Muted highlighted sections

Rules:
- One accent color only.
- No gradients.
- No purple, neon blue, or glow-based affordances.
- Never use pure black.

## 3. Typography Rules
- **Display:** `Archivo` at 700-900. Use large uppercase or sentence-case headlines with compact line wrapping and `text-balance`.
- **Body:** `Archivo` at 400-600. Body copy stays readable and grounded with `text-pretty`.
- **Mono:** `JetBrains Mono` for dates, file sizes, platforms, status labels, and telemetry rows.
- **Banned:** `Inter`, `Roboto`, `Arial`, `Open Sans`, `Helvetica`, generic serif stacks.

Rules:
- No arbitrary letter-spacing utilities.
- Data uses tabular numerals.
- Metadata can be uppercase, but spacing remains default.

## 4. Component Stylings
- **Panels:** Double-framed, square-cornered enclosures. Outer shell provides the hard border; inner shell carries content.
- **Buttons:** Rectilinear bars with bold labels. Press states may use color inversion, but not animation-heavy flourishes.
- **Cards:** Border-first, shadow-last. Use shadow only as a faint lift, never as a dramatic depth effect.
- **Inputs:** Label above field, helper or context below when needed, error text inline beneath.
- **Empty States:** Must include one clear next action.
- **Status Rows:** Monospace labels, visible section lines, compact secondary text.

## 5. Layout Principles
- Hero sections are asymmetrical, never centered.
- Avoid three equal cards in one row. Prefer split columns, offset stacks, and varied row heights.
- Use CSS grid for structure and visible compartment lines.
- Mobile collapses to one column below `768px`.
- No horizontal scroll on mobile.
- Major sections breathe with large vertical spacing, but individual content blocks stay tight and information-dense.

## 6. Motion & Interaction
Current implementation baseline is mostly static.

- Only add motion when it clarifies feedback.
- Use transform and opacity only.
- Interaction feedback should stay under `200ms`.
- If richer motion is added later, default to subtle ease-out entry and respect `prefers-reduced-motion`.

## 7. Anti-Patterns (Banned)
- No gradients
- No rounded-pill consumer SaaS cards
- No pure black
- No neon glow shadows
- No three-column equal feature grids
- No centered hero
- No icon-only controls without labels
- No placeholder AI copy like “seamless”, “next-gen”, or “elevate”
- No decorative dashboard chrome that does not map to real product structure

