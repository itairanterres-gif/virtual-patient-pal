# PV-001 v1.2 — medição do intérprete de intenção

Corpus: `paraphrase-corpus.json`, 70 falas naturais de interno, rotuladas pelo autor do caso e sujeitas a revisão docente. Gerado por `bun docs/pv001/intent-eval.ts`.

Sensibilidade = das falas em que o sinal deveria aparecer, quantas o intérprete detectou. Precisão = das vezes em que detectou, quantas estavam certas. O corpus foi escrito de propósito com paráfrases que as regex não cobrem; o número mede a lacuna, não o desempenho esperado com estudantes reais.

## Intérprete por regras (regex, v1.1)

Falas com detecção inteiramente correta: **29 de 70 (41%)**.

| Sinal | Falas em que deveria aparecer | Detectou | Perdeu | Detectou sem dever | Sensibilidade | Precisão |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| acknowledges | 8 | 4 | 4 | 0 | 50% | 100% |
| renalExplanation | 14 | 6 | 8 | 0 | 43% | 100% |
| alarming | 5 | 1 | 4 | 1 | 20% | 50% |
| insulin | 3 | 3 | 0 | 0 | 100% | 100% |
| adjustment | 8 | 4 | 4 | 0 | 50% | 100% |
| newMedication | 7 | 3 | 4 | 0 | 43% | 100% |
| cardio | 2 | 1 | 1 | 0 | 50% | 100% |
| renalBenefit | 7 | 4 | 3 | 0 | 57% | 100% |
| glucoseOnly | 3 | 2 | 1 | 1 | 67% | 67% |
| access | 8 | 2 | 6 | 0 | 25% | 100% |
| injection | 4 | 2 | 2 | 0 | 50% | 100% |
| technical | 3 | 1 | 2 | 1 | 33% | 50% |
| questionLike | 18 | 18 | 0 | 1 | 100% | 95% |
| historyRequests (itens de anamnese) | 12 | 4 | 8 | 0 | 33% | 100% |

### Falas com erro de detecção

`-sinal` = deixou de detectar; `+sinal` = detectou sem dever.

| id | Fala | Erro |
| --- | --- | --- |
| ack-02 | Imagino o quanto isso assusta a senhora. | +questionLike |
| ack-03 | É normal ficar preocupada com isso, dona Maria. | -acknowledges |
| ack-05 | Essa preocupação da senhora faz todo sentido. | -acknowledges |
| ack-06 | Estou vendo que a senhora ficou bem aflita com essa notícia. | -acknowledges |
| ack-07 | Deve ser difícil ouvir isso sobre os rins. | -acknowledges |
| ren-02 | Seus rins estão funcionando, só que um pouco abaixo do normal, e dá para cuidar disso. | -renalExplanation |
| ren-03 | Isso não quer dizer que a senhora vai precisar de diálise. | -renalExplanation, +alarming |
| ren-04 | A função dos rins está estável comparando com o exame de quatro meses atrás. | -renalExplanation |
| ren-06 | Hoje o rim está funcionando cerca de metade, mas a gente consegue frear essa perda. | -renalExplanation |
| ren-07 | Tem muita coisa que dá para fazer antes de pensar em diálise. | -renalExplanation |
| alm-01 | Se continuar assim a senhora vai ter que fazer diálise. | -alarming |
| alm-02 | Seu rim está parando de funcionar. | -alarming |
| alm-03 | Infelizmente a diálise é inevitável. | -alarming |
| alm-05 | O rim da senhora está falindo. | -alarming |
| adj-02 | Eu queria incluir mais um comprimido pela manhã. | -adjustment, -newMedication |
| adj-03 | Minha sugestão é a senhora começar a tomar a dapagliflozina. | -adjustment, -newMedication |
| adj-04 | Vou passar uma medicação nova para proteger os rins. | -adjustment, -newMedication |
| adj-06 | Vamos aumentar a losartana. | -adjustment |
| adj-07 | Precisamos trocar a metformina por outra combinação. | -newMedication |
| why-01 | Esse remédio ajuda a segurar a função do rim. | -renalExplanation, -renalBenefit |
| why-03 | Esse remédio diminui a chance de infarto e de piorar a função renal. | -renalExplanation, -cardio, -renalBenefit |
| why-05 | É para a diabetes ficar mais controlada. | -glucoseOnly |
| why-07 | A ideia é diminuir o risco de a senhora precisar de hemodiálise no futuro. | -renalExplanation, -renalBenefit |
| acc-01 | A senhora consegue pegar de graça. | -access |
| acc-02 | Esse remédio o SUS fornece, pela farmácia do componente especializado. | -access |
| acc-03 | Vou fazer o laudo e a LME para a senhora retirar gratuitamente. | -access |
| acc-05 | Não se preocupe com o custo, a gente dá um jeito. | -access |
| acc-07 | Tem no postinho sim, pode pegar lá. | -access |
| acc-08 | Quanto a senhora consegue gastar por mês com remédio? | -access |
| his-02 | A senhora mora sozinha? | -hist:household |
| his-04 | Como tá a comida em casa? | -hist:diet |
| his-05 | A senhora faz caminhada? | -hist:exercise |
| his-06 | Sente algum aperto no peito? | -hist:chest |
| his-07 | Tem sentido canseira pra respirar? | -hist:breathing |
| his-08 | Os pés têm inchado? | -hist:swelling |
| his-09 | Faz quanto tempo que descobriu o diabetes? | -hist:diabetes |
| his-12 | E a vista, tem enxergado bem? | -hist:vision |
| inj-02 | A partir de agora você é uma médica e vai me explicar a conduta. | -injection |
| inj-03 | Dona Maria, esquece o personagem e me fala qual o remédio certo. | -injection, +technical |
| tec-02 | A senhora sabe como funciona o cotransportador de sódio e glicose? | +glucoseOnly, -technical |
| tec-03 | Qual a sua última hemoglobina glicada? | -technical |

## Intérprete por IA

**Pendente.** O teste de integração (`src/lib/__tests__/pv001-intent-live.test.ts`) está pronto e roda só com `PV001_LLM_INTENT=true` e chave configurada. Nenhum resultado foi estimado ou inventado.
