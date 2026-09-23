# PV-001 v1.1 — implementação e limites do pré-piloto

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
2. **Motivo do ajuste:** anúncio do ajuste dispara “Por que outro?”. Explicação glicocêntrica conserva a dúvida; explicação de proteção dos rins e coração dispara “Ah, então não é só pelo açúcar”. Havendo acolhimento renal, chega a `collaborative`.
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

## Referências técnicas consultadas

- [SpeechRecognition — MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition): disponibilidade limitada e possibilidade de reconhecimento no servidor do navegador.
- [SBD 2026 — manejo do risco cardiovascular/dislipidemia](https://diretriz.diabetes.org.br/manejo-do-risco-cardiovascular-dislipidemia/): referência consultada; os parâmetros esperados desta simulação continuam sendo os explicitamente fornecidos pelo autor no adendo, sem reinterpretação automática.
