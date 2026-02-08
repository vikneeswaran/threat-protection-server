# 🚀 Local Development Environment Setup & Testing Guide

## Overview

This guide helps you test all changes locally before pushing to production (main branch). Follow these steps to ensure code quality and prevent broken builds.

---

## Part 1: Prerequisites & Initial Setup

### System Requirements
- **Node.js:** v20.20.0 or higher
- **Python:** 3.11+ (for agent-tray builds)
- **Git:** Latest version
- **OS:** Windows, macOS, or Linux

### Verify your Environment
```bash
# Check Node.js version
node --version      # Should be v20.20.0 or higher

# Check npm version
npm --version       # Should be v10.8.2 or higher

# Check Python version (for agent builds)
python --version    # Should be 3.11+
```

---

## Part 2: Local Development Workflow

### Step 1: Create a Development Branch
```bash
# Make sure you're on main and up to date
git checkout main
git pull origin main

# Create a new feature branch
git checkout -b feature/your-feature-name
# OR for bug fixes:
git checkout -b fix/bug-name
```

### Step 2: Make Your Changes
Edit the files you need to change. Keep commits focused on single features/fixes.

```bash
# Make changes to your code...
# Then stage your changes
git add .

# Commit with a clear message
git commit -m "feat: description of your change"
# OR
git commit -m "fix: description of the fix"
```

---

## Part 3: Full Local Testing (Before Push)

Run these commands in this exact order to simulate the CI/CD pipeline:

### Option A: Quick Test (3-5 minutes)
```bash
# 1. Install/update dependencies
npm install

# 2. Run tests
npm test -- --run

# 3. Check types
npm run type-check
```

**Success criteria:** All tests pass, zero TypeScript errors

### Option B: Full Validation (5-10 minutes) ⭐ RECOMMENDED
```bash
# This runs lint + type-check + tests (same as CI/CD)
npm run validate
```

**Success criteria:**
- ✅ ESLint passes (or only warnings for intentional code patterns)
- ✅ TypeScript has 0 errors
- ✅ All 15 tests pass

### Option C: Complete Test with Coverage (10-15 minutes)
```bash
# Install dependencies
npm install

# Run full validation
npm run validate

# Generate coverage report
npm run test:coverage

# View coverage in browser (optional)
# Open: coverage/coverage-final.json or check terminal output
```

---

## Part 4: Testing Specific Components

### Test Only Unit Tests
```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm test -- --watch

# Run tests with UI dashboard
npm run test:ui
```

### Test Only Linting
```bash
# Check for linting issues
npm run lint

# Auto-fix fixable issues
npm run lint:fix
```

### Test Only TypeScript
```bash
# Type check without emitting files
npm run type-check
```

---

## Part 5: Testing API Routes Locally

### Start Development Server
```bash
# Terminal 1: Start the Next.js dev server
npm run dev
# Server runs at http://localhost:3000
```

### Test API Endpoints
```bash
# Terminal 2: Test an endpoint
# Example: Test agent registration

curl -X POST http://localhost:3000/api/agent/register \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"test-agent","status":"online"}'

# Example: Test health check
curl http://localhost:3000/api/health
```

### Browser Testing
1. Open http://localhost:3000
2. Navigate through dashboard pages
3. Check console for errors (F12 → Console tab)
4. Test forms and interactions

---

## Part 6: Testing Agent Tray Installer Locally

### Setup Python Environment
```bash
cd agent-tray

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install pyinstaller
```

### Build Installer
```bash
# On Windows (build MSI)
cd build
powershell -ExecutionPolicy Bypass -File build-windows-msi.ps1

# On macOS (build PKG)
cd build
chmod +x pkgbuild-mac.sh
./pkgbuild-mac.sh

# On Linux (build TAR.GZ)
cd ..
rm -rf dist/KuaminiSecurityClient
pyinstaller main.py --onedir --name=KuaminiSecurityClient -y
tar -czf dist/KuaminiSecurityClient-linux.tar.gz -C dist KuaminiSecurityClient
```

### Verify Installer
- **Windows:** Check `agent-tray/build/*.msi` exists and is > 10MB
- **macOS:** Check `agent-tray/build/*.pkg` exists and is > 10MB
- **Linux:** Check `agent-tray/dist/*.tar.gz` exists and is > 5MB

---

## Part 7: Pre-Push Checklist

Before pushing to GitHub, verify all of these:

### Code Quality
- [ ] `npm run validate` passes completely
- [ ] No linting errors (only warnings acceptable for now)
- [ ] All 15 tests pass
- [ ] TypeScript has 0 errors
- [ ] Your IDE shows no red squiggles

### Functionality
- [ ] Tested your changes in `npm run dev`
- [ ] Verified API endpoints work (if you changed them)
- [ ] Tested in browser (if you changed UI)
- [ ] No console errors in browser (F12)
- [ ] No runtime errors in terminal

### Git Hygiene
- [ ] Commits have clear, descriptive messages
- [ ] Commits are logically organized (one feature per commit)
- [ ] No accidental files committed (check `.gitignore`)
- [ ] You're on your feature branch, NOT on main

### Documentation (if applicable)
- [ ] Updated README if dependencies changed
- [ ] Added comments for complex logic
- [ ] Updated TESTING.md if test structure changed

---

## Part 8: Pushing to GitHub

```bash
# Push your feature branch
git push origin feature/your-feature-name

# Go to GitHub and create a Pull Request
# 1. Go to: https://github.com/YOUR_USERNAME/threat-protection-agent
# 2. Click "Compare & pull request"
# 3. Write clear PR description
# 4. Request reviewers (if applicable)
# 5. Submit PR

# CI/CD will automatically run:
# ✅ Linter
# ✅ Type check
# ✅ Tests (15 tests)
# ✅ Build installers (macOS, Windows, Linux)
```

