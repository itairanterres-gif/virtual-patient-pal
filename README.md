# Patient Mentor

Penso em desenvolver um app de simulação clinica ou paciente virtual. Peguei referencias Excelente! Agora vou compilar uma análise técnica profunda da arquitetura de apresentação de casos das plataformas mais bem acabadas. Esta análise será estruturada para servir como referência para desenvolvimento da sua própria ferramenta.

***

## Arquitetura Técnica de Apresentação de Casos: Plataformas de Referência (2026)

### 1. **Body Interact** — Arquitetura Baseada em Motor Fisiológico em Tempo Real

#### **Estrutura do Caso Clínico**

**Camadas de Features por Cenário:**[1]

- **Dados demográficos do paciente** (idade, sexo, peso, altura)

- **Sinais vitais dinâmicos** (FC, PA, FR, SatO2, T°)

- **Exame físico** (achados por sistema: cardiovascular, respiratório, neurológico, etc.)

- **Exames complementares** (laboratoriais, imagem, ECG)

- **Intervenções disponíveis** (medicações, procedimentos, condutas)

- **Evolução temporal** (deterioração/melhoria baseada em ações do usuário)

#### **Arquitetura de Interação**[2][3][4]

```

┌─────────────────────────────────────────────────────────┐

│  CAMADA DE APRESENTAÇÃO (Frontend)                     │

│  - Web / Windows / Mac / Mobile (iOS, Android em breve) │

│  - Interface de caso: timeline de evolução + vitais     │

│  - Painéis: History, Physical Exam, Tests, Treatment    │

└─────────────────────────────────────────────────────────┘

                          ↓

┌─────────────────────────────────────────────────────────┐

│  CAMADA DE LÓGICA DE SIMULAÇÃO                          │

│  - Motor fisiológico em tempo real (proprietário)       │

│  - Sistema de eventos: ações → respostas fisiológicas   │

│  - Timer de deterioração (pressão temporal)             │

└─────────────────────────────────────────────────────────┘

                          ↓

┌─────────────────────────────────────────────────────────┐

│  CAMADA DE COMUNICAÇÃO (IA Conversacional - Beta 2026)  │

│  - Voice recognition / Text input                       │

│  - LLM integrado para diálogo aberto                    │

│  - Adaptação dinâmica à fisiologia do cenário           │

└─────────────────────────────────────────────────────────┘

                          ↓

┌─────────────────────────────────────────────────────────┐

│  CAMADA DE AVALIAÇÃO                                    │

│  - Communication Assessment (4 domínios):               │

│    • Initiating & Rapport                               │

│    • Information Gathering                              │

│    • Information Giving & Explanations                  │

│    • Closing the Encounter                              │

│  - Frameworks: Calgary-Cambridge, SEGUE, Kalamazoo      │

│  - AI-generated analysis com feedback comportamental    │

└─────────────────────────────────────────────────────────┘

```

#### **Padrões de UX Identificados**[2][5][6]

1. **Sem caminho pré-definido**: Usuário define ordem de ações (diagnóstico e tratamento)

2. **Feedback visual de vitais**: Mudanças em tempo real com codificação por cores (verde → amarelo → vermelho)

3. **Timeline de evolução**: Linha do tempo mostrando decisões e impactos

4. **Painéis modulares**: Abas separadas para History, Exam, Tests, Interventions

5. **Sistema de dificuldade**: Níveis ajustáveis conforme conhecimento clínico

6. **Ambientes variados**: Inpatient, outpatient, pre-hospital com UI contextual

***

### 2. **Full Code** — Arquitetura Mobile-First com Casos Estruturados

#### **Estrutura do Caso**[7][8]

**Componentes de um Caso:**

- **Patient Profile**: Demografia, histórico, alergias, medicações

- **Chief Complaint**: Queixa principal + HPI (History of Present Illness)

- **Vital Signs**: Baseline + evolução

- **Physical Exam**: Achados por sistema (normal/anormal)

- **Labs & Imaging**: Resultados com interpretação

- **Differential Diagnosis**: Lista de diagnósticos possíveis

- **Management Plan**: Tratamento, medicações, follow-up

#### **Arquitetura Técnica** 

