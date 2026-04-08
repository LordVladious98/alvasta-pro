---
summary: "Redirect: flow commands live under `alvasta-pro tasks flow`"
read_when:
  - You encounter alvasta-pro flows in older docs or release notes
title: "flows (redirect)"
---

# `alvasta-pro tasks flow`

Flow commands are subcommands of `alvasta-pro tasks`, not a standalone `flows` command.

```bash
alvasta-pro tasks flow list [--json]
alvasta-pro tasks flow show <lookup>
alvasta-pro tasks flow cancel <lookup>
```

For full documentation see [Task Flow](/automation/taskflow) and the [tasks CLI reference](/cli/index#tasks).
