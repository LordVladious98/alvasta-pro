---
summary: "CLI reference for `alvasta-pro agents` (list/add/delete/bindings/bind/unbind/set identity)"
read_when:
  - You want multiple isolated agents (workspaces + routing + auth)
title: "agents"
---

# `alvasta-pro agents`

Manage isolated agents (workspaces + auth + routing).

Related:

- Multi-agent routing: [Multi-Agent Routing](/concepts/multi-agent)
- Agent workspace: [Agent workspace](/concepts/agent-workspace)
- Skill visibility config: [Skills config](/tools/skills-config)

## Examples

```bash
alvasta-pro agents list
alvasta-pro agents list --bindings
alvasta-pro agents add work --workspace ~/.alvasta-pro/workspace-work
alvasta-pro agents add ops --workspace ~/.alvasta-pro/workspace-ops --bind telegram:ops --non-interactive
alvasta-pro agents bindings
alvasta-pro agents bind --agent work --bind telegram:ops
alvasta-pro agents unbind --agent work --bind telegram:ops
alvasta-pro agents set-identity --workspace ~/.alvasta-pro/workspace --from-identity
alvasta-pro agents set-identity --agent main --avatar avatars/alvasta-pro.png
alvasta-pro agents delete work
```

## Routing bindings

Use routing bindings to pin inbound channel traffic to a specific agent.

If you also want different visible skills per agent, configure
`agents.defaults.skills` and `agents.list[].skills` in `alvasta-pro.json`. See
[Skills config](/tools/skills-config) and
[Configuration Reference](/gateway/configuration-reference#agentsdefaultsskills).

List bindings:

```bash
alvasta-pro agents bindings
alvasta-pro agents bindings --agent work
alvasta-pro agents bindings --json
```

Add bindings:

```bash
alvasta-pro agents bind --agent work --bind telegram:ops --bind discord:guild-a
```

If you omit `accountId` (`--bind <channel>`), Alvasta Pro resolves it from channel defaults and plugin setup hooks when available.

If you omit `--agent` for `bind` or `unbind`, Alvasta Pro targets the current default agent.

### Binding scope behavior

- A binding without `accountId` matches the channel default account only.
- `accountId: "*"` is the channel-wide fallback (all accounts) and is less specific than an explicit account binding.
- If the same agent already has a matching channel binding without `accountId`, and you later bind with an explicit or resolved `accountId`, Alvasta Pro upgrades that existing binding in place instead of adding a duplicate.

Example:

```bash
# initial channel-only binding
alvasta-pro agents bind --agent work --bind telegram

# later upgrade to account-scoped binding
alvasta-pro agents bind --agent work --bind telegram:ops
```

After the upgrade, routing for that binding is scoped to `telegram:ops`. If you also want default-account routing, add it explicitly (for example `--bind telegram:default`).

Remove bindings:

```bash
alvasta-pro agents unbind --agent work --bind telegram:ops
alvasta-pro agents unbind --agent work --all
```

`unbind` accepts either `--all` or one or more `--bind` values, not both.

## Command surface

### `agents`

Running `alvasta-pro agents` with no subcommand is equivalent to `alvasta-pro agents list`.

### `agents list`

Options:

- `--json`
- `--bindings`: include full routing rules, not only per-agent counts/summaries

### `agents add [name]`

Options:

- `--workspace <dir>`
- `--model <id>`
- `--agent-dir <dir>`
- `--bind <channel[:accountId]>` (repeatable)
- `--non-interactive`
- `--json`

Notes:

- Passing any explicit add flags switches the command into the non-interactive path.
- Non-interactive mode requires both an agent name and `--workspace`.
- `main` is reserved and cannot be used as the new agent id.

### `agents bindings`

Options:

- `--agent <id>`
- `--json`

### `agents bind`

Options:

- `--agent <id>` (defaults to the current default agent)
- `--bind <channel[:accountId]>` (repeatable)
- `--json`

### `agents unbind`

Options:

- `--agent <id>` (defaults to the current default agent)
- `--bind <channel[:accountId]>` (repeatable)
- `--all`
- `--json`

### `agents delete <id>`

Options:

- `--force`
- `--json`

Notes:

- `main` cannot be deleted.
- Without `--force`, interactive confirmation is required.
- Workspace, agent state, and session transcript directories are moved to Trash, not hard-deleted.

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:

- Example path: `~/.alvasta-pro/workspace/IDENTITY.md`
- `set-identity --from-identity` reads from the workspace root (or an explicit `--identity-file`)

Avatar paths resolve relative to the workspace root.

## Set identity

`set-identity` writes fields into `agents.list[].identity`:

- `name`
- `theme`
- `emoji`
- `avatar` (workspace-relative path, http(s) URL, or data URI)

Options:

- `--agent <id>`
- `--workspace <dir>`
- `--identity-file <path>`
- `--from-identity`
- `--name <name>`
- `--theme <theme>`
- `--emoji <emoji>`
- `--avatar <value>`
- `--json`

Notes:

- `--agent` or `--workspace` can be used to select the target agent.
- If you rely on `--workspace` and multiple agents share that workspace, the command fails and asks you to pass `--agent`.
- When no explicit identity fields are provided, the command reads identity data from `IDENTITY.md`.

Load from `IDENTITY.md`:

```bash
alvasta-pro agents set-identity --workspace ~/.alvasta-pro/workspace --from-identity
```

Override fields explicitly:

```bash
alvasta-pro agents set-identity --agent main --name "Alvasta Pro" --emoji "🦞" --avatar avatars/alvasta-pro.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "Alvasta Pro",
          theme: "space lobster",
          emoji: "🦞",
          avatar: "avatars/alvasta-pro.png",
        },
      },
    ],
  },
}
```
