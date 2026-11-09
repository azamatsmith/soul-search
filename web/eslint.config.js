import js from '@eslint/js'
import perfectionist from 'eslint-plugin-perfectionist'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: { perfectionist },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'perfectionist/sort-jsx-props': ['error', { type: 'alphabetical' }],
      'perfectionist/sort-interfaces': [
        'error',
        {
          type: 'alphabetical',
          useConfigurationIf: { declarationMatchesPattern: 'Props$' },
        },
        { type: 'unsorted' },
      ],
      'perfectionist/sort-objects': [
        'error',
        {
          type: 'alphabetical',
          useConfigurationIf: {
            objectType: 'destructured',
            matchesAstSelector: ':function > ObjectPattern',
          },
        },
        { type: 'unsorted' },
      ],
    },
  },
)
