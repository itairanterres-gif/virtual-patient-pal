# PV-001 — implementação e limites do pré-piloto (v1.1 e v1.2)

O cenário de Maria foi acrescentado ao módulo `virtual-patient-pal`, preservando a arquitetura de estações por caso já usada por Théo. Versão ativa: **1.1**. As especificações originais v1.0 e o adendo v1.1 foram preservados integralmente em `specifications/`. Não havia implementação nem sessões reais de Maria no checkout de origem (`491d70f`).

## Comparação com o adendo

| Situação                        | Resultado                                                                                                                                                                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compatível                      | Estações por cenário, motor determinístico, catálogo de falas e devolutiva separada já eram padrões do módulo.                                                                                                                                            |
| Alterado/adicionado             | Objetivo integrador; DM2 há 8 anos; creatinina 1,25; TFGe 49; exames anteriores TFGe 49/RAC 52; três momentos centrais; 12 critérios; debriefing em oito perguntas; vídeo, voz, transcrição e persistência versionada.                                    |
| Removido da especificação ativa | Ramo de resistência à insulina, história materna como gatilho, checklist abrangente, objetivos anteriores e debriefing anterior. Peso/IMC, glicemia de jejum e formigamento não integram a nova lista de dados fornecida e não são inventados pelo motor. |
| Colisão arquitetural            | Nenhuma. Uma estação específica é necessária porque o cockpit genérico oferece alternativas de conduta e avaliação durante a interação, incompatíveis com este cenário. Não foram alterados os outros motores.                                            |

Hábitos e negativas sintomáticas não alterados pelo adendo são respostas opcionais, sem exigência no checklist. O nome formal completo e o objetivo ficam na definição do caso; biblioteca e briefing usam título neutro, sem antecipar o diagnóstico renal ou a solução terapêutica.

## Estrutura e arquivos

- `src/lib/pv001/case.ts`: versão, dados canônicos congelados recursivamente, recursos, catálogo completo de falas, objetivo, prebriefing e debriefing.
- `src/lib/pv001/engine.ts`: relógio, gatilhos, estados emocionais, emissão, transcrição, decisões e transições de modo.
- `src/lib/pv001/evaluator.ts`: checklist e validação de evidência/revisão.
- `src/lib/pv001/evaluation.functions.ts`: avaliador no servidor, usando o gateway já existente. Recebe apenas a consulta encerrada; não participa da resposta da paciente.
- `src/lib/pv001/persistence.ts`: registro local por UUID, versão e cópia integral da especificação; bloqueio de sobrescrita de versão/especificação.
- `src/lib/pv001/voice.ts`: reconhecimento e síntese pelo navegador, em português, com texto de contingência.
- `src/components/maria-station.tsx`: estação da consulta e fluxos separados de reflexão, debriefing e revisão.
- `src/routes/index.tsx` e `src/routes/caso.$id.tsx`: entrada na biblioteca e seleção da estação. São os únicos arquivos de produto preexistentes alterados.
- `public/pv001/v1.1/`: imagem, vídeo e legenda.
- `src/lib/__tests__/pv001-*.test.ts`: testes específicos; testes preexistentes mantidos.
- `docs/pv001/`: histórico, exemplos reproduzíveis e este relatório.

**Tabelas alteradas: nenhuma. Dependências do aplicativo alteradas: nenhuma. Arquitetura global do Capi alterada: nenhuma.** Nenhuma implantação, migração de produção ou alteração de outro módulo foi realizada.

## Clinical Truth Lock

`PV001.truth` contém a verdade fixa; o estudante nunca fornece propriedades para sobrescrevê-la. A emissão usa somente frases completas de `LINES`. Não há saída clínica de texto livre de um LLM no caminho da paciente. Desconhecido recebe resposta de desconhecimento; não se infere ausência de alergia, cirurgia, internação ou antecedentes não fornecidos.

As perguntas liberam somente as falas pertinentes. Os exames e medicamentos estão em recursos consultáveis desde o início, inclusive os exames de quatro meses atrás. Maria não informa espontaneamente classificação de risco, meta de LDL, mecanismos ou diretrizes. Informações esperadas para o avaliador estão no prompt do avaliador, ausentes do catálogo da paciente.

