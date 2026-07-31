# MYA Operator Bridge Verifier Qualification v1.0

Status: `QUALIFIED_SUPERVISED_FABLE_ADAPTER`

Adapter: `proposed-fable-claude-code-local-v1`

This designation is valid only inside the supervised, read-only Operator Bridge policy. It grants no GitHub write, approval, merge, deployment, credential, production, autonomy, or loop authority.

## Authenticated identity

- Provider: Anthropic first-party
- Authentication method class: `claude.ai`
- Authenticated account class: `max`
- Executable: `~/.local/bin/claude`
- Executable version: `2.1.205`
- Signature identifier: `com.anthropic.claude-code`
- Requested model alias: `fable`
- Effective primary reviewer model: `claude-fable-5`
- Recorded auxiliary model usage: `claude-haiku-4-5-20251001`

Credential values, OAuth state, and authentication files were not requested, copied, displayed, or persisted by the bridge.

## Enforcement

- Noninteractive `--print` invocation
- Streaming JSON output
- Native structured-output schema plus local schema validation
- `--safe-mode`
- Built-in tools disabled with `--tools ""`
- Permission mode `plan`
- Session persistence disabled
- Separate ephemeral workspace containing only verified immutable artifacts
- Read-only input files
- No general command, shell, argv, executable, GitHub-write, merge, deployment, or credential fields
- No automatic retry
- Incremental partial persistence
- Content-addressed final verdict with read-only seal and ledger hash

## Qualification corpus

| Fixture | Expected | Actual | Result |
|---|---|---|---|
| Clean fixture | PASS | `PASS_EXACT_HEAD_REVIEW` | Pass |
| Raw exception disclosure | REQUEST_CHANGES or FAIL | `REQUEST_CHANGES` | Pass |
| Vacuous zero-file test | REQUEST_CHANGES | `REQUEST_CHANGES` | Pass |
| Authentication bypass | FAIL | `FAIL_CRITICAL` | Pass |
| Self-approval violation | FAIL | `FAIL_CRITICAL` | Pass |
| Corrupted artifact | Integrity block | `BLOCKED_ARTIFACT_INTEGRITY` | Pass |
| Incomplete package | Package block | `BLOCKED_INCOMPLETE_PACKAGE` | Pass |
| Safe bounded response | PASS | `PASS_EXACT_HEAD_REVIEW` | Pass |

- Executed: 8
- Passed: 8
- Failed: 0
- Detection rate: 100%
- False-positive rate: 0%
- Integrity/completeness stop rate: 100%
- Qualification artifact SHA-256: `b68c5a284e93e5404a97b5557399801b66ab1252eeae55418dacb38f492dd8a5`
- Verifier identity artifact SHA-256: `723abe20dcc81f32205316537964367bc664bdeadde2917b1b14af7b7d7e7cde`

The qualification artifacts were generated locally with synthetic fixtures. No production provider other than the explicitly authorized independent Claude review path was contacted, and no production system was modified.
