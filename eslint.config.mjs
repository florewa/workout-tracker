import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    'vue/multi-word-component-names': 'off',
    // Vue 3 supports fragments; dialogs are intentionally teleported siblings.
    'vue/no-multiple-template-root': 'off',
    // Existing SFC style uses XML-like self-closing void elements consistently.
    'vue/html-self-closing': 'off',
  },
})