O intérprete de intenção nesta versão é determinístico e conservador. Isso impede invenção e ensino pela paciente, mas **não garante compreensão de toda paráfrase em linguagem natural**. Uma pergunta não reconhecida pode receber “não sei”. Ampliar a interpretação exige testes e revisão das falas; não se permite usar prosa livre de modelo como atalho. As transições emocionais não são usadas como nota automática de competência.

## Três momentos e estados

1. **Medo renal:** abertura obrigatória. Acolhimento explícito + explicação renal sem alarmismo levam de `anxious` a `reassured`. Após duas falas que ignoram o medo, há retomada; persistindo por quatro, `withdrawn`. Acolhimento posterior permite recuperação.
2. **Motivo do ajuste:** anúncio do ajuste dispara “Por que outro?”. Explicação glicocêntrica conserva a dúvida; explicação de proteção dos rins e coração dispara “Ah, então não é só pelo açúcar”. Explicação apenas do benefício renal também produz compreensão compatível, sem exigir menção ao coração. O evento `renal_benefit_explanation` é distinto de `cardiorenal_explanation`; `reasonExplained` representa compreensão da paciente, não cumprimento do checklist. Havendo acolhimento renal, chega a `collaborative`.
3. **Acesso:** nova medicação prepara a pergunta de custo para a resposta seguinte, preservando a ordem dos momentos. Há retomada aos 14 minutos ou antes do fechamento se necessário. O estudante pode avançar sem resolver o medo; este continua afetando o estado e o encerramento.

Insulina produz apenas preocupação leve uma vez, sem estado de resistência, sem recusa prolongada e sem história adicional. Estados não dependem de LLM nem de troca de imagem. Alarmismo e promessa absoluta de nunca precisar de diálise não produzem tranquilização pelo motor.

Relógio de 900 segundos por diferença de timestamps, com recuperação de suspensão da aba e aviso aos 720 segundos. Respostas tardias e recursos após encerramento são recusados. Nenhuma intercorrência clínica é gerada pelo tempo. Após “Cenário encerrado.” não há mais fala da paciente; segue autorreflexão obrigatória e só então debriefing.

## Avaliação e rastreabilidade

Os 12 critérios substituem integralmente o checklist v1.0. NR significa não realizado/não evidenciado; I, inadequado; PA, parcialmente adequado; A, adequado. Não há soma, ranking, aprovação ou decisão certificadora.

Cada I/PA/A exige turno existente, autor estudante e trecho literal presente nesse turno. Evidência inventada, atribuída à paciente ou ausente é rejeitada; o item fica NR com pendência explícita. A existência da citação não demonstra que a interpretação semântica está correta: isso continua exigindo revisão humana. NR sem trecho registra ausência de evidência, nunca uma citação fictícia de algo não feito.

O gabarito é o fornecido pelo autor: alto risco, HAS + estratificador renal, DM2 há 8 anos, LDL <70 com estatina de alta potência e foco em iSGLT2 sem obrigar molécula/marca. Não foram adicionadas regras de dispensação local ou condutas médicas novas. A revisão humana registra revisor, data, justificativa e evidências em histórico próprio, sem apagar a sugestão original.

Sem configuração do gateway, a sugestão fica explicitamente indisponível; a revisão humana permanece utilizável. A interface não apresenta esse estado como reprovação nem presume competência.

## Persistência

Cada execução guarda `case_id`, `case_version`, `engineVersion` na especificação, UUID, código do participante, início/fim/duração, transcrição, recursos, falas/perguntas, decisões, estados, gatilhos, eventos técnicos, avaliação, revisões, autorreflexão e debriefing. Falas são preservadas por inteiro, inclusive aquelas que não são perguntas; não se perde o raciocínio expresso na conversa.

A gravação é local ao navegador, sob chave própria por sessão. Retomada confere versão e especificação. Sessões incompatíveis permanecem exportáveis, sem migração silenciosa. Exportação JSON inclui tudo. Falhas de armazenamento são mostradas e registradas.

Este mecanismo **não é um prontuário institucional, serviço multiusuário ou armazenamento inviolável**. O módulo de origem não dispõe de autenticação institucional nem persistência de sessões. Identidade do participante/revisor é autodeclarada; limpar o navegador pode apagar os dados; exportar é necessário para guarda externa. Antes de uso institucional amplo, definir destino, retenção, controles de acesso e revisão identificada. Nenhum banco do ecossistema foi criado para suprir isso implicitamente.

