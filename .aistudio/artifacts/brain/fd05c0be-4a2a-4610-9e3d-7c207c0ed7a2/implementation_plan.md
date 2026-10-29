# Ghost & Borderless UI with Interactive Specular Reveal

Transform the entire interface into a pure **Ghost / Borderless UI**, eliminating permanent bounding boxes, cards, and backgrounds in the idle state so all controls and typography float directly on deep black (`#09090b`). Delicate 1px borders and dynamic white Specular highlights reveal strictly on hover.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following design contracts were confirmed during Phase 1 clarification:
> - **Idle State (Zero Boxes)**: Complete transparency in rest state (`bg-transparent border-transparent shadow-none`) across all structural containers (left sidebar, top toolbar, main viewport sections, stats bar, and individual cards). Content floats directly on `#09090b`.
> - **Active Selection Indicator**: Active elements (selected route, active sidebar tab, active toggle) are indicated exclusively via high-contrast `text-white`, a subtle glowing white dot indicator, and a thin vertical line marker (`w-0.5 bg-white`) without static card backgrounds.
> - **Hover State (Border & Specular Sheen Only)**: Strictly **no background fills** on hover. Hovering over any interactive card or button smoothly fades in a delicate 1px border (`border-white/[0.08]`) and a dynamic white Specular reflection tracking cursor position (`radial-gradient` at `--mouse-x`, `--mouse-y`), fading back to total transparency when the cursor leaves.
> - **Badge & Chip Discipline**: Status badges ("КРУГ", "Активен", keybind caps) shed rigid gray boxes in idle state, retaining clean monochrome typography and status dots, with faint boundaries emerging only on group hover.

---

### 1. Overview & Core Concept

- **What It Does**: Strips away visual card "skeuomorphism" and heavy container framing. The UI achieves an ultra-clean, floating appearance inspired by high-end dark minimalist workspaces (Linear / Vercel / Teenage Engineering), where elements exist as pure typographic and geometric data until interacted with.
- **Target Experience**: Seamless visual immersion without visual weight, maximizing screen real estate and eliminating redundant rectangular visual noise.
- **Key Value**: A modern, tactile experience where light and boundary definition exist purely as dynamic responses to user presence.

---

### 2. User Experience & Visual Design

#### A. Key User Flows & States
1. **Idle State (Zero Visual Clutter)**:
   - The user views the dashboard: no rectangular gray boxes or sidebar borders are visible.
   - Text, technical rulers, Lucide icons, and status dots sit directly on the deep matte black canvas.
   - The active route is anchored by a sharp 2px vertical white guide line and glowing white status dot.
2. **Hover State (Ephemeral Boundary & Light Sheen)**:
   - As the mouse moves over a route, button, or container, an ultra-thin 1px perimeter smoothly dissolves into view (`border-white/[0.08]` with `transition-all duration-200`).
   - Simultaneously, the Specular physics engine casts a sharp white edge highlight and subtle surface sheen directly beneath the cursor.
3. **Cursor Exit**:
   - Moving the mouse away causes the border and Specular highlight to dissolve seamlessly back into 100% transparency.

#### B. Component Token Architecture
- **Canvas Base**: `#09090b` (pure matte black background).
- **Idle Containers**: `bg-transparent border-transparent shadow-none`.
- **Hover Containers**: `hover:bg-transparent hover:border-white/[0.08] hover:shadow-[0_0_20px_rgba(255,255,255,0.02)]`.
- **Specular Layer**: `.specular-border` and `.specular-sheen` configured with base `opacity: 0` in CSS, smoothly transitioning to `opacity: var(--specular-opacity, 0)` on hover.
- **Active Navigation & Tabs**: `text-white font-semibold` with glowing white indicator dot; inactive items remain `text-zinc-500 hover:text-zinc-300`.

---

### 3. Key Product Decisions & Trade-Offs

- **Preserving Geometric Layout & Padding**:
  - *Chosen Approach*: Retain all existing structural layout classes (`rounded-xl`, `p-4`, `p-5`, `gap-*`, `min-h-*`) while replacing static fills and borders with `border border-transparent bg-transparent`.
  - *Why*: Prevents layout shifting, jumping, or misalignment when borders and highlights activate on hover.
- **Pure Transparent Hover (Zero Fill Tint)**:
  - *Chosen Approach*: Adhere strictly to the user's choice of "no background fill". Only the 1px perimeter and Specular beam illuminate on hover.
  - *Why*: Eliminates muddy layered gray boxes, keeping the aesthetic razor-sharp and luminous.
- **Inner Badge Simplification**:
  - *Chosen Approach*: Badges for route types, active states, and hotkey caps render without bordered pills in the rest state; subtle `border-white/10` emerges only on `group-hover`.
  - *Why*: Directly satisfies the "anti-pill discipline" and keeps data legible and unboxed.

---

### 4. Technical Architecture & Component Mapping

```
┌────────────────────────────────────────────────────────┐
│ App Canvas (bg-[#09090b], TacticalPerimeterRulers)    │
└──────────────────────────┬─────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
┌─────────────────────────┐       ┌───────────────────────────┐
│ StealthHUDLeftSidebar   │       │ Dynamic Right Viewport    │
│ (Ghost Container)       │       │ ┌───────────────────────┐ │
│ - NavTabs (Borderless)  │       │ │ LineSidebarRouteList  │ │
│ - Route Items (Ghost)   │       │ │ (Ghost Rail & List)   │ │
│ - Record Button (Ghost) │       │ └───────────────────────┘ │
└─────────────────────────┘       │ ┌───────────────────────┐ │
                                  │ │ CompactStatsBar       │ │
                                  │ │ (Ghost Capsule)       │ │
                                  │ └───────────────────────┘ │
                                  └───────────────────────────┘
```

#### Component Modifications:
1. `src/index.css`:
   - Update `.specular-container`, `.card-specular`, and `.btn-specular` to default to `bg-transparent border-transparent` in rest state.
   - Configure `.specular-border` and `.specular-sheen` to reveal strictly during cursor hover events.
2. `src/components/ui/Specular.tsx`:
   - Ensure `SpecularCard` and `SpecularButton` support ghost styling by default with `border border-transparent hover:border-white/[0.08] transition-colors duration-200`.
3. `src/components/StealthHUDLeftSidebar.tsx`:
   - Remove permanent sidebar background and right border in idle state (`bg-transparent border-transparent`); tab selector and route cards become ghost elements with hover reveals.
4. `src/components/StealthHUDTopToolbar.tsx`:
   - Remove glass container borders and background in idle state; buttons float cleanly.
5. `src/components/LineSidebarRouteList.tsx`:
   - Card container becomes ghost (`bg-transparent border-transparent`); line rail and sliding indicator remain cleanly visible as the sole anchors.
6. `src/components/CompactStatsBar.tsx`:
   - Remove pill background and borders; metrics and session time float over bottom viewport, borders reveal on hover.
7. `src/components/ComboSequence.tsx` & `src/components/SettingsView.tsx`:
   - Keybind caps, spell slots, and configuration rows converted to borderless ghost elements with hover reveals.
