// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  //tseslint.configs.stylisticTypeChecked,
  tseslint.configs.recommendedTypeChecked,
  //tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
      projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/promise-function-async": "error",
      "@typescript-eslint/prefer-literal-enum-member": ["error", { allowBitwiseExpressions: true }],
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "off",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unnecessary-template-expression": "off"
    },
  },
);
