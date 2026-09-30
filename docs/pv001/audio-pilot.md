# Revisão de áudio da prévia PV-001

## Turno de voz controlado pelo estudante

Após conseguir transcrever, o autor relatou cortes a cada 2–3 segundos. A causa no código era reconhecimento de uma única fala (`continuous=false`) com envio no evento de término do navegador. Agora o reconhecimento é contínuo e acumula os trechos; se o navegador encerrar por pausa, a captura é retomada sem enviar a fala à paciente. Somente **Concluir fala** confirma o envio. Atualizações cumulativas não duplicam palavras; o texto é preservado em erro e os callbacks tardios são descartados após cancelamento/encerramento.

A escuta nativa tem limite de 2 minutos por captura: ao atingir esse limite, preserva o rascunho para revisão/envio manual, sem resposta automática da paciente. A integração alternativa mantém o limite de gravação de 45 segundos e também não envia à paciente quando encerra por limite. Os seis testes de regressão cobrem pausas, acúmulo, término manual, cancelamento, falha de rede, limites e ausência de evento final. A fluidez no microfone real ainda deve ser conferida pelo autor.

## Falha observada no navegador interno e correção do teste

Na consulta aberta do autor, foi observada a mensagem de falha do serviço de reconhecimento (`network`). O teste anterior apenas abria e fechava `getUserMedia`: isso confirmava acesso ao dispositivo, mas não reconhecimento. Os testes de interface anteriores usavam eventos simulados e não detectavam essa indisponibilidade real.

O botão do prebriefing agora é **Testar minha voz** e percorre a mesma transcrição da consulta. Só confirma reconhecimento quando recebe texto; a frase de teste não é enviada à paciente nem inicia uma sessão. Há cancelamento, limite de espera, diagnóstico ao lado do botão de fala e resultado vazio explícito. Iniciar a abertura ou consulta cancela o teste para impedir envio tardio. O serviço de reconhecimento do navegador interno continua sem funcionamento confirmado; esta mudança não ativa um provedor alternativo.

Verificação real nesta revisão: em uma aba temporária do navegador interno, o novo botão chegou à etapa de reconhecimento e reproduziu a falha do serviço. A tela exibiu o diagnóstico sem iniciar sessão ou cronômetro. Não se confirmou transcrição de voz real; a consulta original do autor foi preservada e a aba de teste foi fechada.

Contingência: no Windows, focar o campo de fala e usar Windows + H; depois enviar o texto reconhecido. É reconhecimento online da Microsoft, não da aplicação. Referência: [Microsoft — digitação por voz](https://support.microsoft.com/pt-br/accessibility/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc). O funcionamento no equipamento do usuário precisa ser confirmado por ele.

## O que muda

A configuração de áudio aparece antes da abertura e durante a consulta: teste de acesso ao microfone, teste de som, seleção das vozes em português fornecidas pelo navegador e mensagens distintas para permissão negada, dispositivo ausente, dispositivo ocupado e falha de rede. A lista de vozes atualiza quando o navegador termina de carregá-la. A qualidade depende das vozes instaladas/disponíveis; uma voz natural não é presumida.

O estudante inicia a fala explicitamente e confirma o envio em Concluir fala. Pausas e encerramentos automáticos do reconhecimento não enviam o turno. Na integração opcional, o navegador captura até 45 segundos e o servidor solicita sua transcrição; ao atingir o limite, ela fica como rascunho. A transcrição enviada passa pelo mesmo motor clínico fixo e fica no registro. Cancelar, enviar texto ou encerrar a consulta invalida resultados pendentes e libera o microfone. Há botão para ouvir novamente a última resposta.

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