```

┌─────────────────────────────────────────────────────────┐

│  FRONTEND (Mobile-First)                                │

│  - iOS / Android / Web (responsive)                     │

│  - Game-like interface com gamificação                  │

│  - 230+ casos em 30+ especialidades                     │

└─────────────────────────────────────────────────────────┘

                          ↓

┌─────────────────────────────────────────────────────────┐

│  CASE ENGINE                                            │

│  - Casos estruturados (não totalmente abertos)          │

│  - Patient AI: conversas por texto ou voz               │

│  - Case Creator: editor visual para autoria             │

└─────────────────────────────────────────────────────────┘

                          ↓

┌─────────────────────────────────────────────────────────┐

│  ASSESSMENT LAYER                                       │

│  - Rubricas de pontuação por domínio clínico            │

│  - CME credit tracking (ACCME accredited)               │

│  - Dashboard institucional para faculty                 │

└─────────────────────────────────────────────────────────┘

```

#### **Padrões de UX** 

1. **Interface "game-like"**: Progresso visual, badges, níveis

2. **Casos em formato de missão**: Estrutura narrativa com objetivos claros

3. **Patient AI integrado**: Chat por voz ou texto dentro do caso

4. **Case Creator**: 40+ modelos de pacientes, 5 ambientes 3D, editor visual

5. **EMS environment**: Cenários pré-hospitalares com interface específica

6. **CME tracking**: Integração com créditos de educação continuada

***

### 3. **Plataforma QBurst (Case Study 2026)** — Arquitetura LLM com Information Gating

Esta é uma referência **altamente relevante** para desenvolvimento próprio, pois documenta a arquitetura técnica completa.[9]

#### **Arquitetura Full-Stack**

```

┌─────────────────────────────────────────────────────────┐

│  FRONTEND (React)                                       │

│  - Interface responsiva web-based                       │

│  - Chat interface para entrevista clínica               │

│  - Painéis de vitais, labs, exames                      │

│  - Faculty workspace para autoria de casos              │

└─────────────────────────────────────────────────────────┘

                          ↓ (REST API)

┌─────────────────────────────────────────────────────────┐

│  BACKEND (Node.js/Express)                              │

│  - Autenticação SAML 2.0 (SSO institucional)            │

│  - Role-based access control (RBAC)                     │

│  - Session management com logs de conversação           │

└─────────────────────────────────────────────────────────┘

                          ↓

┌─────────────────────────────────────────────────────────┐

│  LLM ORCHESTRATION LAYER                                │

│  - Three-Layer Prompt Architecture:                     │

│    1. Static fallbacks (templates base)                 │

│    2. Database-driven Handlebars templates              │

│    3. Case-specific instructions                        │

│  - Gating script (pre-prompt data mutation filter)      │

│  - Models: gpt-4o / gpt-4o-mini                         │

└─────────────────────────────────────────────────────────┘

                          ↓

┌─────────────────────────────────────────────────────────┐

│  DATABASE (MySQL 8)                                     │

│  - 25+ versioned Sequelize migrations                   │

│  - Schema: cases, patients, vitals, labs, scores        │

│  - Session logs com JSON de conversas                   │

└─────────────────────────────────────────────────────────┘

```

#### **Componentes Técnicos Chave**[9]

**1. Dynamic Patient Persona Simulation**

- Prompt weaving: contexto + template + instruções específicas do caso

- Difficulty tiers: parâmetros ajustáveis pela faculty

- Resposta dinâmica baseada em histórico da conversa

**2. Pre-Prompt Information Gating**

```javascript

// Pseudo-código do gating filter

if (student_requests_advanced_imaging && !history_completed) {

  replace_diagnostic_value_with_placeholder();

  // Bloqueia vazamento de informação antes do tempo

}

```

- Garante hierarquia diagnóstica: History → Examination → Investigations

- Previne "data leakage" de exames avançados

**3. Disclosure Tracking & Grading Guardrails**

- Classificação assíncrona por mensagem:

  - **Requested**: informação solicitada ativamente pelo estudante

  - **Volunteered**: informação oferecida espontaneamente pelo paciente

- Log JSON armazenado na sessão

- Avaliação final considera ambos os tipos (evita penalização injusta)

**4. Code-Free Case Authoring Engine**

- Editor modular workspace para faculty

- Painéis estruturados:

  - Demographics

  - Physical presentation

  - Vitals

  - Labs

  - Scoring weights

