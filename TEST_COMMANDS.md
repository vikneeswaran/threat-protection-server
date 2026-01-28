# Testing Quick Reference

## 🚀 Quick Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with interactive UI
npm run test:ui

# Generate coverage report
npm run test:coverage

# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Check TypeScript types
npm run type-check

# Run all validations (lint + type-check + test)
npm run validate
```

## 🎯 Running Specific Tests

```bash
# Run a specific test file
npm test -- button.test.tsx

# Run tests matching a pattern
npm test -- --grep "Button"

# Run tests in a directory
npm test -- components/ui

# Run only changed tests (in watch mode)
npm run test:watch -- --changed
```

## 📊 Coverage

```bash
# Generate HTML coverage report
npm run test:coverage

# View coverage report
# Open: coverage/index.html in your browser

# Coverage thresholds
# Overall: 70%+
# Critical paths: 90%+
```

## 🔧 Common Tasks

### Before Committing
```bash
npm run validate
```

### Writing a New Test
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### Mocking a Function
```typescript
import { vi } from 'vitest'

const mockFn = vi.fn()
mockFn.mockReturnValue('mocked value')
```

### Testing User Interactions
```typescript
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()
await user.click(screen.getByRole('button'))
await user.type(screen.getByRole('textbox'), 'Hello')
```

### Testing Async Operations
```typescript
import { waitFor } from '@testing-library/react'

await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})
```

## 🐛 Debugging

```bash
# Run a single test in debug mode
npm test -- button.test.tsx --reporter=verbose

# Clear test cache
rm -rf node_modules/.vitest

# Update snapshots (if using)
npm test -- -u
```

## ⚡ Performance Tips

```bash
# Run tests in parallel (default)
npm test

# Run tests sequentially (for debugging)
npm test -- --no-threads

# Limit workers
npm test -- --poolOptions.threads.maxThreads=2
```

## 📁 File Structure

```
tests/
├── setup.ts                 # Global setup
├── utils.test.ts            # Utilities
└── components/
    └── ui/
        └── button.test.tsx  # Component tests

components/
└── ui/
    ├── button.tsx           # Component
    └── button.test.tsx      # Co-located test
```

## ✅ Pre-Push Checklist

- [ ] All tests pass: `npm test`
- [ ] TypeScript compiles: `npm run type-check`
- [ ] No linting errors: `npm run lint`
- [ ] Coverage is adequate: `npm run test:coverage`
- [ ] Manual testing completed

## 🆘 Common Errors

### "ReferenceError: expect is not defined"
Add `globals: true` to vitest.config.ts

### "Module not found"
Check the path alias in vitest.config.ts and tsconfig.json

### "Cannot find module '@testing-library/jest-dom'"
Run: `npm install --save-dev @testing-library/jest-dom`

### Tests timing out
Increase timeout: `it('test', () => {}, { timeout: 10000 })`

## 🔗 Resources

- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [TESTING.md](./TESTING.md) - Full testing guide
