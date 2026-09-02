# Decisões pedagógicas pendentes — piloto do Théo

Decisões que o código **tomou provisoriamente** e que aguardam ratificação. Cada entrada diz o que
está implementado hoje, por que está assim e o que falta para fechar.

## 1. Escala de confiança do estudante — PENDENTE

**Implementado hoje:** `Confianca = "baixa" | "media" | "alta"` (`src/lib/theo-engine.ts`), com três
botões na estação.

**Por que assim:** escolhi ordinal para não sugerir precisão de calibração que o motor não mede.

**Por que é pendente:** a decisão acordada é coletar a confiança **de forma comparável à confiança das
questões do Treino ENAMED** — autorrelato para calcular calibração depois, o que não é nota e não
afirma correção. Escala ordinal de três níveis provavelmente não é a mesma escala usada lá, e
converter depois perde informação.

**O que falta:** confirmar a escala usada no Treino ENAMED (`itairanterres-gif/Treino-enamed`) e
alinhar esta a ela. Até então **não mudar** — trocar de escala duas vezes invalida qualquer dado já
coletado no piloto.

**Onde mexer quando decidir:** o tipo `Confianca` e `CONFIANCA_LABEL` em `src/lib/theo-engine.ts`, o
seletor em `src/components/theo-station.tsx`, e a evidência do item `raciocinio-declarado` no debrief.

## 2. Exames decisivos deste caso — configurado como vazio

**Implementado hoje:** `theoGating.examesDecisivos = []` em `src/lib/case-theo.ts`. A capacidade de
exigir compromisso diagnóstico antes de um exame existe e está **desligada** para o Théo.

**Por que assim:** a crise do Théo se avalia clinicamente. Radiografia, gasometria e hemograma não
decidem o diagnóstico dele, e bloquear todos criaria regra artificial.

**O que falta:** decidir se algum exame deste caso deve ser tratado como decisivo, ou se o gate só
passa a valer em casos futuros cuja definição diagnóstica dependa de exame. As chaves disponíveis
são as de `TEST_MAP`: `radiografia`, `gasometria`, `hemograma`.

## 3. Curadoria clínica do caso — PENDENTE (bloqueia exposição a estudante)

`theoProvenance.statusCuracao` segue `"provisorio"` e `revisadoPor` segue `null`. O próprio
`avisoCuracao` exige aprovação por pediatra responsável antes de liberar a estudantes. O
endurecimento desta branch não altera isso.