- AI generation wizard: gera valores clinicamente plausíveis automaticamente

#### **Sistema de Avaliação**[9]

**5 Pilares de Scoring:**

1. **Rapport** (comunicação, empatia)

2. **History Accuracy** (completude, precisão)

3. **Clinical Reasoning** (raciocínio diagnóstico)

4. **Diagnosis Accuracy** (diagnóstico correto)

5. **Management Plan** (conduta adequada)

**Rubricas multi-dimensionais** com pesos configuráveis por caso.

***

### 4. **SimConverse** — Arquitetura Focada em Conversação por Voz

#### **Componentes Principais** 

```

┌─────────────────────────────────────────────────────────┐

│  WEB INTERFACE                                          │

│  - Áudio em tempo real (microfone + alto-falante)       │

│  - Transcrição automática (speech-to-text)              │

│  - Chat log visual (transcript da conversa)             │

└─────────────────────────────────────────────────────────┘

                          ↓

┌─────────────────────────────────────────────────────────┐

│  CONVERSATION ENGINE                                    │

│  - LLM com persona de paciente                          │

│  - Biblioteca de cenários por disciplina                │

│  - Rubricas pré-definidas para feedback                 │

└─────────────────────────────────────────────────────────┘

                          ↓

┌─────────────────────────────────────────────────────────┐

│  FEEDBACK SYSTEM                                        │

│  - Avaliação objetiva baseada em rubricas               │

│  - Feedback personalizado por domínio                   │

│  - Dashboard de progresso para estudante e faculty      │

└─────────────────────────────────────────────────────────┘

```

#### **Padrões de UX** 

1. **Conversação natural**: Sem menus ou botões, apenas fala

2. **Feedback imediato**: Após cada sessão, com scores por competência

3. **Biblioteca customizável**: Cenários para liderança, comunicação interprofissional, raciocínio clínico

4. **Acesso universal**: Qualquer dispositivo com microfone

***

### 5. **Referências de Arquitetura de Pesquisa (2025-2026)**

#### **SimPatient (St. Andrews)**[10]

- **Fine-tuned transformer LLM**: Treinado em 60+ horas de consultas reais

- **Avatar engine**: HeyGen-based photorealistic visuals

- **Behavioral state machine**: Ajusta respostas emocionais e fisiológicas

- **Multimodal**: Texto, voz, vídeo, VR

#### **CLiVR (VR + LLM)**[11]

- **Unity + Meta Quest 3**: Deploy em VR

- **Gemini-2.5-Flash API**: Diálogos em tempo real

- **Syndrome-symptom database**: Geração dinâmica de casos

- **Sentiment analysis**: Feedback sobre tom de comunicação

#### **Plataforma JMIR (Web Prototype)**[12]

- **Python Flask + PostgreSQL**

- **5 LLMs integrados**: OpenAI, Anthropic, xAI

- **AI-assisted vignette generator**: Cria casos via meta-prompt

- **SUS score: 91.5** (alta usabilidade)

- **Requisitos identificados pelos usuários:**

  1. Vignette management com filtros por especialidade/ano

  2. Organização em sistema de pastas (como LMS familiar)

  3. Simulação com IA generativa (diálogos imprevisíveis)

  4. Paciente não revela informação diretamente (responde apenas a perguntas direcionadas)

  5. **Didactic loop**: Feedback de performance (solicitado pelos testadores)

***

## Padrões de Design Identificados (Best Practices)

### **Padrões de Interface**[13][14][15][16]

| Dimensão | Padrão Recomendado | Justificativa |

|----------|-------------------|---------------|

| **Input** | Texto + Voz (híbrido) | Flexibilidade para diferentes estilos de aprendizado [13] |

| **Output** | Texto + Fala + Avatar 3D (opcional) | Multimodalidade aumenta realismo [13][10] |

| **Avatar** | 3D embodied ou non-embodied | 6/15 estudos usaram avatares 3D; 9 usaram interfaces não-embodied [13] |

| **Organização de Casos** | Sistema de pastas + filtros | Inspirado em LMS familiares (Moodle, Canvas) [12] |

| **Feedback** | Automático + multi-dimensional | 5 domínios: Rapport, History, Reasoning, Diagnosis, Management [9] |

