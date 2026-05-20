# Public Taxonomy Map

Status: accepted

Date: 2026-05-20

## Decision

The Life OS public product language uses:

- `Meta` for the long-term layer
- `Projeto` for the former internal `okr` layer
- `Entrega` for the former internal `macro` layer
- `Acao` for the former internal `micro` layer

## Internal Contract Rule

Internal data contracts remain unchanged for stability:

- `state.entities.metas`
- `state.entities.okrs`
- `state.entities.macros`
- `state.entities.micros`

The same rule applies to related ids, parent references, filters, persistence keys,
review flows, sync logic, and analytics/gamification events.

This is a public-language rebrand, not a storage or domain-schema migration.

## Mapping

| Internal contract | Public label |
| --- | --- |
| `metas` | `Meta` / `Metas` |
| `okrs` | `Projeto` / `Projetos` |
| `macros` | `Entrega` / `Entregas` |
| `micros` | `Acao` / `Acoes` |

## Implementation Rule

When editing UI, manual text, notifications, onboarding, cards, or planning copy:

1. Keep internal contracts untouched.
2. Prefer shared label helpers when possible.
3. Audit visible strings before release to avoid mixed old/new terminology.

## Why

The former `OKR / Macro / Micro` wording was technically precise but too internal
and methodology-heavy for the public product experience. The chosen language keeps
the hierarchy understandable while making the app feel more personal and less
corporate.
