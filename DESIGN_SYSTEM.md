# Prominent Enterprise Design System

## Color Palette

The Prominent Enterprise application uses a cohesive color palette based on deep purple and bright orange accents.

### Primary Colors

#### Prominent Purple

- **Deep Purple (Primary)**: `#3D2563` - Main brand color for primary actions
- **Very Deep Purple (Background)**: `#2D1B4E` - Used for dark backgrounds
- **Medium Purple**: `#5D4681` - Secondary purple for hover states and accents
- **Light Purple**: `#7D62A3` - Tertiary purple for lighter elements

#### Prominent Orange

- **Orange (Accent)**: `#FF9933` - Main accent color for CTAs and highlights
- **Light Orange**: `#FFB880` - Secondary orange for lighter elements
- **Dark Orange**: `#E67E00` - Darker orange for hover states

### Neutral Colors

- **White**: `#FFFFFF` - Primary text and card backgrounds (light mode)
- **Black**: `#1A1A1A` - Primary text (dark mode)
- **Light Gray**: `#F5F5F5` - Background (light mode)
- **Darker Gray**: `#3D2563` - Backgrounds (dark mode)
- **Medium Gray**: `#666666` - Secondary text
- **Border Gray**: `#E5E7EB` - Borders and dividers

## Usage in Tailwind

### Color Classes

```html
<!-- Purple backgrounds -->
<div class="bg-prominent-purple-800">Very Deep Purple (background)</div>
<div class="bg-prominent-purple-700">Deep Purple (primary)</div>
<div class="bg-prominent-purple-600">Medium Purple</div>

<!-- Orange backgrounds -->
<div class="bg-prominent-orange-500">Orange (accent)</div>
<div class="bg-prominent-orange-400">Light Orange</div>

<!-- Gradients -->
<div class="bg-gradient-purple">Purple Gradient</div>
<div class="bg-gradient-prominent">Prominent Gradient</div>
<div class="bg-gradient-orange">Orange Gradient</div>
```

### CSS Variables

All colors are also available as CSS variables:

```css
/* Light Mode (Default) */
--primary: #3d2563;
--primary-foreground: #ffffff;
--accent: #ff9933;
--accent-foreground: #ffffff;
--background: #f5f5f5;
--foreground: #1a1a1a;

/* Dark Mode */
.dark {
  --primary: #ff9933;
  --primary-foreground: #1a1a1a;
  --accent: #ff9933;
  --accent-foreground: #1a1a1a;
  --background: #1a1a1a;
  --foreground: #f5f5f5;
}
```

## Typography

### Default Fonts

- **Sans Serif**: Geist (system fallback: system-ui, sans-serif)
- **Monospace**: Geist Mono

### Font Sizes

- **xs**: 0.75rem (12px)
- **sm**: 0.875rem (14px)
- **base**: 1rem (16px)
- **lg**: 1.125rem (18px)
- **xl**: 1.25rem (20px)
- **2xl**: 1.5rem (24px)
- **3xl**: 1.875rem (30px)
- **4xl**: 2.25rem (36px)
- **5xl**: 3rem (48px)

## Component Examples

### Buttons

```jsx
// Primary Button (Purple)
<button className="bg-prominent-purple-700 text-white hover:bg-prominent-purple-800">
  Action
</button>

// Secondary Button (Orange)
<button className="bg-prominent-orange-500 text-white hover:bg-prominent-orange-600">
  CTA
</button>
```

### Cards

```jsx
<div className="rounded-lg bg-white p-4 shadow-md dark:bg-prominent-purple-800">
  <h2 className="text-prominent-purple-700 dark:text-prominent-orange-500">Card Title</h2>
  <p className="text-gray-600 dark:text-gray-400">Card content</p>
</div>
```

### Gradients

```jsx
// Hero Section with Purple Gradient
<div className="bg-gradient-purple min-h-screen flex items-center justify-center">
  <h1 className="text-4xl text-white">Welcome to Prominent</h1>
</div>
```

## Dark Mode

Dark mode is automatically supported through the `dark` class. The theme colors automatically adapt based on the theme:

```jsx
// This will automatically adjust colors for dark mode
<div className="bg-white dark:bg-prominent-purple-800 text-black dark:text-white">
  Responsive to theme
</div>
```

## Accessibility

- All text colors have sufficient contrast for WCAG AA compliance
- Orange accent (`#FF9933`) provides clear distinction for CTAs
- Color is never the only indicator of information

## Implementation Notes

- All color values are defined in `tailwind.config.ts`
- CSS variables are defined in `src/app/globals.css`
- The design system is applied by default across the entire application
- Use the predefined color classes instead of arbitrary hex values