| **Authoring** | Code-free + AI-assisted | Faculty sem programação pode criar casos [9] |

### **Padrões de Arquitetura Técnica**

**1. Three-Layer Prompt Architecture**[9]

```

Prompt Final = Static Fallback + Handlebars Template + Case Instructions + Gating Script

```

**2. Information Gating**[9]

- Data mutation filter antes do prompt chegar no LLM

- Previne vazamento de informação de exames avançados

- Garante hierarquia: History → Exam → Labs → Imaging

**3. Disclosure Tracking**[9]

- Classificação por mensagem: Requested vs Volunteered

- Log JSON armazenado na sessão

- Avaliação final considera ambos os tipos

**4. Async Evaluation Layer**[9]

- Processamento assíncrono de rubricas

- Não bloqueia experiência do usuário

- Gera feedback estruturado pós-sessão

***

## Recomendações para Sua Ferramenta Própria

### **Arquitetura Sugerida (MVP)**

```

┌─────────────────────────────────────────────────────────┐

│  FRONTEND (React ou Vue.js)                             │

│  - Web-first (responsivo para mobile)                   │

│  - Chat interface (texto + voz via Web Speech API)      │

│  - Painéis: Patient Info, Vitals, Labs, Actions         │

│  - Faculty workspace (case authoring)                   │

└─────────────────────────────────────────────────────────┘

                          ↓ (REST API)

┌─────────────────────────────────────────────────────────┐

│  BACKEND (Node.js/Express ou Python/FastAPI)            │

│  - Autenticação JWT ou SSO institucional                │

│  - Session management com logs de conversa              │

│  - RBAC: student, faculty, admin                        │

└─────────────────────────────────────────────────────────┘

                          ↓

┌─────────────────────────────────────────────────────────┐

│  LLM ORCHESTRATION                                      │

│  - Three-layer prompt: static + template + case-specific│

│  - Information gating (pre-prompt filter)               │

│  - Model: GPT-4o, Claude 3.5, ou open-source (Llama 3) │

└─────────────────────────────────────────────────────────┘

                          ↓

┌─────────────────────────────────────────────────────────┐

│  DATABASE (PostgreSQL ou MySQL)                         │

│  - Schema: cases, patients, sessions, scores, users     │

│  - Session logs: JSON com conversas + disclosure track  │

│  - Migrations versionadas (Sequelize ou Prisma)         │

└─────────────────────────────────────────────────────────┘

```

### **Features Prioritárias (Fase 1)**

1. **Case Authoring Code-Free**

   - Editor visual com painéis: Demographics, Vitals, Labs, Scoring

   - AI wizard para gerar valores plausíveis

   - Sistema de pastas para organização

2. **Patient AI Conversacional**

   - Texto + voz (Web Speech API)

   - Three-layer prompt architecture

   - Information gating para hierarquia diagnóstica

3. **Disclosure Tracking**

   - Classificação Requested vs Volunteered

   - Log JSON na sessão

   - Avaliação justa considerando ambos

4. **Multi-Dimensional Scoring**

   - 5 domínios: Rapport, History, Reasoning, Diagnosis, Management

   - Rubricas com pesos configuráveis

   - Feedback automático pós-sessão

5. **Dashboard Institucional**

   - Tracking de progresso por estudante

   - Analytics de desempenho por caso

   - Export de dados para pesquisa

### **Diferenciais Sugeridos**

1. **Integração com ENAMED**: Casos alinhados ao formato do exame brasileiro

2. **Português nativo**: Otimização para LLMs com bom desempenho em PT-BR

3. **Phygital**: Integração com simulação física (manequins, OSCE real)

4. **Analytics avançado**: Learning analytics para pesquisa educacional

5. **API aberta**: Integração com LMS institucionais (Moodle, Canvas)

***

Gostaria que eu criasse um documento mais detalhado com:

- **Especificação técnica de banco de dados** (schema completo)?

- **Exemplos de prompts** para cada camada da arquitetura?

- **Wireframes** de interface baseados nos padrões identificados?

- **Roadmap de desenvolvimento** com prioridades e estimativas?

Fontes

[1] Understand Clinical Scenario Features https://help.bodyinteract.com/bi-studio-lms/educators-and-admin/understand-clinical-scenario-features/

