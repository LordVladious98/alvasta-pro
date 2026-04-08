# MiniMax (Alvasta Pro plugin)

Bundled MiniMax plugin for both:

- API-key provider setup (`minimax`)
- Token Plan OAuth setup (`minimax-portal`)

## Enable

```bash
alvasta-pro plugins enable minimax
```

Restart the Gateway after enabling.

```bash
alvasta-pro gateway restart
```

## Authenticate

OAuth:

```bash
alvasta-pro models auth login --provider minimax-portal --set-default
```

API key:

```bash
alvasta-pro setup --wizard --auth-choice minimax-global-api
```

## Notes

- MiniMax OAuth uses a user-code login flow.
- OAuth currently targets the Token Plan path.
