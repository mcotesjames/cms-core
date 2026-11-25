# Component rules

- Public components render CMS content through `useShow()` and carry the canvas attributes (`data-cms`, `data-cms-image`, `data-cms-section`, `data-cms-item`) the Studio edits and comments on; a new public component follows the same pattern as `components/sections/PageSections.tsx`. Why: every element a visitor sees stays editable and commentable in place.
- Public components use the `.site-*` classes and tokens in `src/styles.css`, never Tailwind colour utilities or hardcoded colours. Why: a site restyles the skeleton from one place.