## Audiovisual

Revisão após a avaliação inicial do autor: [configuração e limites de áudio](audio-pilot.md) e [roteiro do vídeo com movimento](abertura-producao.md). Foram acrescentados teste de microfone, diagnóstico de permissões, seleção de voz, repetição de resposta e integração opcional de transcrição/voz natural. O serviço pago ainda não foi ativado; o vídeo em movimento ainda não foi gerado. A verdade clínica continua na versão 1.1, sem alteração.

Vídeo MP4 de 9 segundos, imagem fictícia de Maria tensa segurando a bolsa, áudio sintético pt-BR e legenda com a abertura exata. Após o vídeo, permanece a mesma imagem. O vídeo é uma composição de retrato estático e voz; **não é atuação filmada nem animação labial**. Essa limitação precisa de aceite pedagógico para o piloto.

Imagem produzida com a ferramenta integrada imagegen. Prompt completo: `media-provenance.md`. Áudio local gerado com Microsoft Maria Desktop; “Doutor(a)” é vocalizado como “Doutora”. Não se utiliza voz de pessoa real nem se acrescenta conteúdo clínico.

Interação por voz em navegadores compatíveis; a fala reconhecida vira texto e a resposta autorizada pode ser ouvida. O reconhecimento pode usar processamento remoto do provedor do navegador; isso é informado no prebriefing. Microfone negado, falta de suporte e falha de síntese deixam o chat disponível. Não há avatar contínuo. A qualidade da voz e o reconhecimento com microfone real exigem teste no equipamento do piloto.

## Verificação e falhas corrigidas

Correção do diálogo após teste do autor (22/09/2026): a transcrição de três falas espontâneas foi incorporada aos testes de regressão. O motor confundia benefício renal sem menção ao coração com explicação exclusivamente glicêmica, tratava “senhora usando essa medicação” como pergunta sobre medicamentos e encontrava “come” dentro de “começando”, liberando a fala sobre dieta. Agora os fatos dependem de expressões de pergunta próximas do assunto; a compreensão já demonstrada não é repetida a cada explicação; acesso já abordado não dispara nova pergunta de custo. A proposta “minha ideia é usar outro remédio” também é reconhecida. Não se alteraram dados clínicos, critérios do avaliador ou registros anteriores.

**Limite desta correção:** continua sendo um intérprete por regras e um catálogo de respostas. Os testes cobrem o relato e variações, não demonstram compreensão geral de conversa. Para a naturalidade pretendida, a próxima etapa é interpretar intenção e contexto com um modelo de linguagem, separando a compreensão da seleção de fatos autorizados e da avaliação. Esse serviço não foi ativado nesta correção; ampliar expressões não equivale a implementá-lo.

Verificação desta revisão: 110 testes em seis arquivos aprovados; TypeScript, lint dos arquivos de código alterados e build aprovados. As três falas do relato também foram reproduzidas na interface local, em sessão sintética separada: Maria respondeu sobre o benefício renal e acesso, sem emitir as falas de dieta, medicamentos ou negação da explicação renal. O build conserva avisos de depreciação do TanStack e de configuração Vite preexistentes. A verificação foi textual; não representa novo teste de microfone ou de naturalidade da voz.

As fases paciente → testes comportamentais → avaliador → pós-cena foram executadas nessa ordem. A primeira bateria do paciente passou antes de acrescentar o avaliador.

- Corrigida repetição indevida da fala de tranquilização a cada turno após o acolhimento.
- Regressões para negar proposta terapêutica, negar acolhimento e negar verificação de acesso.
- Bloqueio de mensagens tardias após os 15 minutos e de debriefing antes da autorreflexão.
- Rejeição de evidência fabricada e de evidência retirada da fala da paciente.
- Correção da entrada do participante durante inicialização da interface.
- Finais de linha CRLF do checkout Windows provocaram erros de lint nos arquivos existentes; normalizados somente na cópia de trabalho, sem mudança de conteúdo ou configuração global.

Evidências automatizadas finais: `verification.json`. Exemplos: `test-sessions.md` e `test-sessions.json`, reproduzíveis com `bun docs/pv001/generate-examples.ts`. Os exemplos são sintéticos e não representam estudantes reais.

## Pendências antes de liberar o piloto humano

