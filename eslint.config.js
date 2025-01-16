import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";

export default [
  eslint.configs.recommended,
  {
    "plugins": {
      "@stylistic": stylistic,
    },
    "rules": {
      // eslint - https://eslint.org/docs/latest/rules/
      "eqeqeq": ["error"],
      "vars-on-top": ["error"],
      "no-eq-null": ["error"],
      "no-label-var": ["error"],
      "camelcase": ["error"],
      "no-multi-assign": ["error"],
      "no-var": ["error"],
      "prefer-const": ["error"],
      "no-console": [0],
      "no-constant-condition": [0],
      "object-curly-spacing": [2, "always"],
      "indent": ["error", 2, { "ignoredNodes": ["TemplateLiteral *"] }],

      "no-unused-vars": [0],
      "no-undef": [0],

      // @stylistic - https://eslint.style/packages/default#rules
      "@stylistic/linebreak-style": [
        "error",
        "unix",
      ],
      "@stylistic/no-mixed-spaces-and-tabs": ["error"],
      "@stylistic/operator-linebreak": ["error", "before"],
      "@stylistic/max-len": ["error", {
        "code": 80,
        "ignoreTemplateLiterals": true,
      }],
      "@stylistic/no-trailing-spaces": ["error"],
      "@stylistic/eol-last": ["error", "always"],
      "@stylistic/dot-location": ["error", "property"],
      "@stylistic/type-annotation-spacing": "error",
      "@stylistic/comma-dangle": ["error", "always-multiline"],
      "@stylistic/semi": ["error", "always"],
      "@stylistic/space-before-blocks": ["error", "always"],
      "@stylistic/quotes": [
        "error",
        "double",
      ],
      "@stylistic/key-spacing": ["error", { "beforeColon": false }],
      "@stylistic/keyword-spacing": ["error"],
    },
  },
  {
    ignores: ["*/**/*.min.js", "*/**/lit.js"],
  },
];
