---
summary: "CLI reference for `alvasta-pro docs` (search the live docs index)"
read_when:
  - You want to search the live Alvasta Pro docs from the terminal
title: "docs"
---

# `alvasta-pro docs`

Search the live docs index.

Arguments:

- `[query...]`: search terms to send to the live docs index

Examples:

```bash
alvasta-pro docs
alvasta-pro docs browser existing-session
alvasta-pro docs sandbox allowHostControl
alvasta-pro docs gateway token secretref
```

Notes:

- With no query, `alvasta-pro docs` opens the live docs search entrypoint.
- Multi-word queries are passed through as one search request.