### Review CI/CD Results
1. Wait for all checks to pass ✅
2. Check "Actions" tab in GitHub
3. View detailed logs if anything fails
4. Fix any issues and push again

---

## Part 9: Merging to Main

Once all checks pass and PR is approved:

```bash
# Option 1: Merge via GitHub Web UI (recommended)
# Click "Merge pull request" button on GitHub

# Option 2: Merge via command line
git checkout main
git pull origin main
git merge feature/your-feature-name
git push origin main

# Delete feature branch
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

---

## Part 10: Troubleshooting Common Issues

### Tests Fail Locally But Work on CI/CD
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install

# Clear test cache
npm test -- --clearCache

# Run tests again
npm test -- --run
```

### TypeScript Errors Only in IDE
```bash
# Rebuild TypeScript cache
npm run type-check

# If still broken, try:
rm -rf .next
npm run build
```

### Linting Errors After ESLint Update
```bash
# Auto-fix what you can
npm run lint:fix

# Review remaining errors
npm run lint

# Fix manually if needed
```

### Port 3000 Already in Use
```bash
# Find process using port 3000
# On Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# On macOS/Linux:
lsof -i :3000
kill -9 <PID>

# Or use different port:
npm run dev -- -p 3001
```

### Agent Tray Build Fails
```bash
# Ensure Python dependencies are installed
pip install -r requirements.txt
pip install pyinstaller --upgrade

# Clear PyInstaller cache
rm -rf build dist *.spec

# Try building again with verbose output
pyinstaller main.py -v
```

---

## Part 11: Testing Guide

### Test Framework Setup

This project uses **Vitest** for unit and integration testing, along with **React Testing Library** for component testing.

### Quick Test Commands

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

### Running Specific Tests

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

### Writing Tests

#### Component Tests

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

#### API Route Tests

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

#### Utility Function Tests

```typescript
import { describe, it, expect } from 'vitest'
import { myUtilFunction } from '@/lib/utils'

describe('myUtilFunction', () => {
  it('should return expected result', () => {
    expect(myUtilFunction(input)).toBe(expectedOutput)
  })
})
```

### Test Coverage Requirements

- **Target:** 70%+ overall coverage
- **Critical paths:** 90%+ coverage
  - Authentication flows
  - Agent registration
  - Heartbeat mechanism
  - Threat reporting
  - License management

### Mocking in Tests

#### Environment Variables
Environment variables are mocked in `tests/setup.ts`:

```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
```

#### Next.js Router
The router is automatically mocked in the setup file:

```typescript
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}))
```

#### Supabase Client
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

### Test Debugging

```bash
# Run a single test in debug mode
npm test -- button.test.tsx --reporter=verbose

# Clear test cache
rm -rf node_modules/.vitest

# Update snapshots (if using)
npm test -- -u
```

### Testing Best Practices

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

### Coverage Reports

```bash
# Generate HTML coverage report
npm run test:coverage

# View coverage report
# Open: coverage/index.html in your browser

# Coverage thresholds
# Overall: 70%+
# Critical paths: 90%+
```

### Common Test Errors

#### "ReferenceError: expect is not defined"
Add `globals: true` to vitest.config.ts

#### "Module not found"
Check the path alias in vitest.config.ts and tsconfig.json

#### "Cannot find module '@testing-library/jest-dom'"
Run: `npm install --save-dev @testing-library/jest-dom`

#### Tests timing out
Increase timeout: `it('test', () => {}, { timeout: 10000 })`

### Testing Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## Part 12: Quick Command Reference

| Task | Command | Time |
|------|---------|------|
| Quick validation | `npm run validate` | 2-3 min |
| Run tests only | `npm test -- --run` | 1-2 min |
| Run linter only | `npm run lint` | 1 min |
| Type check only | `npm run type-check` | <1 min |
| Start dev server | `npm run dev` | instant |
| Fix linting automatically | `npm run lint:fix` | 1 min |
| Generate coverage | `npm run test:coverage` | 3-5 min |
| Test UI dashboard | `npm run test:ui` | instant |

---

## Part 13: Development Best Practices

### Commit Message Format
```
feat: add new feature description
fix: fix bug description
docs: update documentation
test: add/update tests
refactor: code refactoring
style: formatting/code style
chore: maintenance tasks
```

### Branch Naming
```
feature/feature-name          # New feature
fix/bug-name                  # Bug fix
docs/documentation-name       # Documentation
refactor/refactoring-name     # Code refactoring
test/test-name                # Test improvements
```

### Before Each Push
1. **Always run `npm run validate`** - This is the final check
2. **Check git status** - `git status` - Only your changes should be there
3. **Review your commits** - `git log --oneline -5` - Clear messages?
4. **Test in browser** if UI changed - `npm run dev`

---

## Summary

### Development Workflow
```
1. git checkout -b feature/your-feature
2. Make changes
3. npm run validate (must pass ✅)
4. npm run dev (visual check optional)
5. git push origin feature/your-feature
6. Create PR on GitHub
7. Wait for CI/CD (automatically runs tests)
8. Merge to main when all checks pass ✅
```

### Testing Takes ~3-5 minutes
- Type-check: <1 min
- Tests: 1-2 min
- Lint: 1 min
- **Total: 2-4 minutes** of actual time (most is setup/environment)

### You're Ready! 🎉
Follow this workflow and you'll have a solid, tested development process!

---

**Questions?** Check the other documentation files:
- [TESTING.md](./TESTING.md) - Detailed testing guide
- [TEST_COMMANDS.md](./TEST_COMMANDS.md) - Command reference
- [ESLINT_SETUP_COMPLETE.md](./ESLINT_SETUP_COMPLETE.md) - Linting details
