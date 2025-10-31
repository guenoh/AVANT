# Design System - Vision Auto v2

## Spacing System

### Section Spacing
- Between major sections: `28px` (`space-y-7`)
- Between items in section: `16px` (`space-y-4`)
- Between label and input: `8px` (`mb-2`)
- Grid gaps: `12px` (`gap-3`)

### Component Padding
- Input fields: `14px × 8px` (`px-3.5 py-2`)
- Buttons: `16px × 8px` (`px-4 py-2`)
- Cards: `14px` (`p-3.5`) or `16px` (`p-4`)

## Typography

### Font Sizes
- Label: `12px` (`text-xs`)
- Input/Body: `14px` (`text-sm`)
- Section Title: `14px` (`text-sm`)

### Font Weights
- Label: `500` (`font-medium`)
- Section Title: `600` (`font-semibold`)
- Regular: `400` (default)

### Text Colors
- Primary: `#334155` (`text-slate-700`)
- Secondary: `#64748b` (`text-slate-600`)
- Placeholder: `#94a3b8` (`text-slate-400`)
- Muted: `#cbd5e1` (`text-slate-300`)

## Colors

### Semantic Colors
- Primary: Blue (`#3b82f6`, `blue-500`)
- Success: Emerald (`#10b981`, `emerald-500`)
- Warning: Amber (`#f59e0b`, `amber-500`)
- Error: Red (`#ef4444`, `red-500`)
- Info: Cyan (`#06b6d4`, `cyan-500`)

### Neutral Colors
- Border: `#e2e8f0` (`slate-200`)
- Background: `#f8fafc` (`slate-50`)
- Card Background: `#ffffff` (`white`)

### Section Indicator Colors
- Blue: `#3b82f6` (`blue-500`)
- Purple: `#a855f7` (`purple-500`)
- Indigo: `#6366f1` (`indigo-500`)
- Emerald: `#10b981` (`emerald-500`)
- Orange: `#f97316` (`orange-500`)
- Pink: `#ec4899` (`pink-500`)
- Violet: `#8b5cf6` (`violet-500`)
- Teal: `#14b8a6` (`teal-500`)

## Borders

### Border Width
- Default: `1px` (`border`)
- Thick: `2px` (`border-2`)

### Border Radius
- Small: `6px` (`rounded-md`)
- Medium: `8px` (`rounded-lg`)
- Large: `12px` (`rounded-xl`)
- Full: `9999px` (`rounded-full`)

### Border Colors
- Default: `#e2e8f0` (`border-slate-200`)
- Hover: `#cbd5e1` (`border-slate-300`)
- Focus (per color):
  - Blue: `#3b82f6` (`border-blue-500`)
  - Purple: `#a855f7` (`border-purple-500`)
  - etc.

## Shadows

### Shadow Sizes
- Small: `0 1px 2px 0 rgb(0 0 0 / 0.05)` (`shadow-sm`)
- Default: `0 1px 3px 0 rgb(0 0 0 / 0.1)` (`shadow`)

## Input Fields

### Standard Input
```html
<input
  type="text"
  class="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm bg-white shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 hover:border-slate-300"
/>
```

