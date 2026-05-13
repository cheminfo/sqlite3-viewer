import { defineConfig, globalIgnores } from 'eslint/config';
import cheminfoReact from 'eslint-config-cheminfo-react/base';
import cheminfoTypescript from 'eslint-config-cheminfo-typescript';

export default defineConfig([
  globalIgnores([
    '**/node_modules',
    '**/coverage',
    '**/lib',
    '**/dist',
    '**/vitest.config.ts',
  ]),
  ...cheminfoTypescript,
  {
    rules: {
      'new-cap': ['error', { capIsNew: false }],
      // Destructured props on React components are already documented on
      // the props interface — don't require a separate `@param props.x` line
      // for each field.
      'jsdoc/require-param': ['warn', { checkDestructured: false }],
      'jsdoc/check-param-names': ['warn', { checkDestructured: false }],
    },
  },
  {
    files: ['frontend/**/*.{ts,tsx,jsx}'],
    extends: cheminfoReact,
    rules: {
      // Async fetch-then-setState in useEffect is the canonical data-fetching
      // pattern; the new react-hooks v7 rules misclassify it.
      'react-hooks/set-state-in-effect': 'off',
      'react-you-might-not-need-an-effect/no-adjust-state-on-prop-change':
        'off',
      // React components return JSX — `@returns` adds no information.
      'jsdoc/require-returns': 'off',
    },
  },
]);
