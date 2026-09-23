# Origem dos recursos audiovisuais

## Correção de tratamento do interlocutor

Em 22/09/2026, o autor apontou que o áudio chamava interlocutores homens de “doutora”. A abertura ativa passou para `intro-neutral.mp4` e `intro-neutral.vtt`: “Falaram que meu rim não está bom. Vou acabar fazendo diálise?”. A fala foi regenerada com Microsoft Maria Desktop, mantendo o retrato e 9 segundos de duração. As demais falas da paciente também dispensam “doutor/doutora”; a reprodução de falas antigas remove o vocativo sem alterar os registros históricos. Correção editorial, sem mudança da verdade clínica. O roteiro para o futuro vídeo com movimento foi atualizado da mesma forma.

## Recursos originais preservados

- Imagem: ferramenta integrada `imagegen`, personagem inteiramente fictícia, gerada para este cenário e copiada para `public/pv001/v1.1/maria.png`.
- Vídeo: `public/pv001/v1.1/intro.mp4`, H.264/AAC, 1280 × 720, 9 segundos, composto a partir do retrato estático e áudio local. Não tem animação labial nem expressões em movimento.
- Voz: sintetizador instalado no Windows, `Microsoft Maria Desktop`, pt-BR, velocidade padrão. Texto falado: “Doutora, falaram que meu rim não está bom. Vou acabar fazendo diálise?”.
- Legenda: `intro.vtt`, preservando a grafia “Doutor(a)” da instrução.
- A ferramenta de montagem FFmpeg foi usada apenas no ambiente de trabalho; não foi adicionada às dependências do aplicativo.
- Não foram usados fotografia nem áudio de paciente real. A imagem não codifica ou acrescenta diagnósticos.

## Prompt integral de geração da imagem

Use case: photorealistic-natural. Asset: fictional patient for a Brazilian medical education simulation PV-001. Create one realistic landscape 16:9 photograph of Maria Aparecida Souza, a fictional Brazilian woman aged 61, retired cleaner, seated in an ordinary outpatient consultation room. Eye-level clinician viewpoint, medium shot includes face, torso, and hands holding a handbag on her lap. She appears mildly tense and worried, attentive to the clinician, natural mature skin and gray-brown hair, simple everyday blouse. Neutral outpatient surroundings, soft natural indoor light. No medical equipment suggesting acute illness. No text, logos, watermarks, charts, diagnoses, other people or clinical facts added. She is entirely fictional, respectful and credible, not glamorous. This single image will remain the same patient identity after a short intro video.