**Rules:**
- Padding: `px-3.5 py-2` (14px horizontal, 8px vertical)
- Border: `border border-slate-200` (1px solid, #e2e8f0)
- Border Radius: `rounded-lg` (8px)
- Background: `bg-white`
- Shadow: `shadow-sm`
- Font: `text-sm` (14px)
- Transitions: `transition-all duration-200`
- Focus State: `focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10`
- Hover State: `hover:border-slate-300`

### Textarea
Same as input but add:
- `resize-none` (optional)
- `rows="3"` (default)

### Select Box
Same as input but add:
- `cursor-pointer`

## Labels

### Standard Label
```html
<label class="text-xs mb-2 block font-medium text-slate-700">
  Label Text
</label>
```

**Rules:**
- Size: `text-xs` (12px)
- Weight: `font-medium` (500)
- Color: `text-slate-700` (#334155)
- Margin: `mb-2` (8px below)
- Display: `block`

### Section Label (gray)
```html
<label class="text-xs text-slate-600 mb-2 block font-medium">
  Section Label
</label>
```
- Color: `text-slate-600` (slightly lighter)

## Buttons

### Primary Button
```html
<button class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 active:scale-95 transition-all duration-150 shadow-sm hover:shadow">
  Primary
</button>
```

### Secondary Button
```html
<button class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 active:scale-95 transition-all duration-150 shadow-sm">
  Secondary
</button>
```

### Ghost Button
```html
<button class="px-4 py-2 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 active:scale-95 transition-all duration-150">
  Ghost
</button>
```

**Rules:**
- Padding: `px-4 py-2` (16px × 8px)
- Border Radius: `rounded-lg` (8px)
- Font: `text-sm font-medium` (14px, weight 500)
- Shadow: `shadow-sm` (on primary/secondary)
- Hover: Darker shade + `hover:shadow` (for primary)
- Active: `active:scale-95`
- Transition: `transition-all duration-150`

## Checkboxes & Radio

### Checkbox
```html
<label class="flex items-center gap-2.5 cursor-pointer group">
  <input type="checkbox" class="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-colors shadow-sm">
  <span class="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
    Label
  </span>
</label>
```

### Radio Button
```html
<label class="flex items-center gap-2.5 cursor-pointer group">
  <input type="radio" class="w-4 h-4 border-slate-300 text-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-colors shadow-sm">
  <span class="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
    Label
  </span>
</label>
```

**Rules:**
- Size: `w-4 h-4` (16px × 16px)
- Gap: `gap-2.5` (10px)
- Border: `border-slate-300`
- Accent: `text-purple-600` (or color of section)
- Focus: `focus:ring-2 focus:ring-purple-500/20`
- Shadow: `shadow-sm`
- Label: `text-sm text-slate-700`
- Hover: `group-hover:text-slate-900`

## Sliders (Range)

### Standard Slider
```html
<div>
  <div class="flex items-center justify-between mb-2.5">
    <label class="text-xs font-medium text-slate-700">Label</label>
    <span class="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
      50%
    </span>
  </div>
  <input
    type="range"
    class="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-emerald-500 shadow-inner"
  />
</div>
```

**Rules:**
- Label + Value on same row: `flex justify-between mb-2.5`
- Value Badge: `px-2 py-0.5 rounded-md` with semantic color
- Slider: `h-2 bg-slate-100 rounded-full accent-{color}-500 shadow-inner`

## Cards

### Info Card
```html
<div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-sm">
  <p class="text-xs text-slate-700 leading-relaxed">
    Content
  </p>
</div>
```

### Colored Card (e.g., image region)
```html
<div class="bg-violet-50 border border-violet-200 rounded-xl p-4 shadow-sm">
  <!-- Content -->
</div>
```

**Rules:**
- Padding: `p-3.5` or `p-4` (14px or 16px)
- Border: `border border-{color}-200`
- Border Radius: `rounded-xl` (12px)
- Shadow: `shadow-sm`
- Background: `bg-{color}-50` or `bg-slate-50`

## Badges & Tags

### Status Badge
```html
<span class="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-100 shadow-sm">
  Badge
</span>
```

### Operator Tag (gradient)
```html
<span class="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full text-xs font-bold shadow-sm">
  AND
</span>
```

**Rules:**
- Padding: `px-2.5 py-1` (10px × 4px)
- Font: `text-xs font-medium` or `font-bold`
- Border Radius: `rounded-lg` or `rounded-full`
- Shadow: `shadow-sm`

## Section Headers

### Standard Section Header
```html
<div class="flex items-center gap-2 mb-4">
  <div class="w-1 h-4 bg-blue-500 rounded-full"></div>
  <h3 class="text-sm font-semibold text-slate-900">Section Title</h3>
</div>
```

**Rules:**
- Indicator: `w-1 h-4` (4px × 16px), colored, `rounded-full`
- Gap: `gap-2` (8px)
- Title: `text-sm font-semibold text-slate-900`
- Margin: `mb-4` (16px)

## Grid Layouts

### 2-Column Grid
```html
<div class="grid grid-cols-2 gap-3">
  <!-- Items -->
</div>
```

### 3-Column Grid
```html
<div class="grid grid-cols-3 gap-2">
  <!-- Items -->
</div>
```

**Rules:**
- Gap: `gap-3` (12px) for 2-column
- Gap: `gap-2` (8px) for 3-column

## Spacing Within Sections

```html
<div>
  <!-- Section Header (mb-4) -->
  <div class="flex items-center gap-2 mb-4">...</div>

  <!-- Items Container (space-y-4) -->
  <div class="space-y-4">
    <div><!-- Item 1 --></div>
    <div><!-- Item 2 --></div>
  </div>
</div>
```

**Rules:**
- Section header: `mb-4` (16px margin below)
- Items container: `space-y-4` (16px between items)

## Transitions

### Standard Transition
- Input fields: `transition-all duration-200`
- Buttons: `transition-all duration-150`
- Text/colors: `transition-colors`
- Shadows: `transition-shadow`

## Focus States

### Per Color
- Blue: `focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10`
- Purple: `focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10`
- Indigo: `focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10`
- etc.

**Rules:**
- Border changes to semantic color (`-500` shade)
- Ring: `2px` width, `10%` opacity of semantic color
- Always use `/10` opacity for ring color

## Hover States

### Inputs
- Border: `hover:border-slate-300`

### Buttons
- Background: Darker shade (e.g., `hover:bg-blue-600`)
- Shadow: `hover:shadow` (for primary buttons)

### Cards
- Background: `hover:bg-slate-100`
- Border: `hover:border-{color}-400`

## Active States

### Buttons
- Scale: `active:scale-95`

## Complete Examples

See test action (`case 'test'`) for full implementation examples of all components following these rules.