1. Revisão docente do recorte, catálogo de falas, estados, critérios e exemplos. Validar paráfrases espontâneas: o intérprete atual tem cobertura limitada.
2. Ensaio com microfone e voz no navegador/equipamento efetivamente usado. Confirmar confidencialidade e aceitação do provedor de reconhecimento.
3. Aceite ou substituição do vídeo composto por retrato/voz por atuação audiovisual, se esta for necessária à fidelidade pretendida.
4. Configurar e testar o gateway do avaliador com transcrições sintéticas e revisar a qualidade dos julgamentos. Falta de chave não deve bloquear a consulta nem produzir notas fictícias.
5. Definir responsável pela exportação/guarda e revisão humana. O piloto técnico não equivale à autorização de uso institucional nem à avaliação certificadora.

## v1.2 — intérprete de intenção por IA e acesso SUS (30/09/2026)

**O que mudou**

- `version` 1.2 / `engineVersion` 1.2.0. Especificação em `specifications/v1.2-adendo.txt`; v1.0 e v1.1 preservadas. `PV001_V11` guarda a especificação v1.1 idêntica, byte a byte, para abrir sessões antigas. Verdade clínica, recursos e `LINES` inalterados (verificado por teste).
- Item `acesso` do checklist com o gabarito do autor (PCDT de DRC/CEAF); os outros 11 critérios são idênticos. O avaliador usa o checklist e o gabarito **da versão da sessão**: v1.1 mantém "Não inventar regras de dispensação local".
- Intérprete de intenção por modelo (`src/lib/pv001/intent.ts`, `intent.functions.ts`, `intent-provider.server.ts`), desligado por padrão. Recebe só a fala atual e um resumo de fase/flags; não recebe gabarito, checklist nem falas. Devolve **somente** JSON com os 13 sinais booleanos e `historyRequests` (restrito às 12 falas de anamnese), validado por zod estrito e por `sanitizeIntent` no motor. Qualquer chave extra, valor não booleano ou id fora da lista invalida a saída.
- O motor continua escolhendo as falas de `LINES`. Pisos de segurança: injeção e alarmismo detectados pelas regex valem mesmo que o modelo não os detecte.
- Fallback para regex: desligado, sem chave, timeout de 4 s (servidor) / 5,5 s (navegador), erro, saída inválida ou limite de 600 chamadas/hora por processo. Cada turno registra em `technicalEvents` o intérprete usado (`llm:<modelo>` ou `regex:<motivo>`).
- O relógio usa o instante do envio, não o da resposta do intérprete. O botão fica em "Interpretando…" durante a espera.
- A IA também detecta "pergunta técnica" e "tem cara de pergunta", antes feitos por regex dentro de `respond()`.
- Sessões v1.1 abrem para leitura, exportação, reflexão/debriefing e revisão, com o checklist v1.1; a consulta não é retomada e o relógio não avança (`openRecord`). Snapshot adulterado continua recusado.
- Prebriefing informa o processamento externo das falas.

**Configuração (somente servidor, arquivo `.env` local não versionado)**

```
PV001_LLM_INTENT=true
MIMO_API_KEY=<chave>                      # ou PV001_INTENT_API_KEY
PV001_INTENT_MODEL=mimo-v2-flash          # opcional
PV001_INTENT_BASE_URL=https://api.xiaomimimo.com/v1   # opcional; qualquer API compatível com OpenAI
```

**Acurácia das regex no corpus** (`paraphrase-corpus.json`, 70 falas; detalhe em `intent-eval.md`): 29 de 70 falas com detecção inteiramente correta (41%). Sensibilidade mais baixa em acesso (2/8), alarmismo (1/5), itens de anamnese (4/12) e pergunta técnica (1/3). O corpus foi escrito para expor paráfrases; mede a lacuna, não o desempenho com estudantes reais. Os rótulos são do autor do caso e pedem revisão docente.

**Teste com IA real: pendente.** `src/lib/__tests__/pv001-intent-live.test.ts` roda o corpus contra o modelo configurado e imprime a mesma tabela; é ignorado sem chave. Nenhum resultado foi estimado.