[2] Body Interact - App Store - Apple https://apps.apple.com/ma/app/body-interact/id920383226

[3] Blog - Introducing AI-Driven Conversations https://bodyinteract.com/blog/ai-driven-conversations-virtual-patient/

[4] Virtual Patient Simulation With Real-Time Physiology - Body Interact https://bodyinteract.com/blog/real-time-physiology/

[5] Evaluating The Effectiveness of The Body Interact Virtual Patient ... https://www.sciencepubco.com/index.php/IJBAS/article/view/35078

[6] Virtual Patient Simulations for PA Programs https://bodyinteract.com/physician-assistant/

[7] Individuals | Full Code Medical Simulation https://fullcodemedical.com/individuals/

[8] Organizations | Full Code Medical Simulation https://fullcodemedical.com/organizations/

[9] Full Code Medical Simulation https://apps.apple.com/ar/app/full-code-medical-simulation/id1207424206?l=en-GB

[10] Full Code Medical Simulation https://apps.apple.com/tw/app/full-code-medical-simulation/id1207424206?uo=2&at=11l9pj

[11] Full Code Medical Simulation https://play.google.com/store/apps/details?id=com.minerva_medical.minerva&hl=ln

[12] Full Code Medical Simulation - Medical App https://mwm.ai/apps/full-code-medical-simulation/1207424206

[13] AI-Powered Virtual Patient Simulation Platform | Case Study https://www.qburst.com/en-ca/resources/case-studies/ai-driven-virtual-patient-simulation-platform-for-scalable-clinical-training/

[14] Web-Based AI-Driven Virtual Patient Simulator Versus Actor ... https://pmc.ncbi.nlm.nih.gov/articles/PMC12634008/

[15] Artificial intelligence-driven patient history and symptoms ... https://www.tandfonline.com/doi/full/10.1080/08164622.2025.2544809

[16] SimConverse - Funding: $500K+ | StartupSeeker https://startup-seeker.com/company/simconverse~com

[17] Helping future doctors communicate empathetically with patients https://www.inside.unsw.edu.au/education/ai-insider-helping-future-doctors-communicate-empathetically-patients

[18] SimPatient - High-fidelity AI patient simulation platform using hyper realistic behavioral modeling for scalable medical education https://research-portal.st-andrews.ac.uk/en/publications/simpatient-high-fidelity-ai-patient-simulation-platform-using-hyp/

[19] CLiVR: Conversational Learning System in Virtual Reality with AI ... https://arxiv.org/abs/2510.19031

[20] JMIR Medical Education - Large Language Model–Based Patient ... https://mededu.jmir.org/2025/1/e81271

[21] GenAI-Supported Virtual Patients in Health Care Education https://www.jmir.org/2026/1/e82756

[22] Embracing the Future of Medical Education With Large ... - PMC https://pmc.ncbi.nlm.nih.gov/articles/PMC12661241/

[23] Digital Standardized Patients: Conceptual Framework for ... https://mededu.jmir.org/2026/1/e91050

[24] Designing a Conversational Virtual Patient for Communication https://ideas.repec.org/h/spr/lnichp/978-3-032-08486-6_28.html

[25] Conversational AI for Automated Patient Questionnaire Completion https://arxiv.org/abs/2602.19507

[26] Full Code Medical Simulation | Mobile Application Risk ... https://www.nowsecure.com/marc-app/full-code-medical-simulation-ios/

[27] Conversational artificial intelligence system for cardiovascular care ... https://eureka.patsnap.com/patent/US20260188473A1

[28] Blog - The 4 Spheres Of Care In Practice - Body Interact https://bodyinteract.com/blog/4-spheres-of-care/

[29] Adamo Robot - LEO - Jillian Silva https://jillsilva.com/works/adamo-robot

[30] Designing and Evaluating an AI-driven Immersive Multidisciplinary ... https://arxiv.org/html/2510.08891v1

[31] Design Patterns of Human-AI Interfaces in Healthcare1footnote ... https://arxiv.org/html/2507.12721v2

[32] MANAGER-X | Simulation Management Platform - Medical-X https://medical-x.com/product/manager-x/

[33] CAE LearningSpace - Software Review - Solevant https://solevant.com/software/cae-learningspace

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/af2e773a-3428-4d4e-84c4-f38a37547fe5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
