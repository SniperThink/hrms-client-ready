# Logger Migration Guide

## Automatic Migration Commands

Use these shell commands to automatically replace all `console.*` calls with the custom logger:

### 1. Backup your code first
```bash
git add -A && git commit -m "backup before logger migration"
```

### 2. Add logger import to files that use console
```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/.next/*" \
  -exec grep -l "console\.\(log\|warn\|error\|debug\)" {} \; | \
  while read file; do
    # Check if logger import already exists
    if ! grep -q "from '@/utils/logger'" "$file" && ! grep -q "from \"@/utils/logger\"" "$file"; then
      # Add import after the last import statement
      sed -i "/^import.*from/a import { logger } from '@/utils/logger';" "$file"
    fi
  done
```

### 3. Replace console calls with logger
```bash
# Replace console.log with logger.info
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/.next/*" \
  -exec sed -i 's/console\.log(/logger.info(/g' {} +

# Replace console.warn with logger.warn
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/.next/*" \
  -exec sed -i 's/console\.warn(/logger.warn(/g' {} +

# Replace console.error with logger.error
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/.next/*" \
  -exec sed -i 's/console\.error(/logger.error(/g' {} +

# Replace console.debug with logger.debug
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/.next/*" \
  -exec sed -i 's/console\.debug(/logger.debug(/g' {} +
```

### 4. Review changes
```bash
git diff
```

### 5. Test the application
```bash
npm run dev
```

---

## Manual Migration (Alternative)

If you prefer to migrate files manually:

### Before:
```typescript
console.log('User logged in', userId);
console.warn('API rate limit approaching');
console.error('Authentication failed', error);
```

### After:
```typescript
import { logger } from '@/utils/logger';

logger.info('User logged in', userId);
logger.warn('API rate limit approaching');
logger.error('Authentication failed', error);
```

---

## Tips

- The automated script works on **macOS** and **Linux** with `sed`
- On **macOS**, you might need to use `sed -i ''` instead of `sed -i` (the script uses Linux syntax)
- Review all changes before committing
- Test thoroughly in development before deploying to production
- Keep `console.error` calls in `next.config.ts` excluded from removal (already configured)

---

## What happens in production?

1. **Logger behavior**: Only `logger.error()` calls will output (info/warn/debug are silenced)
2. **Next.js compiler**: Removes all `console.*` calls except `console.error`
3. **Result**: Clean production logs with minimal noise
