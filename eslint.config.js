const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      'design-reference/**',
      '.expo/**',
      'dist/**',
      'coverage/**',
      '**/*.json',
    ],
  },
  {
    rules: {
      // Design values belong in theme/tokens.ts. Catching every drift is a review job,
      // but a raw hex in a component is mechanical enough to fail the build on.
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]",
          message: 'Hardcoded color. Add it to theme/tokens.ts and read it from useTheme().',
        },
      ],
    },
  },
  {
    // tokens.ts is where the values live; tests assert them literally on purpose.
    files: ['theme/tokens.ts', '**/__tests__/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['jest.setup.js', '**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        require: 'readonly',
        module: 'writable',
      },
    },
  },
];
