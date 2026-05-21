# ADR: Taxonomia Publica de Planos

## Status
Aceita

## Decisao
O Life OS passa a expor a hierarquia publica de planos com a seguinte linguagem:

- `Meta` continua `Meta`
- `okr` passa a aparecer como `Projeto`
- `macro` passa a aparecer como `Entrega`
- `micro` passa a aparecer como `Ação`

## Limites
Esta mudanca e apenas de linguagem publica. Nao muda:

- `state.entities.metas/okrs/macros/micros`
- ids, colecoes, chaves persistidas e vinculos
- `linkedMetaId`, `linkedOKRId`, `linkedMacroId`
- `data-tab`, `data-view`, `data-painel-screen`, `data-focus-type`
- formato atual de import/export

## Regras de implementacao
- Texto visivel deve usar Meta, Projeto, Entrega e Acao.
- Filtros e valores estruturais continuam usando as chaves internas atuais.
- O Painel deve manter compatibilidade com `OKRs`, `Macros` e `Micros` nos atributos `data-focus-type`.
- Qualquer fallback ou renderizacao deve mapear aliases publicos para os tipos internos, nunca o contrario.

## Consequencias
- O rebranding nao exige migracao de dados.
- A UI fica coerente para o usuario final sem reabrir o risco de regressao nos fluxos corrigidos de foco, habitos e vinculos.
