# Decisões pedagógicas — piloto do Théo

Decisões que o código tomou e o estado de ratificação de cada uma. Cada entrada diz o que está
implementado hoje, por que está assim e, se ainda estiver aberta, o que falta para fechar.

## 1. Escala de confiança do estudante — DECIDIDA (02/09/2026)

**Decisão:** mantém-se `baixa | media | alta`, em **um único compromisso clínico por encontro**. O
debrief não avalia automaticamente a calibração dessa confiança, e o dado **não** é tratado como
equivalente à confiança em questão objetiva.

**Implementado:** `Confianca = "baixa" | "media" | "alta"` (`src/lib/theo-engine.ts`), com três botões
na estação e registro no event log com horário.

**Por que fechou assim:** a decisão anterior era alinhar à escala de confiança das questões do Treino
ENAMED. Auditoria somente leitura daquele repositório mostrou que **não existe escala viva para
alinhar**:

- a coleta de confiança foi **removida da tela por atrito** (commit `a6af91b`, 02/08/2026: "removidos
  o seletor de confiança e a alternativa 'Não tenho certeza' — decisão do coordenador: pouca função,
  atrito alto");
- `src/Training.tsx` grava `confidence: 2` **fixo**, então toda linha de `attempts` tem o mesmo valor;
- não há uso analítico: a métrica `high_confidence_errors` foi substituída por `erros_rapidos`
  (migração `20260809200000`), que deriva o sinal do tempo de resposta e **não pergunta nada ao aluno**;
- a única escala que existiu lá era exatamente Baixa/Média/Alta — a mesma que este piloto já usa.

Além disso o construto difere: confiança numa escolha de múltipla escolha é calibrável contra
gabarito; confiança numa representação do problema em texto livre não tem gabarito contra o qual
calibrar sem leitura humana. Mesma palavra, aritmética diferente.

**Se o ecossistema voltar a coletar confiança declarada** e escolher escala numérica, a mudança é de
ecossistema (os dois apps), não deste piloto. Onde mexer, nesse caso: o tipo `Confianca` e
`CONFIANCA_LABEL` em `src/lib/theo-engine.ts`, o seletor em `src/components/theo-station.tsx`, e a
evidência do item `raciocinio-declarado` no debrief.

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
