# Preventive Measures for Common Issues

## Problem Summary

When adding new action types, multiple issues occur repeatedly:
1. ELSE toggle button visibility and styling issues
2. Icon background colors not appearing correctly
3. Image region selection drag not working
4. Hardcoded type checks preventing new actions from working

## Root Cause Analysis

### 1. Scattered Configuration
- Action type information is duplicated across multiple files
- No single source of truth for action behavior
- Hardcoded type checks (`if (type === 'image-match')`) throughout codebase

### 2. Missing Validation
- No automated checks when adding new action types
- No warnings for incomplete configuration
- Runtime failures instead of compile-time detection

### 3. Implicit Dependencies
- Adding action type requires updating 5+ files manually
- Easy to forget required updates
- No documentation of required steps

## Implemented Solutions

### 1. Centralized Image Action Types (✓ DONE)
**Problem**: Hardcoded `type === 'image-match'` checks prevented tap-matched-image from working.

**Solution**: Created `IMAGE_ACTION_TYPES` constant in macro-builder-app.js
```javascript
this.IMAGE_ACTION_TYPES = ['image-match', 'tap-matched-image'];
```

**Impact**:
- New image-based actions automatically get region selection
- Single place to add new image action types
- No more scattered hardcoded checks

### 2. Tailwind Color Mapping & CSS Classes (✓ DONE)
**Problem**: Icons had white/missing backgrounds for new actions because:
1. Missing tailwindColorMapping entry in ActionConfigProvider.js
2. **CSS classes not defined in colors.css** (e.g., `bg-blue-400` was missing)

**Solution**:
- `tailwindColorMapping` in ActionConfigProvider.js provides centralized color configuration
- **ALL color classes must be defined in src/renderer/styles/colors.css**

**Verification**: All action types must have:
1. Entry in `tailwindColorMapping` with:
   - `color`: Background color class (e.g., 'bg-blue-400')
   - `borderClass`: Border color class (e.g., 'border-blue-400')
   - `bgClass`: Light background for blocks (e.g., 'bg-blue-50')

2. **CSS definitions in colors.css**:
   - `.bg-[color]-[shade]` class defined
   - `.border-[color]-[shade]` class defined
   - If using new shade (e.g., blue-400), add it to colors.css

**Common mistake**: Adding `bg-blue-400` to tailwindColorMapping but forgetting to define `.bg-blue-400 { background-color: #60a5fa; }` in CSS file

## Required Preventive Measures

### 1. Action Type Checklist
When adding a new action type, verify ALL of these:

**ActionConfigProvider.js**:
- [ ] Add action definition in `this.actionTypes`
- [ ] Add to `tailwindColorMapping` with color classes
- [ ] Add to appropriate `paletteCategories` array
- [ ] Add to `descriptionMapping`
- [ ] If conditional: Add to starter action list

**ActionSettingsBuilder.js**:
- [ ] Create `build{ActionType}Settings()` method
- [ ] Add case in router (if needed)

**main.js**:
- [ ] Add execution logic in `action:execute` handler
- [ ] Add batch execution in `action:execute-batch` handler

**macro-builder-app.js**:
- [ ] If image-based: Add to `IMAGE_ACTION_TYPES` array
- [ ] If coordinate-based: Add to coordinate handling
- [ ] Add to action description mapping (if needed)

**Verification**:
- [ ] Test region selection (for image actions)
- [ ] Test icon colors in action palette
- [ ] Test ELSE toggle (for conditional starters)
- [ ] Test execution in macro
- [ ] Test settings panel appearance

### 2. Automated Validation (TODO)
Create validation script to check:
```javascript
// Check all actions have color mapping
for (const actionType of Object.keys(actionTypes)) {
    if (!tailwindColorMapping[actionType]) {
        console.error(`Missing tailwindColorMapping for: ${actionType}`);
    }
}

// Check all palette items have valid action types
for (const category of Object.values(paletteCategories)) {
    for (const typeId of category) {
        if (!actionTypes[typeId]) {
            console.error(`Palette references undefined action: ${typeId}`);
        }
    }
}
```

### 3. Type-Based Feature Detection (TODO)
Instead of hardcoded type checks, use feature flags:
```javascript
// Instead of:
if (type === 'image-match' || type === 'tap-matched-image') {
    // enable region selection
}

// Do this:
const actionConfig = ActionConfigProvider.getActionConfig(type);
if (actionConfig.requiresImageRegion) {
    // enable region selection
}
```

Add to action definitions:
```javascript
'tap-matched-image': {
    // ...
    features: {
        requiresImageRegion: true,
        hasElseToggle: false,
        requiresCoordinates: false
    }
}
```

### 4. CSS Class Standardization (TODO)
Create CSS variable mapping for consistency:
```css
/* In macro-builder.css */
.action-icon {
    /* Always use bgClass from config, never hardcode white */
    background: var(--action-bg-color);
}
```

### 5. Unit Tests for New Actions (TODO)
Create test template:
```javascript
describe('tap-matched-image action', () => {
    it('has tailwind color mapping', () => {
        const config = ActionConfigProvider.getActionUIConfig('tap-matched-image');
        expect(config.color).toBeDefined();
        expect(config.borderClass).toBeDefined();
    });

    it('supports image region selection', () => {
        const app = new MacroBuilderApp();
        expect(app.IMAGE_ACTION_TYPES).toContain('tap-matched-image');
    });
});
```

## Implementation Priority

### High Priority (Do Now)
1. ✅ Centralize image action types (DONE)
2. ✅ Ensure tailwindColorMapping is complete (DONE)
3. ⬜ Create action type checklist document
4. ⬜ Add validation script

### Medium Priority (This Week)
1. ⬜ Implement feature-based detection
2. ⬜ Create unit test template
3. ⬜ Add automated color validation

### Low Priority (Future)
1. ⬜ Create action type generator tool
2. ⬜ Add TypeScript for better type checking
3. ⬜ Create visual regression tests

## Best Practices

### When Adding New Action Types:
1. **Start with ActionConfigProvider**: Define complete configuration first
2. **Use existing actions as templates**: Copy similar action and modify
3. **Test immediately**: Don't wait until macro execution to test
4. **Commit frequently**: One action type = one commit
5. **Document special cases**: If action needs unique handling, document why

### Code Review Checklist:
- All new action types have tailwindColorMapping entry
- No new hardcoded type checks added
- Settings UI follows existing patterns
- Colors are color-blind safe
- Icon backgrounds are never white/transparent

## Lessons Learned

1. **Hardcoded checks are evil**: Always use arrays or configuration
2. **Copy-paste is okay**: Better to copy working code than create bugs
3. **Test the UI first**: Don't assume CSS will work
4. **Commit often**: Easier to debug when changes are small
5. **Document assumptions**: Future you will thank present you
