# Testing Guide

## Overview

This project uses **Vitest** for unit and integration testing, along with **React Testing Library** for component testing.

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Test Structure

```
tests/
├── setup.ts              # Global test setup and mocks
├── utils.test.ts         # Utility function tests
└── components/           # Component tests
    └── ui/
        └── button.test.tsx
```

## Writing Tests

### Component Tests

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
  
  it('should handle user interaction', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    
    render(<MyComponent onClick={handleClick} />)
    await user.click(screen.getByRole('button'))
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### API Route Tests

```typescript
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

describe('API Route', () => {
  it('should validate request body', async () => {
    const mockRequest = {
      json: async () => ({ field: 'value' }),
    } as NextRequest
    
    // Test your API logic
  })
})
```

### Utility Function Tests

```typescript
import { describe, it, expect } from 'vitest'
import { myUtilFunction } from '@/lib/utils'

describe('myUtilFunction', () => {
  it('should return expected result', () => {
    expect(myUtilFunction(input)).toBe(expectedOutput)
  })
})
```

## Coverage Requirements

- **Target:** 70%+ overall coverage
- **Critical paths:** 90%+ coverage
  - Authentication flows
  - Agent registration
  - Heartbeat mechanism
  - Threat reporting
  - License management

## Running Specific Tests

```bash
# Run tests for a specific file
npm test -- button.test.tsx

# Run tests matching a pattern
npm test -- --grep "Button"

# Run tests in a specific directory
npm test -- components/ui
```

## Mocking

### Environment Variables
Environment variables are mocked in `tests/setup.ts`:

```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
```

### Next.js Router
The router is automatically mocked in the setup file:

```typescript
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}))
```

### Supabase Client
Mock Supabase in your tests:

```typescript
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
    })),
  })),
}))
```

## Continuous Integration

Tests run automatically on every push via GitHub Actions:

1. Install dependencies
2. Run linter
3. Run type checking
4. Run tests
5. Generate coverage report
6. Upload to Codecov (optional)

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what the user sees and does
   - Avoid testing internal component state

2. **Use Descriptive Test Names**
   ```typescript
   it('should display error message when form submission fails')
   ```

3. **Arrange-Act-Assert Pattern**
   ```typescript
   // Arrange
   const user = userEvent.setup()
   render(<Component />)
   
   // Act
   await user.click(screen.getByRole('button'))
   
   // Assert
   expect(screen.getByText('Success')).toBeInTheDocument()
   ```

4. **Clean Up After Tests**
   - Cleanup is automatic with React Testing Library
   - Clear mocks between tests with `vi.clearAllMocks()`

5. **Test Accessibility**
   ```typescript
   expect(screen.getByRole('button', { name: /submit/i }))
   ```

## Debugging Tests

### Run Tests in Debug Mode

```bash
# Node.js debugging
node --inspect-brk node_modules/.bin/vitest

# VS Code debugging
# Add to .vscode/launch.json:
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test"],
  "console": "integratedTerminal"
}
```

### Common Issues

1. **Tests timing out**
   - Increase timeout: `it('test', async () => {}, { timeout: 10000 })`

2. **Act warnings**
   - Wrap state updates in `act()` or use `waitFor()`

3. **Mock not working**
   - Ensure mock is defined before import
   - Use `vi.mock()` at the top level

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
