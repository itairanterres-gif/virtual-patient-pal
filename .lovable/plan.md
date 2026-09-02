# Estação canônica do Théo (dispneia-crianca)

Escopo restrito ao caso `dispneia-crianca`. Joana, Marcos e o restante do banco ficam intactos, assim como o acabamento visual do projeto.

## Fase 1 — Motor clínico determinístico

**Novo `src/lib/case-theo.ts`** com a verdade canônica separada por ator:

- **Théo (6 anos)**: só sensações e medos — "meu peito aperta", "cansa pra falar", "tenho medo da máscara". Nada de números, ausculta, exames ou diagnóstico.
- **Mãe**: linha do tempo (coriza há 3 dias, chiado há 24h), salbutamol em casa, 4 crises anteriores, última há 4 meses, rinite, mãe asmática, preocupações.
- **Equipe**: canal puramente operacional — confirma pedidos, preparo, execução, resultados recebidos e mudanças observadas; nunca revela fato clínico ainda não obtido.

Cada fato tem `actor`, `id`, escopo e estado no ledger. O antecedente "a mãe tem asma" é marcado como **familiar**, separado inequivocamente dos antecedentes pessoais de Théo (rinite alérgica, crises prévias).


**Estado clínico simulado** (dono exclusivo do motor, nunca do React): tempo clínico, SpO₂, FC, FR, capacidade de falar (frases / palavras / monossílabos), esforço respiratório, entrada de ar, sibilância, qualidade do sinal do oxímetro e flag de escalonamento de segurança.

**Ciclo de intervenção** obrigatório para toda ação:
`proposta → esclarecimento (se incompleta) → confirmação → preparo → execução → efeito`.
Faltando dose, via, dispositivo ou alvo, o motor devolve um pedido de esclarecimento — nunca completa sozinho.

**Eventos independentes por tempo**: 6 min sem oxigênio efetivo → SpO₂ 89% e fala em palavras isoladas; 10 min sem salbutamol efetivo → esforço crítico e entrada de ar criticamente reduzida; 14 min ainda instável → escalonamento de segurança.

**Efeitos**: oxigênio confirmado eleva SpO₂ após preparo e latência; salbutamol melhora esforço, entrada de ar e sibilância podendo elevar FC; ipratrópio é adjuvante; prednisolona não gera melhora aguda.

**Event log causal** com tipos distintos: observação, decisão, confirmação, execução, efeito e evento independente — cada um com tempo clínico e vínculo causal ao que o originou.

`src/lib/engine.ts` ganha os tipos compartilhados (ator, estado clínico, ciclo de ordem, evento causal) sem quebrar Joana/Marcos. `src/lib/engine-registry.ts` passa a registrar o Théo por `case-theo.ts` e o remove do `adaptCase()`.

**Testes** (vitest) provando: Théo não revela dado objetivo; a mãe informa crises anteriores; ordem incompleta não executa; nada acontece antes da confirmação; sem intervenção há deterioração nos tempos previstos; oxigênio e broncodilatador produzem os efeitos previstos; o mesmo log de ações produz sempre o mesmo estado final (determinismo).

Sem nota 0–100. Sem LLM decidindo fisiologia, execução ou correção.

## Fase 2 — Rota conectada ao motor

Em `src/routes/caso.$id.tsx`, apenas quando `caseId === "dispneia-crianca"`, renderiza a estação do Théo; os outros dois casos seguem exatamente como estão hoje.

A estação oferece: seletor de interlocutor (Théo / mãe / equipe), conversa livre, exame físico descrito em linguagem livre, campo único de ação clínica em linguagem livre, pedidos de esclarecimento, confirmação explícita antes do preparo, monitor sempre visível refletindo o estado do motor, ordens em andamento, passagem do tempo e eventos independentes, reavaliação e transferência de cuidado.

Removidos no Théo: listas de manobras, cardápio de exames, lista de condutas, estágios "avaliado/investigado/tratado", vitais estáticos, botão "Encerrar" genérico e avaliação numérica.

**Interpretador de intenção**: regras determinísticas cobrindo examinar, verificar oxímetro, reavaliar, administrar medicamento, fornecer oxigênio, aguardar/avançar tempo, solicitar exame e transferir cuidado. Se um LLM for usado, ele só produz a intenção estruturada; validação e execução ficam no motor.

## Fase 3 — IA, transferência e debrief

**Conversa**: o modelo é apenas a voz de Théo ou da mãe. O prompt recebe somente os fatos daquele ator; a saída é estruturada (resposta + IDs de fatos usados) e os IDs inexistentes ou de outro ator são rejeitados no servidor — a proteção não depende do prompt. Nunca são enviados dados objetivos, diagnóstico ou consequências futuras.

**Encerramento**: exige destino ou profissional responsável, aceita passagem de caso em texto livre, registra a transferência no event log e congela o encontro.

**Debrief do Capi**, separado da simulação: usa somente fatos e eventos registrados, relaciona decisões e consequências, separa observado / não observado / não avaliável, usa linguagem qualitativa (demonstrou, parcialmente, não observado), sem nota numérica, com marcação explícita do que é comentário automático e sem afirmar que um raciocínio livre está correto quando não há validação semântica confiável.

**Trace causal** opcional, colapsado, para revisão docente.

**Testes adicionais**: vazamento de informação (ator/IDs), transferência de cuidado e debrief derivado exclusivamente do log.

## Detalhes técnicos

- Adicionar `vitest` como dependência de desenvolvimento e script de teste; testes em `src/lib/__tests__/`.
- O motor é puro: `reduce(state, action) → state` mais um avanço de relógio `tick(state, seconds)`, o que garante determinismo e testabilidade sem React.
- A rota mantém apenas o loop de relógio e o despacho de ações para o motor.
- Build (`vite build`) e testes executados ao final de cada fase; ao fim reporto arquivos modificados, resultado dos testes e o que funciona no preview.
