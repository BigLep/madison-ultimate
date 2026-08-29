import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      // React Compiler rules (eslint-plugin-react-hooks 6). This app does not
      // enable the compiler; existing effects and hash routing would fail them.
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      // AGENTS.md Styling Guidelines: never compute a style VALUE with branching logic; branch
      // on className instead (a static style object referencing a CSS variable, e.g.
      // style={{color: 'var(--x)'}}, is fine and unaffected by this rule). Found three times
      // in review before this rule existed, despite the guideline being documented with
      // explicit good/bad examples — this makes it a build error instead of relying on review.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSXAttribute[name.name="style"] JSXExpressionContainer ObjectExpression Property[value.type="ConditionalExpression"]',
          message:
            'Do not compute a style value with a ternary (AGENTS.md Styling Guidelines). Use a conditional className instead, e.g. className={condition ? "text-green-400" : "text-[var(--secondary-text)]"}.',
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'scripts/**',
  ]),
])

export default eslintConfig
