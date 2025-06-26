module.exports = {
  extends: "next/core-web-vitals",
  rules: {
    // Disable TypeScript any errors for API routes  
    "@typescript-eslint/no-explicit-any": "off",
  },
  overrides: [
    {
      files: ["app/api/**/*.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
}; 