**Verificação desta etapa.** Os testes do motor, do avaliador, do Théo e os 13 novos testes de intenção passam (107 testes em 4 arquivos, executados com o runner do Bun). O caminho por regex foi comparado ao motor v1.1 em 70 falas isoladas e numa conversa longa: transcrição, flags e emoção idênticas. Lint e prettier sem erros nos arquivos alterados. **Não executados neste ambiente**: `bun run test` com vitest (os testes de áudio e captura de fala usam APIs do vitest que o runner do Bun não oferece; as mesmas 13 falhas ocorrem no commit anterior), `tsc` completo e `bun run build`, porque as dependências não puderam ser instaladas (o `bun.lock` aponta para o repositório privado da Lovable). Rodar os três no equipamento do autor antes do merge.

**Limitações que continuam**

- A Maria **fala só as 31 frases do catálogo**. A IA melhora o entendimento, não a naturalidade da resposta. Perguntas fora do roteiro continuam recebendo "Isso eu não sei dizer" ou "Estou ouvindo".
- O intérprete por modelo não foi testado com chave real; acurácia, latência e custo reais são desconhecidos.
- Com a IA ligada, a fala do estudante vai a um serviço externo. Sem autenticação institucional nem cota por usuário.
- A paciente reage igual a uma orientação de acesso correta ou errada; a correção depende do avaliador e do debriefing.
- Os exemplos em `test-sessions.*` são da v1.1 e não foram regenerados.

## Modo atriz (ramo `claude/pv001-maria-atriz`, experimental)

Decisão do autor (30/09/2026): o roteiro fixo, mesmo com o intérprete por IA, mantém a Maria robótica. Adotado o modelo da paciente-atriz: **o motor dirige o roteiro, a IA dá naturalidade**.

- **Diretor (motor, inalterado):** decide as batidas de cada turno (`lineIds`), o estado emocional e as transições. Os três momentos continuam dependendo da detecção, agora opcionalmente por IA.
- **Atriz (`src/lib/pv001/actor.ts`, `actor.functions.ts`):** recebe a persona não clínica, a emoção, as batidas do turno e **somente os fatos já liberados** (falas do roteiro entregues até então), montados no servidor a partir de `LINES`. Responde conversa social e sentimentos, volta à preocupação pendente e não recebe gabarito, checklist nem exames.
- **Conferência (`verifyPerformance`):** números só dos fatos liberados; vocabulário clínico (remédios, doenças, sintomas, exames, hábitos, adesão, alergias, cirurgias) só se estiver nos fatos, ou em eco da fala do estudante em batidas de compreensão, ou em "não sei" sem afirmação; cada batida precisa carregar seus números, termos e palavras-chave; sem metalinguagem, formatação ou "doutor(a)". Reprovou, expirou ou deu erro → a frase exata do roteiro. A conferência roda no servidor e de novo ao aplicar.
- **Registro:** o turno guarda `performance` (`actor` + modelo + texto exato do roteiro, ou `script` + motivo) e um evento `patient_voice`. A abertura continua sendo a fala gravada.
- **Voz:** a voz paga só sintetiza falas aprovadas por id; uma fala da atriz é lida pela voz do navegador.
- Ativação: `PV001_LLM_ACTOR=true` (mesma chave; modelo em `PV001_ACTOR_MODEL`, opcional). Desligado por padrão.

**Comparação:** `bun docs/pv001/actor-compare.ts` roda a mesma consulta nas duas versões e grava `actor-compare.md`. Sem chave, só a coluna do roteiro. Essa coluna já mostra o problema atual: a Maria responde "Isso eu não sei dizer" a "tudo bem com a senhora?" e "Estou ouvindo" à proposta de novo remédio ("incluir mais um comprimido" não é reconhecido), de modo que os três momentos centrais nem acontecem.

**Limites:** a conferência é deliberadamente conservadora e pode descartar falas boas; não consegue provar a ausência de todo detalhe não clínico inventado (por exemplo, sobre a rotina), por isso a transcrição guarda o roteiro ao lado para revisão humana. Latência: até ~4 s do intérprete + ~4,5 s da atriz por turno. Nada foi testado com modelo real.

## Referências técnicas consultadas

- [SpeechRecognition — MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition): disponibilidade limitada e possibilidade de reconhecimento no servidor do navegador.
- [SBD 2026 — manejo do risco cardiovascular/dislipidemia](https://diretriz.diabetes.org.br/manejo-do-risco-cardiovascular-dislipidemia/): referência consultada; os parâmetros esperados desta simulação continuam sendo os explicitamente fornecidos pelo autor no adendo, sem reinterpretação automática.
