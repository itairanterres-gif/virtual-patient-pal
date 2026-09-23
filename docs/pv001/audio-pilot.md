# Revisão de áudio da prévia PV-001

## O que muda

A configuração de áudio aparece antes da abertura e durante a consulta: teste de acesso ao microfone, teste de som, seleção das vozes em português fornecidas pelo navegador e mensagens distintas para permissão negada, dispositivo ausente, dispositivo ocupado e falha de rede. A lista de vozes atualiza quando o navegador termina de carregá-la. A qualidade depende das vozes instaladas/disponíveis; uma voz natural não é presumida.

O estudante inicia a fala explicitamente. Com o reconhecimento nativo, uma fala final é enviada ao terminar o reconhecimento. Na integração opcional, o navegador captura até 45 segundos, o estudante conclui a fala e o servidor solicita sua transcrição. A transcrição passa pelo mesmo motor clínico fixo e fica no registro. Cancelar, enviar texto ou encerrar a consulta invalida resultados pendentes e libera o microfone. Há botão para ouvir novamente a última resposta.

## Integração opcional preparada, ainda sem teste real do provedor

Implementada com OpenAI `gpt-4o-mini-transcribe` e `gpt-4o-mini-tts` (voz inicial `coral`, sujeita a audição pelo autor). As instruções de entonação usam o estado emocional existente. Somente identificadores válidos de falas canônicas entram no sintetizador; nenhum texto clínico livre é aceito para a voz de Maria. Transcrição recebe áudio e idioma, sem gabarito clínico ou respostas esperadas.

Não há credencial configurada nesta etapa. O modo permanece desligado e a interface informa isso. A ativação exige `OPENAI_API_KEY` e `PV001_AUDIO_ENABLED=true` no ambiente **do servidor**, nunca em variáveis `VITE_*` ou código cliente. Usar entrada local protegida; não enviar segredos no chat e não versionar arquivos de configuração contendo chaves. Reiniciar o servidor após configurar.

O modo pago aceita somente desenvolvimento em localhost/127.0.0.1/::1, com ativação explícita; é desabilitado em build de produção e em endereços da rede. Upload máximo 2 MiB, prazo de requisição de 30 s, limite agregado de 240 chamadas/hora por processo e cache limitado a 40 respostas fictícias. Não é uma solução de autenticação, cobrança ou armazenamento institucional. Publicação futura requer autenticação e quotas por usuário antes de remover essa restrição.

O aplicativo não grava áudio do estudante em disco nem no registro local. Na modalidade opcional, o áudio é enviado ao provedor para transcrição; não se faz alegação de retenção zero pelo provedor. A tela informa o destino antes do uso. A abertura atual ainda possui o áudio provisório original e será substituída juntamente com o vídeo final; não se presume identidade vocal já aprovada.

## Limites do navegador

Na prévia do computador, usar `http://127.0.0.1:4173/caso/PV-001`. Para o iPhone na rede, HTTP por IP não autoriza captura: é necessário HTTPS válido e permissão do usuário. Navegadores internos podem limitar captura ou reconhecimento; testar a mesma página no Edge/Chrome externo. Não há mecanismo legítimo para o aplicativo conceder a si mesmo permissão de microfone.

## Fontes consultadas

- [OpenAI — Text to speech](https://developers.openai.com/api/docs/guides/text-to-speech)
- [OpenAI — File transcription](https://developers.openai.com/api/docs/guides/speech-to-text)
- [MDN — getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

Validação técnica: 87 testes automatizados aprovados (incluindo 8 novos testes de áudio); TypeScript e build aprovados; lint sem erros, com os seis avisos preexistentes. Interface verificada no Edge automatizado com microfone liberado, negado e reconhecimento ausente; fala transcrita entra na consulta, resultado tardio após encerramento é descartado e tela de 390 px não tem transbordamento horizontal. Esses cenários usam dispositivos/eventos simulados.

Validação funcional com áudio real do usuário e audição da voz natural permanecem pendentes. Testes automatizados de integração usam respostas simuladas do provedor e não comprovam qualidade perceptiva ou disponibilidade da conta.
