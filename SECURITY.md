# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x | Yes |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email **dev@rovemark.com** with details
3. Include steps to reproduce if possible
4. We will respond within 48 hours

## Security Measures

Logica Context includes several security layers:

- **Command validation** — blocks dangerous patterns (`rm -rf /`, `sudo`, pipe-to-shell)
- **Path restrictions** — prevents access to `.ssh/`, `.env`, `/etc/passwd`
- **Output sanitization** — redacts API keys, tokens, private keys from output
- **Sandboxed execution** — timeout and resource limits on all commands
- **No network by default** — sandbox doesn't make network calls unless explicitly requested

## Scope

This policy covers the `logica-context` npm package and the `Rovemark/logica-context` GitHub repository.
