import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'

export default [
  {
    ignores: [
      'node_modules',
      '.next',
      'dist',
      'coverage',
      '.venv',
      'agent-tray/dist',
      'agent-tray/build',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    rules: {
      ...js.configs.recommended.rules,
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error', 'info'],
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        React: 'readonly',
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        URLSearchParams: 'readonly',
        // Browser globals & Web APIs
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        alert: 'readonly',
        // DOM types
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLDivElement: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        WheelEvent: 'readonly',
        CustomEvent: 'readonly',
        EventTarget: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescript.configs.strict.rules,
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error', 'info'],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-constant-binary-expression': 'warn',
    },
  },
]
