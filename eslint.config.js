import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-plugin-prettier'
import importPlugin from 'eslint-plugin-import'

export default [
  // Base JS rules
  js.configs.recommended,

  // React + JSX + hooks + Prettier
  {
    files: ['**/*.{js,jsx}'],

    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true, // enable JSX parsing
        },
      },
    },

    plugins: {
      react,
      'react-hooks': reactHooks,
      prettier,
      import: importPlugin,
    },

    rules: {
      'prettier/prettier': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'import/no-unresolved': 'off',
    },

    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Vite config override
  {
    files: ['vite.config.*', 'vite.*.config.*', 'vite.config.*.*'],

    plugins: {
      import: importPlugin,
    },

    rules: {
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      'import/no-unresolved': 'off',
    },
  },
]
