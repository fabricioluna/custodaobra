# CLAUDE.md

Este arquivo orienta o Claude Code neste repositório. Leia tudo antes de qualquer tarefa. Ao terminar cada fase, atualize a seção 15 (Estado atual).

---

## 1. O produto

**Nome: Valor da Obra.** Domínio: valordaobra.com.br (registrado). O produto se chamava "Custo da Obra" até a fase 3; o domínio custodaobra.com.br já era de outra pessoa. Slogan de trabalho: "Cada real da sua casa na ponta do lápis". O nome é descritivo, então a identidade visual (logo, cores, mascote) é o que diferencia a marca: mantenha os elementos visuais centralizados e consistentes em todo o app. Mesmo com o nome definido, nunca escreva o nome direto em componentes, textos ou metadados: use sempre `APP_NAME` (e `APP_DOMAIN`, `APP_TAGLINE`) de `src/config/app.ts`.

### Identidade visual

A logo é uma casa com chaminé em contorno amarelo-dourado com três barras de gráfico dentro (duas brancas e uma dourada, em altura crescente) sobre fundo azul-marinho, com o nome "Valor da Obra" em branco, fonte sem serifa robusta.

- Arquivos: `public/brand/`. A logo existe só em JPEG (`logo-original.jpeg`, referência). O ícone vetorial (`icon.svg`) é um redesenho da casa gerado por `npm run icons` com as cores de `src/config/brand.ts`; a logo vetorial completa (`logo.svg`) está pendente.
- Cores (tokens em `src/app/globals.css` e no tema do Tailwind, nunca valores soltos nos componentes):

  | Token | Cor | Uso |
  |---|---|---|
  | `brand-navy` (azul planta) | `#132A42` | estrutura: cabeçalho, navegação, tela de login, ícone do app, texto principal |
  | `brand-gold` (dourado lápis) | `#F5AD02` | só para dinheiro: botão "Lançar gasto", item ativo sobre o azul, "realizado" nos gráficos |
  | `brand-white` | `#FFFFFF` | texto sobre o azul |
  | `concrete` | `#F2F4F7` | fundo do app no tema claro |
  | `graphite` | `#4E5D72` | texto secundário |

  Cores tiradas da logo (JPEG em sRGB). Antes da troca de nome eram `#002344` e `#FFB800`.

- O dourado não tem contraste suficiente para texto pequeno sobre fundo branco. Sobre fundo claro, use o dourado só em botões (com texto azul-marinho dentro) e elementos gráficos; texto corrido fica em azul-marinho ou cinza escuro.
- Alertas do previsto x realizado usam cores próprias (verde, amarelo, vermelho), separadas da paleta da marca, para o dourado nunca ser confundido com "atenção".
- Tema claro como padrão, com versão escura usando o azul-marinho como fundo.
- Fonte da interface: **Archivo** (via `next/font`, com eixo de largura). Corpo na largura normal; títulos com o utilitário `heading` (largura expandida, peso 800, como letra de placa de obra). Números tabulares em valores em dinheiro (utilitário `money`).
- Princípios visuais: tudo alinhado à esquerda; o azul enquadra a tela (cabeçalho e navegação); o dourado é reservado ao dinheiro; a tecla dourada "Lançar gasto" é o elemento mais forte da tela e o resto fica quieto. A grade de planta baixa (`blueprint-grid`) aparece só em superfícies azuis de abertura (início e login). Ícones regenerados com `npm run icons`.

App web (PWA) para quem está construindo ou reformando uma casa controlar os gastos da obra. O diferencial é lançar despesas pelo WhatsApp (texto, foto de cupom, áudio) e acompanhar o **previsto x realizado por etapa** enquanto a obra acontece, a tempo de corrigir o rumo.

Públicos, em ordem de prioridade:
1. Pessoa física construindo a própria casa (plano pessoal).
2. Pequeno construtor ou empreiteiro com várias obras ao mesmo tempo (plano profissional).
3. Lojas de material de construção oferecendo o app aos clientes (parceria, futuro).

Princípios que guiam qualquer decisão:
1. Lançar um gasto deve levar menos de 10 segundos.
2. Nada que veio da IA é gravado como definitivo sem confirmação do usuário.
3. Mobile first. O uso real é no celular, no canteiro, no sol. Botões grandes, poucos campos obrigatórios, contraste alto.
4. Comercial desde o primeiro commit: multi-inquilino, dados isolados por organização, limites de plano centralizados.
5. Linguagem simples na interface. Nada de jargão técnico de engenharia ou de software para o usuário final.

---

## 2. Stack

- **Next.js** (versão estável mais recente, App Router) + **TypeScript** em modo `strict`
- **Tailwind CSS** + **shadcn/ui** para componentes; **lucide-react** para ícones
- **Supabase**: Postgres, Auth, Storage, Row Level Security (RLS). **Decisão tomada: Supabase em vez de Firebase.** Motivos: o produto é essencialmente relatório financeiro (somas por etapa, por mês, previsto x realizado), o que é natural em SQL e trabalhoso no Firestore; o isolamento entre clientes fica garantido no próprio banco com RLS; o custo não cresce a cada leitura de documento; e por ser Postgres padrão, os dados podem migrar para qualquer provedor no futuro. Não usar Firebase neste projeto.
- `@supabase/ssr` para sessão no servidor
- **Zod** para validar toda entrada (formulários, server actions, webhook, saída da IA)
- **React Hook Form** nos formulários
- **Recharts** para gráficos
- **date-fns** com locale `pt-BR`
- **API da Anthropic (Claude)** para interpretar mensagens e fotos de comprovantes
- **WhatsApp Cloud API** (oficial da Meta) para o bot
- **Vitest** para testes unitários e **Playwright** para testes ponta a ponta
- Hospedagem na **Vercel**, código no **GitHub**, CI com **GitHub Actions**
- PWA com manifest e service worker (Serwist ou equivalente mantido)

Antes de adicionar qualquer dependência nova, explique o motivo e confirme comigo.

---

## 3. Multi-inquilino (multi-tenant)

Conceitos: **usuário** (pessoa), **organização** (a conta que paga), **obra** (projeto dentro da organização).

Regras:
- Ao se cadastrar, todo usuário ganha automaticamente uma organização pessoal da qual é `owner`.
- **Toda tabela de dados de negócio tem `org_id`.** Sem exceção.
- O isolamento é garantido por **RLS no Postgres**. A aplicação nunca é a única barreira. Nenhuma tabela de negócio fica sem política RLS.
- Papéis na organização (`organization_members.role`): `owner`, `admin`, `member`.
- Acesso por obra (`project_members`): permite convidar alguém só para uma obra específica (mestre de obras, cônjuge, cliente do construtor) com papel `editor` (lança e edita) ou `viewer` (só vê).
- `owner` e `admin` enxergam todas as obras da organização. `member` enxerga só as obras em que está em `project_members`.
- Uma pessoa pode participar de várias organizações. A organização ativa vem do slug na URL: `/o/[orgSlug]/...`.
- Limites do plano (número de obras, de membros, de lançamentos via WhatsApp por mês, de chamadas de IA) são checados **somente** em `src/lib/billing/limits.ts`. Server actions e webhook chamam essa função. Nunca espalhe checagem de plano pela interface.
- O `service_role` do Supabase só pode ser usado no servidor, em `src/lib/supabase/admin.ts` (com `import "server-only"`), e apenas onde não há sessão de usuário (webhook do WhatsApp, cron). Nesses casos o código precisa filtrar explicitamente por `org_id`.

---

## 4. Modelo de dados

Convenções: chaves primárias `uuid` (`gen_random_uuid()`), `created_at` e `updated_at` (`timestamptz`) em todas as tabelas, trigger para `updated_at`. Nomes de tabelas e colunas em inglês, `snake_case`. Valores em dinheiro sempre `bigint` em **centavos**.

### Identidade e contas
- `profiles`: `id` (= `auth.users.id`), `full_name`, `whatsapp_phone` (formato E.164, único, nulo até vincular), `whatsapp_linked_at`, `default_org_id`, `onboarded_at` (preenchido quando a pessoa conclui o primeiro acesso, em que escolhe o nome da conta)
- `organizations`: `id`, `name`, `slug` (único), `kind` (`personal` | `business`), `timezone` (padrão `America/Recife`), `created_by`
- `organization_members`: `org_id`, `user_id`, `role` (`owner` | `admin` | `member`). PK composta.
- `invitations`: `id`, `org_id`, `project_id` (nulo se o convite é para a organização toda, que entra como `admin`), `org_role` (`admin` para a conta toda, `member` para uma obra), `project_role` (`editor` | `viewer`, só com obra), `label` (apelido opcional para reconhecer o convite), `token_hash` (SHA-256 do token do link; o token não é guardado), `expires_at` (7 dias), `accepted_at`, `accepted_by`, `revoked_at`, `invited_by`. `email`/`phone` entram junto com o convite por e-mail (depois do SMTP).

### Obras
- `projects` (obras): `id`, `org_id`, `name`, `address`, `city`, `state` (UF), `built_area_m2`, `standard` (`economico` | `normal` | `alto`), `start_date`, `expected_end_date`, `status` (`planejamento` | `em_andamento` | `pausada` | `concluida`), `budget_total_cents` (nulo até definir), `archived_at`
- `project_members`: `project_id`, `user_id`, `org_id`, `role` (`editor` | `viewer`)
- `stage_templates` (global, sem `org_id`, só leitura para usuários): `id`, `name`, `sort_order`, `default_percent`
- `stages` (etapas da obra): `id`, `org_id`, `project_id`, `name`, `sort_order`, `budget_cents` (nulo até definir), `progress_percent` (0 a 100, informado pelo usuário)
- `categories`: `id`, `org_id` (nulo = categoria padrão do sistema), `code`, `name`, `icon`

### Gastos
- `suppliers` (fornecedores): `id`, `org_id`, `name`, `document` (CPF ou CNPJ, opcional), `phone`, `kind` (`loja` | `profissional` | `empresa` | `outro`)
- `expenses` (lançamentos): `id`, `org_id`, `project_id`, `stage_id` (nulo = sem etapa), `category_id`, `supplier_id` (nulo), `description`, `amount_cents`, `quantity` (numérico, nulo), `unit` (ex.: `saco`, `m³`, `milheiro`, nulo), `unit_price_cents` (nulo), `spent_on` (`date`), `payment_method` (`pix` | `dinheiro` | `cartao_credito` | `cartao_debito` | `boleto` | `transferencia` | `outro`), `has_invoice` (bool), `invoice_number`, `nfe_access_key`, `status` (`pending` | `confirmed` | `cancelled`), `confirmed_at` (gravado pelo banco ao confirmar), `source` (`app` | `whatsapp_text` | `whatsapp_audio` | `whatsapp_image` | `import`), `raw_input` (texto original ou transcrição), `ai_confidence` (0 a 1, nulo se manual), `payable_id` (nulo), `created_by`, `deleted_at`
- `expense_items` (itens de um cupom, fase 4): `id`, `org_id`, `expense_id`, `description`, `quantity`, `unit`, `unit_price_cents`, `total_cents`
- `attachments` (comprovantes): `id`, `org_id`, `expense_id`, `storage_path`, `mime_type`, `size_bytes`, `uploaded_by`
- `payables` (contas a pagar): `id`, `org_id`, `project_id`, `stage_id`, `category_id`, `supplier_id`, `description`, `amount_cents`, `due_date`, `status` (`open` | `paid` | `cancelled`), `installment_group_id`, `installment_number`, `installment_total`, `paid_expense_id`

### WhatsApp
- `whatsapp_link_codes`: `id`, `user_id`, `code_hash`, `expires_at`, `used_at`
- `whatsapp_conversations`: `user_id` (PK), `active_org_id`, `active_project_id`, `state` (`idle` | `awaiting_confirmation` | `awaiting_stage` | `awaiting_amount` | `awaiting_project`), `pending_expense_id`, `context` (jsonb), `updated_at`
- `whatsapp_messages` (log): `id`, `wa_message_id` (único, garante idempotência), `direction` (`in` | `out`), `from_phone`, `user_id`, `org_id`, `type`, `payload` (jsonb), `expense_id`, `processed_at`, `error`

### Comercial
- `plans` (global): `code`, `name`, `max_projects`, `max_members`, `whatsapp_enabled`, `max_whatsapp_entries_month`, `max_ai_calls_month`, `price_cents_month`, `trial_days` (dias de teste de uma conta nova), `is_default` (plano em que toda conta nova começa; só um), `active`
- `subscriptions`: `id`, `org_id` (único), `plan_code`, `status` (`trialing` | `active` | `past_due` | `cancelled`), `trial_ends_at`, `current_period_end`, `provider`, `provider_customer_id`, `provider_subscription_id`
- `usage_counters`: `org_id`, `month` (`date`, primeiro dia do mês), `whatsapp_entries`, `ai_calls`, `ai_input_tokens`, `ai_output_tokens`, `audio_seconds` (segundos transcritos pela Groq, mínimo de 10 por áudio). PK `(org_id, month)`.
- `audit_log`: `id`, `org_id`, `user_id`, `entity`, `entity_id`, `action`, `diff` (jsonb), `created_at`

### Views úteis
- `v_stage_summary`: por etapa, `budget_cents`, `spent_cents` (lançamentos `confirmed` e não deletados), `committed_cents` (contas `open`), `progress_percent`
- `v_project_summary`: totais da obra, gasto por categoria e por mês

Views precisam respeitar RLS (`security_invoker = true`).

---

## 5. Regras de negócio

- **Dinheiro**: sempre centavos em `bigint`. Converter só na borda (entrada do usuário e exibição). Exibir com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. Toda a lógica de conversão fica em `src/lib/money.ts`, com testes.
- **Datas**: `spent_on` e `due_date` são `date` (sem hora). Interpretar "hoje", "ontem", "sexta" no fuso da organização.
- **Etapas padrão** ao criar uma obra (copiadas de `stage_templates`, o usuário pode renomear, remover e reordenar), com percentual padrão para estimativa:

  | Etapa | % padrão |
  |---|---|
  | Projetos e documentação | 3 |
  | Serviços preliminares e terreno | 2 |
  | Fundação | 8 |
  | Estrutura | 14 |
  | Alvenaria | 10 |
  | Cobertura | 9 |
  | Instalações elétricas | 6 |
  | Instalações hidrossanitárias | 6 |
  | Revestimentos e pisos | 16 |
  | Esquadrias (portas e janelas) | 9 |
  | Pintura | 6 |
  | Louças, metais e acabamentos | 8 |
  | Limpeza e entrega | 3 |

  Esses percentuais são uma referência aproximada e editável, nunca apresentados como dado técnico exato.
- **Categorias padrão**: Material, Mão de obra, Serviço terceirizado, Aluguel de equipamentos, Frete, Taxas e documentação, Terreno, Outros.
- **Terreno** (compra do lote, ITBI, escritura do terreno): aparece no total investido, mas fica **fora** do custo da construção, do custo por m² e da comparação previsto x realizado das etapas, para não distorcer esses números. O painel mostra os dois valores separados: "Construção" e "Terreno".
- **Quantidade × valor unitário** (opcional, em "mais detalhes" do lançamento): a pessoa informa, por exemplo, 20 sacos × R$ 39,00 e o app calcula o total. O valor gravado continua sendo `amount_cents`; quantidade, unidade e valor unitário são só detalhe do lançamento.
- Lançamento sem etapa aparece numa lista "Para classificar" no painel.
- Lançamentos `pending` **não** entram em nenhum total. Pendentes com mais de 24 h são cancelados por um cron diário.
- Exclusão de lançamento é sempre lógica (`deleted_at`). Toda criação, edição e exclusão gera registro em `audit_log`.
- Marcar uma conta a pagar como paga cria o lançamento correspondente e grava `paid_expense_id`.
- **Previsto x realizado** por etapa: realizado = soma dos lançamentos confirmados; comprometido = contas a pagar abertas. Alerta amarelo quando realizado + comprometido passa de 80% do previsto; vermelho acima de 100%. Alerta extra quando o percentual gasto da etapa supera em mais de 20 pontos o `progress_percent` informado.
- **Estimativa paramétrica** (fase 2): área construída × custo por m² informado pelo usuário (o app sugere um valor editável, por exemplo o CUB do estado, mas nunca o busca automaticamente nesta versão). O total é distribuído pelas etapas segundo `default_percent`. A interface deixa claro que é uma estimativa.

---

## 6. WhatsApp

### Integração
- WhatsApp Cloud API oficial da Meta. Nada de APIs não oficiais.
- Rota: `src/app/api/whatsapp/webhook/route.ts`
  - `GET`: verificação do webhook (`hub.mode`, `hub.verify_token`, `hub.challenge`).
  - `POST`: validar a assinatura `X-Hub-Signature-256` (HMAC SHA-256 do corpo bruto com `WHATSAPP_APP_SECRET`) antes de qualquer coisa. Responder `200` rápido e processar em segundo plano com `after()` do Next.js.
  - Idempotência: se `wa_message_id` já existe em `whatsapp_messages`, ignorar.
- Cliente de envio em `src/lib/whatsapp/client.ts` (texto, botões de resposta, listas, download de mídia).
- Botões de resposta: no máximo 3 por mensagem, título com até 20 caracteres. Listas: até 10 opções.
- Mensagens dentro da janela de 24 h após o usuário escrever podem ser texto livre. Mensagens proativas (alertas, relatório semanal) exigem templates aprovados pela Meta e têm custo; ficam para a fase 4 e contam no plano.

### Vincular o número do usuário
1. Em Configurações > WhatsApp, o usuário toca em "Conectar WhatsApp".
2. O app gera um código de 6 dígitos válido por 15 minutos (salvo com hash em `whatsapp_link_codes`) e abre um link `wa.me` com a mensagem `VINCULAR 123456` já preenchida.
3. O bot recebe a mensagem, confere o código e grava em `profiles.whatsapp_phone` o número exatamente como veio da Meta (`wa_id`).

Isso evita o problema do nono dígito: em números brasileiros antigos, o `wa_id` pode vir sem o 9. Mesmo assim, `src/lib/whatsapp/phone.ts` deve normalizar e comparar as duas variantes, com testes.

Número desconhecido que escreve para o bot recebe uma mensagem curta com o link de cadastro e nada mais.

### Fluxo de um lançamento
1. Mensagem chega ("300 pedreiro", "2 sacos de cimento 78 reais na loja do zé", foto de cupom, áudio).
2. Identificar usuário, organização ativa e obra ativa (`whatsapp_conversations`). Se o usuário tem mais de uma obra e nenhuma ativa, perguntar qual com uma lista.
3. Checar limites do plano em `limits.ts`.
4. Enviar para a IA (seção 7) e receber os dados estruturados.
5. Criar o lançamento com `status = 'pending'` e responder com um resumo e os botões **Confirmar**, **Editar**, **Cancelar**.
   Exemplo: `R$ 300,00 · Mão de obra · Alvenaria · Pedreiro · hoje · sem nota`
6. Confirmar muda para `confirmed`. Editar oferece uma lista do que mudar (valor, etapa, categoria, data). Cancelar muda para `cancelled`.
7. Se faltar o valor, perguntar só o valor. Se faltar a etapa, oferecer lista das etapas da obra com uma opção "Sem etapa".

### Comandos de texto
- `ajuda`: o que o bot faz, em poucas linhas
- `obras`: lista as obras e permite trocar a ativa
- `resumo`: total gasto, previsto e as 5 etapas com maior gasto
- `desfazer`: cancela o último lançamento confirmado nos últimos 10 minutos
- Perguntas livres ("quanto gastei com cimento em outubro?") na fase 4, sempre respondidas por **funções de consulta predefinidas** no código. A IA escolhe a função e os parâmetros; ela nunca escreve SQL.

---

## 7. IA

- Código em `src/lib/ai/`. Prompts versionados em `src/lib/ai/prompts/` (um arquivo por prompt, com número de versão).
- Modelo definido por variável de ambiente (`ANTHROPIC_MODEL_EXTRACTION`, `ANTHROPIC_MODEL_VISION`). Use o Haiku mais recente para extração de texto; confira o nome do modelo na documentação oficial da Anthropic antes de definir o padrão.
- Saída estruturada (structured outputs, `output_config.format` com esquema Zod via `zodOutputFormat`); validar sempre com Zod. Se a validação falhar, perguntar ao usuário em vez de adivinhar.
- Contexto enviado em cada chamada: data de hoje no fuso da organização, etapas da obra ativa (id e nome), categorias, últimos 20 fornecedores usados.
- Campos de saída: `amount_cents`, `description`, `stage_id` (ou nulo), `category_code`, `supplier_name`, `spent_on`, `payment_method`, `has_invoice`, `confidence`, `missing_fields`.
- Regras de interpretação a cobrir com testes: "300", "1.500", "1,5 mil", "mil e duzentos", "trezentos conto"; vocabulário de obra regional ("milheiro de tijolo", "carrada de areia", "saco de cimento", "diária do servente", "empreita"). Pagamento a pessoa (pedreiro, servente, eletricista) sem menção a material vira Mão de obra.
- Validação pós-IA: valor maior que zero e menor que R$ 10 milhões; data não pode ser futura além de 1 dia.
- Fotos (fase 4): ler total, fornecedor, CNPJ, data e itens do cupom ou nota. Se houver QR Code de NFC-e, guardar a chave de acesso em `nfe_access_key`.
- Áudio (fase 4): transcrever com o Whisper da Groq (`whisper-large-v3-turbo`, por `fetch`, sem SDK; chave `GROQ_API_KEY`) e seguir o fluxo de texto. A transcrição vai para `raw_input`.
- Toda chamada incrementa `usage_counters` (chamadas e tokens).
- Fixtures de teste com mensagens realistas em `tests/fixtures/whatsapp-messages.json`.

---

## 8. Estrutura de pastas

```
src/
  app/
    (marketing)/            landing page, preços, termos, privacidade
    (auth)/                 login, cadastro, recuperar acesso
    o/[orgSlug]/            área logada
      obras/
        [projectId]/
          page.tsx          painel da obra
          lancamentos/
          etapas/
          contas/
          configuracoes/
      configuracoes/        organização, membros, plano, WhatsApp
    api/
      whatsapp/webhook/route.ts
      cron/                 tarefas agendadas (Vercel Cron)
  components/
    ui/                     shadcn/ui
    layout/
  features/                 uma pasta por domínio: projects, expenses, stages, payables, suppliers, members, billing, whatsapp
    expenses/
      actions.ts            server actions
      queries.ts
      schemas.ts            esquemas Zod
      components/
  lib/
    supabase/               server.ts, client.ts, admin.ts, middleware.ts
    whatsapp/               client.ts, webhook.ts, handlers/, phone.ts, messages.ts
    ai/                     extract-expense.ts, read-receipt.ts, prompts/
    billing/                limits.ts, plans.ts
    money.ts
    dates.ts
    audit.ts
  config/
    app.ts                  APP_NAME, URLs, constantes
  types/
    database.ts             gerado pelo Supabase CLI, nunca editar à mão
supabase/
  migrations/
  seed.sql                  só dados de demonstração (planos, stage_templates e categorias padrão vêm por migration)
tests/
  unit/
  e2e/
  rls/                      testes de isolamento entre organizações
  fixtures/
```

---

## 9. Convenções

- Interface 100% em **português do Brasil**. Código (variáveis, funções, tabelas) em **inglês**.
- Textos da interface centralizados por domínio (`features/*/copy.ts`) para facilitar revisão e futura tradução.
- Server Components por padrão. Client Components só quando houver interação.
- Mutações via server actions, sempre com: validação Zod, checagem de sessão, checagem de limite do plano quando aplicável, registro em `audit_log`.
- Toda página de `/o/[orgSlug]/...` que busca dados chama `requireOrg(orgSlug)` (`src/features/organizations/queries.ts`) antes. A checagem do layout é só experiência: no Next.js, layout e página rodam em paralelo, então o layout não impede o código da página de rodar. A barreira final é sempre o RLS.
- Com `cacheComponents`, tudo que lê sessão, cookies ou `searchParams` fica dentro de `<Suspense>`. Prefira ler `searchParams` no servidor (prop da página, passada adiante) a `useSearchParams` no cliente, para o conteúdo já vir no HTML.
- Nada de `any`. Tipos do banco gerados com `supabase gen types`.
- Toda mudança de banco é uma migration em `supabase/migrations/`. Nunca alterar o banco pelo painel do Supabase.
- Toda migration que cria tabela já cria as políticas RLS da tabela.
- Dados de referência que precisam existir em todos os ambientes (planos, `stage_templates`, categorias padrão) entram por migration, não pelo `seed.sql`: o `seed.sql` só roda no Supabase local, e os ambientes `dev` e `prod` ficam na nuvem.
- Componentes acessíveis: rótulos em todos os campos, foco visível, área de toque mínima de 44 px.
- Botão flutuante "Lançar gasto" sempre visível na área da obra, abrindo um formulário curto: valor (teclado numérico), descrição, etapa (opcional), e o resto em "mais detalhes".
- Estados vazios explicam o próximo passo ("Nenhum gasto ainda. Toque em Lançar gasto ou mande uma mensagem no WhatsApp").
- Commits no formato Conventional Commits, mensagem em português (ex.: `feat: lançamento de gasto com foto`).

---

## 10. Segurança e LGPD

- Segredos só em variáveis de ambiente. Nada com prefixo `NEXT_PUBLIC_` além da URL e da chave anônima do Supabase, do número do bot e do DSN do Sentry (público por natureza: só permite enviar eventos).
- Bucket de comprovantes **privado**, caminho `org_id/expense_id/arquivo`, acesso por URL assinada de curta duração. Aceitar só imagem e PDF, até 10 MB.
- Rate limit no webhook, no login e nos convites.
- Testes de RLS obrigatórios: um usuário de uma organização nunca lê nem altera dados de outra. Esses testes rodam no CI.
- Páginas de Termos de Uso e Política de Privacidade antes do lançamento comercial, informando que as mensagens do WhatsApp são processadas por IA.
- O usuário pode exportar todos os seus dados (CSV/XLSX) e excluir a conta. Exclusão remove dados pessoais e anexos. Atenção: apagar o usuário em `auth.users` **não** apaga a organização pessoal (`created_by` vira nulo); o fluxo de exclusão precisa apagar as organizações das quais a pessoa é a única dona.
- Log de mensagens do WhatsApp guardado por 90 dias; depois disso o `payload` é apagado e fica só o vínculo com o lançamento.

---

## 11. Variáveis de ambiente

Manter `.env.example` sempre atualizado com estas chaves (sem valores):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL_EXTRACTION=
ANTHROPIC_MODEL_VISION=

GROQ_API_KEY=

WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_LINK_CODE_SECRET=
NEXT_PUBLIC_WHATSAPP_BOT_NUMBER=

CRON_SECRET=

ASAAS_API_KEY=
ASAAS_API_URL=
ASAAS_WEBHOOK_TOKEN=

NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

---

## 12. Comandos

O ambiente de desenvolvimento é **Windows** (PowerShell). Prefira comandos que funcionem no Windows.

```
npm run dev            # servidor local
npm run build
npm run lint
npm run typecheck      # tsc --noEmit
npm run test           # vitest
npm run test:e2e       # playwright
npm run db:push       # aplica as migrations no projeto ligado (supabase db push --remote)
npm run db:types      # regenera src/types/database.ts a partir do projeto ligado
npm run icons         # regenera favicon e ícones do PWA
```

Supabase CLI 3: sem `--remote`, `db push` e `gen types` miram o Supabase local (Docker). Por isso os scripts acima já passam `--remote`. O projeto ligado hoje é o `valordaobra-dev` (`vkaobopcusfuwlwaacam`, antes `custodaobra-dev`); `npx supabase login` e `npx supabase link --project-ref <ref>` são feitos uma vez por máquina.

Supabase: usar um projeto na nuvem separado para desenvolvimento (`dev`) e outro para produção, em vez do Supabase local, para não depender de Docker no Windows.

Para testar o webhook do WhatsApp localmente, expor o servidor com `cloudflared` ou `ngrok`, ou testar direto no deploy de preview da Vercel.

---

## 13. Roteiro por fases

Cada fase só termina quando todos os critérios de aceite passam e lint, typecheck e testes estão verdes.

### Fase 0: Fundação
- Projeto Next.js com TypeScript, Tailwind, shadcn/ui, ESLint, Prettier, Vitest, Playwright
- `src/config/app.ts` com `APP_NAME`, `APP_DOMAIN` e `APP_TAGLINE`
- Tokens de cor da identidade visual, favicon, ícones PWA e tela de login com a logo
- Supabase ligado; migrations de identidade, organizações, planos e assinaturas, com RLS
- Cadastro e login (e-mail com link mágico e Google)
- Ao cadastrar: cria organização pessoal, assinatura `trialing` no plano inicial e redireciona para criar a primeira obra
- Layout base mobile first com navegação inferior no celular
- GitHub Actions rodando lint, typecheck e testes em cada PR
- Deploy na Vercel com preview por PR

**Aceite:** um usuário novo se cadastra, cai na tela de criar obra e não consegue ver nada de outra organização (teste de RLS passando).

### Fase 1: MVP web
- CRUD de obras com etapas padrão criadas automaticamente
- Lançamento de gasto pelo app com foto do comprovante, e quantidade × valor unitário opcional em "mais detalhes"
- Fornecedores (criados automaticamente ao digitar um nome novo)
- Lista de lançamentos com filtros (período, etapa, categoria, fornecedor, com ou sem nota) e busca
- Painel da obra: total gasto (construção e terreno separados), gasto por etapa, por categoria e por mês, lista "Para classificar"
- Exportar lançamentos em XLSX e CSV
- PWA instalável

**Aceite:** lançar um gasto pelo celular em até 3 toques além de digitar o valor; painel atualiza na hora.

### Fase 2: Orçamento, contas e equipe
- Orçamento previsto por etapa (manual ou estimativa paramétrica)
- Previsto x realizado com alertas de cor
- Progresso informado por etapa
- Contas a pagar com parcelamento e "marcar como paga"
- Convites para a organização e por obra, com papéis
- Relatório da obra em PDF

**Aceite:** um convidado `viewer` de uma obra vê só aquela obra e não consegue editar nada.

### Fase 3: WhatsApp (texto)
- Webhook com verificação de assinatura e idempotência
- Vincular número com código
- Lançamento por texto com confirmação por botões
- Seleção de obra ativa, comandos `ajuda`, `obras`, `resumo`, `desfazer`
- Contagem de uso por plano
- Cron que cancela pendentes antigos
- Revisão final (parte 5): revisão do código da fase (`/code-review` e `/security-review`), prevenção de erros (falha da IA, da Meta ou do banco sempre gera uma resposta à pessoa e fica no log; tempo máximo do `after()` na Vercel), segurança (rate limit no webhook, exigido na seção 10; uso do `service_role` só com filtro explícito por `org_id`; simulador fora da produção; testes de RLS) e desempenho (tempo de resposta medido no deploy da Vercel; região do servidor perto do banco)

**Aceite:** "300 pedreiro" vira um lançamento confirmado em Mão de obra em no máximo 2 interações; mensagem repetida pela Meta não duplica lançamento.

### Fase 4: WhatsApp avançado
- Foto de cupom ou nota com leitura de itens
- Áudio com transcrição
- Chave da NFC-e a partir do QR Code (consulta automática à SEFAZ fica como experimento, começando por PE)
- Perguntas livres via funções de consulta predefinidas
- Alertas de estouro e relatório semanal via templates aprovados

### Fase 5: Lançamento comercial
- Landing page com preços e demonstração
- Período de teste, planos e cobrança recorrente (provedor a definir: Asaas ou Stripe, com Pix e cartão)
- Bloqueio suave ao atingir limites (o usuário continua vendo os dados, só não cria além do limite)
- Painel administrativo interno: organizações, assinaturas, uso, custos de IA
- Termos, privacidade, exportação e exclusão de conta
- Monitoramento de erros e métricas de produto

---

## 14. Como trabalhar neste repositório

1. Antes de escrever código, apresente um plano curto da tarefa e espere meu ok quando ela mexer em banco, autenticação, cobrança ou WhatsApp.
2. Uma fase por vez, em branch própria (`fase-1/lancamentos`, por exemplo), entregue por pull request.
3. Mudanças pequenas e testáveis. Rode `lint`, `typecheck` e `test` antes de cada commit.
4. Ao criar uma tabela: migration, RLS, tipos regenerados e teste de isolamento, tudo no mesmo PR.
5. Se uma regra deste arquivo atrapalhar uma boa solução, avise e proponha a mudança em vez de ignorá-la.
6. Ao fim de cada fase, atualize a seção 15.
7. Toda fase termina com uma parte de revisão antes do PR: revisar o código da fase (`/code-review` e `/security-review`), prevenir erros (o que acontece quando um serviço externo falha), conferir a segurança (RLS, segredos, entradas validadas, rate limit) e medir o desempenho (consultas em sequência que podem ir em paralelo, tempo de resposta no deploy).

---

## 15. Estado atual

- **Fase 0:** código pronto na branch `fase-0/fundacao` (PR #1, rascunho, CI verde). Feito: projeto Next.js 16 (cacheComponents) com Tailwind v4, shadcn/ui, ESLint, Prettier, Vitest e Playwright; identidade visual (cores da logo, Archivo, ícones e manifest do PWA); layout com navegação inferior; banco no projeto `dev` com identidade, organizações, planos e assinaturas (RLS); login com Google e com código ou link por e-mail; primeiro acesso (nome da conta); testes de unidade, de RLS e ponta a ponta (cadastro → primeiro acesso → criar obra); CI com lint, formatação, tipos, testes, build, RLS e Playwright em Supabase local. Deploy na Vercel funcionando (projeto `valordaobra`, produção em `valordaobra.com.br` com `www` redirecionando para ele; `custodaobra.vercel.app` continua respondendo; preview por PR protegido pela Vercel Authentication; `vercel.json` fixa o framework Next.js), ligado ao Supabase `dev` com as URLs de retorno do login cadastradas. Falta: projeto Supabase de produção.
- **Fase 1:** pronta na branch `fase-1/obras-e-gastos` (PR #2, base `main`). Feito: migrations de obras (etapas padrão por gatilho), membros por obra, categorias padrão, fornecedores, lançamentos, itens, anexos, auditoria e bucket privado `comprovantes`, todas com RLS e testes de isolamento (inclusive convidado viewer/editor e storage); resumos do painel em views (`security_invoker`); `money.ts`, `dates.ts`, `limits.ts`; telas de obras (criar, editar, arquivar), lançamento curto com "mais detalhes" (quantidade × valor unitário, fornecedor automático, foto reduzida no aparelho), lista com busca e filtros, edição e exclusão lógica, painel (construção e terreno separados, custo por m², por etapa, categoria e mês, "Para classificar"), etapas (renomear, reordenar, remover, adicionar), planilha XLSX (padrão, com `exceljs`) e CSV, lista de obras arquivadas (com atalho para reativar) e service worker com tela offline. Migrations da fase 1 aplicadas no `dev`; login e telas testados pelo usuário. Foto do comprovante testada num celular de verdade pela Vercel.
- **Fase 2:** pronta na branch `fase-2/orcamento-e-equipe` (base `fase-1/obras-e-gastos`), em 4 partes: orçamento e previsto x realizado; contas a pagar; equipe e convites; relatório em PDF. Parte 1 feita: migration `stage_budget` aplicada no `dev` (`projects.cost_per_m2_cents`, sai `budget_total_cents`, função `update_stage_plan` com RLS de quem chama), regras de alerta e da estimativa em `src/features/stages/budget.ts`, aba Etapas com previsto x realizado e subpáginas Orçamento (com estimativa), Progresso e Organizar, alertas no painel ("Atenção"). Parte 2 feita: migration `payables` aplicada no `dev` (contas com parcelas por `installment_group_id`, RLS igual à dos gastos, sem exclusão: conta que não vale mais fica `cancelled`; `pay_payable` cria o gasto confirmado e marca a conta como paga numa operação só; excluir ou cancelar o gasto do pagamento reabre a conta; `v_stage_summary.committed_cents` soma as contas abertas, sem terreno), aba Contas da obra (atrasadas, a vencer, pagas, canceladas), nova conta com parcelas mensais (valor total dividido, sobra de centavos na 1ª), detalhe com "Marcar como paga" (valor e data editáveis para juros, desconto ou atraso), editar só a parcela aberta, cancelar e reabrir; "Contas" da navegação junta as obras (com uma obra, abre a dela); painel mostra as próximas contas. `resolveSupplier` saiu de `expenses/actions.ts` para `features/suppliers/resolve.ts`. Parte 3 feita: migration `team` aplicada no `dev` (`invitations` com RLS de dono/admin; `get_invitation` mostra o resumo do convite sem login; `accept_invitation` cria o vínculo com a conta e a obra sem rebaixar dono/admin e marca o convite como usado; `org_team` lista nome, e-mail, papel e obras para dono/admin; RLS de escrita em `organization_members` e `project_members` para dono/admin, sem nunca alterar o dono, e cada um pode sair; auditoria por gatilho também nos membros), limite de membros em `limits.ts` (`canInviteMember`: membros + convites pendentes), Configurações com Equipe e troca de conta, tela da equipe (pessoas, convites pendentes, cancelar), convidar (uma obra com "Pode lançar" ou "Só acompanha", ou todas como administrador; link aparece uma vez, com copiar e WhatsApp), tela da pessoa (papel e acesso por obra, tirar da equipe), "Pessoas desta obra" nas configurações da obra, página pública `/convite/[token]` (quem chega pelo convite informa só o nome, sem escolher nome de conta), e a tecla "Lançar gasto" some para quem só acompanha (a navegação lê o acesso dentro do `<Suspense>`). Parte 4 feita: relatório da obra em `/o/[orgSlug]/obras/[projectId]/relatorio` (página própria, "Salvar em PDF" abre a impressão do navegador e usa "Relatório - obra - data" como nome do arquivo), com dados da obra, resumo (construção, custo por m², terreno, total, contas em aberto e atrasadas), previsto x realizado por etapa (ou só o gasto, sem orçamento), por categoria, por mês, contas em aberto e, opcional (`?gastos=1`), a lista de gastos (até 500; o resto na planilha). Estilos de impressão (`print:hidden` no cabeçalho, navegação e abas; folha A4 e tema claro no papel em `globals.css`). Atalhos no painel e na aba Gastos. Falta o usuário testar a fase 2 no `dev` e abrir o PR.
- **Fase 3:** pronta na branch `fase-3/whatsapp` (base `fase-2/orcamento-e-equipe`), em 5 partes: base do WhatsApp e vínculo do número; leitura da mensagem pela IA; lançamento por texto com confirmação; comandos e cron; revisão final (código, erros, segurança e desempenho). Parte 1 feita: migration `whatsapp` aplicada no `dev` (`whatsapp_link_codes` com RLS de cada um pelos próprios códigos; `whatsapp_conversations` e `whatsapp_messages` com RLS e sem política, só o servidor; `usage_counters` visível a dono/admin e somado só pelo servidor com `increment_usage`; `link_whatsapp`, só do servidor, confere o código, tira o número de quem o tinha, grava o `wa_id` e marca o código como usado; `unlink_whatsapp` para a própria pessoa), webhook `GET`/`POST` com assinatura `X-Hub-Signature-256`, resposta imediata e processamento em `after()`, idempotência pelo `wa_message_id` (grava antes de agir), `src/lib/whatsapp/` (`phone.ts` com nono dígito, `webhook.ts`, `client.ts` com `fetch` na Graph API `v26.0`, `link-code.ts`, `messages.ts`, `handlers/incoming.ts`), tela Configurações > WhatsApp (código de 6 dígitos por 15 min, `wa.me` com `VINCULAR 123456`, "Já enviei", trocar número, desconectar). Número desconhecido recebe só o link de cadastro; número ligado recebe "em breve" até a parte 3. O proxy não roda em `/api/whatsapp` nem `/api/cron`. App na Meta criado (número de teste +1 555, webhook pelo túnel `cloudflared`, token permanente de usuário do sistema): a mensagem chega e o número é ligado, mas a Meta não entrega a resposta (erro 130497: número de fora do Brasil não manda mensagem para o Brasil). Falta um número +55 só para o bot. O envio tenta a outra forma do número quando a lista de teste recusa (erro 131030) e as falhas de entrega ficam no log. Parte 2 feita: `@anthropic-ai/sdk` (Claude Haiku 5.5, `claude-haiku-5-5`, effort `low`); `src/lib/ai/extract-expense.ts` (prompt `prompts/extract-expense.v1.ts`, saída com `intent`, valor em reais e etapa pelo número da lista, convertidos no código; regras pós-IA: valor entre R$ 0,01 e R$ 9.999.999,99, data até amanhã, etapa só da lista), `context.ts` (hoje no fuso da conta, etapas, últimos 20 fornecedores), `canUseWhatsappAi` em `limits.ts` (WhatsApp ligado no plano, lançamentos e chamadas de IA do mês) e `recordUsage` em `billing/usage.ts`; 25 mensagens em `tests/fixtures/whatsapp-messages.json`, avaliadas contra a API com `npm run test:ai` (fora do CI, pede `ANTHROPIC_API_KEY`). As 25 passaram com o Haiku 5.5. Parte 3 feita: lançamento por texto em `handlers/expense.ts` (obra ativa ou lista para escolher, entre as obras em que a pessoa pode lançar: dono/admin em todas, membro só como `editor`; limites e uso; um pendente por vez; sem valor, o rascunho fica em `whatsapp_conversations.context` e o bot pergunta só o valor; com a etapa lida, resumo com Confirmar/Editar/Cancelar; sem etapa, resumo com a lista de etapas em que escolher já confirma, para "300 pedreiro" fechar em 2 interações; Editar muda valor, etapa, categoria ou data; `whatsapp_entries` conta na confirmação), ids dos botões em `actions.ts`, mensagens em `messages.ts` (etapas em páginas de 7 dentro do limite de 10 opções), simulador `/dev/whatsapp` (só em `next dev`: mostra a conversa, inclusive o que a Meta não entregou, com botões clicáveis e campo de texto) e teste de ponta a ponta em `tests/rls/whatsapp-flow.test.ts` (IA e envio simulados). Depois da parte 3: o bot marca a mensagem como lida e mostra "digitando…" (testado no celular), e o fluxo vai menos vezes ao banco (mensagem → resposta sem IA de 4,5 s para ~2,8 s; etapa → lançado de 2,4 s para ~1,2 s, medidos do Brasil contra o Supabase `dev` em `us-east-2`). Testes locais pelo celular usam o túnel `cloudflared` (o endereço muda a cada vez; o webhook da Meta é atualizado pela API com `POST /{app-id}/subscriptions`). Parte 4 feita: comandos `ajuda`, `obras` (troca a obra ativa; lista em páginas de 9 quando passa de 10), `resumo` (obra ativa ou lista para escolher; construção, previsto, contas a pagar, terreno, as 5 etapas com mais gasto e gastos sem etapa) e `desfazer` (último lançamento confirmado pela pessoa pelo WhatsApp nos últimos 10 minutos, pela hora em `expenses.confirmed_at`), sem IA e sem contar no plano, em `handlers/commands.ts`; migration `whatsapp_maintenance` (`expire_pending_expenses`: pendentes com mais de 24 h viram cancelados e a conversa volta ao começo; `purge_whatsapp_log`: `payload` apagado depois de 90 dias e códigos de vínculo vencidos removidos; só `service_role`); rotas `src/app/api/cron/expire-pending` e `purge-whatsapp-log` com `Authorization: Bearer CRON_SECRET`, agendadas no `vercel.json` (06:00 e 06:30 UTC). Parte 5 feita (revisão): falha da IA, da Meta ou do banco sempre gera resposta à pessoa e fica no log (`ai_*`, `limit_*`, `send_failed`, texto do erro); rate limit de 20 mensagens por minuto por número (avisa uma vez, depois silêncio); `maxDuration = 60` no webhook e tempo máximo de 10 s nas chamadas à Meta; migration `whatsapp_review` (`expenses.confirmed_at` por gatilho; auditoria das mudanças do bot com o autor do lançamento em vez de nulo, e do cron sem autor via `app.audit_system`); confirmar ou editar um pendente confere se a pessoa ainda pode lançar na obra; mensagens que chegam juntas deixam só o pendente mais novo; toda chamada à IA conta no plano, mesmo a que falhou; fornecedores de pendentes não voltam para a IA. `/security-review` sem achados. Simulador `/dev/whatsapp` responde 404 no build de produção (conferido com `next start`). Falta: colar o `CRON_SECRET` na Vercel, um número +55 só para o bot e medir o tempo de resposta no deploy (região da função perto do banco, `us-east-2`).
- **Fase 4:** mesclada na `main` (PR #6), em 6 partes (plano nas decisões da fase 4). Parte 1 feita: o pendente do WhatsApp nasce sem fornecedor; o nome lido pela IA fica em `whatsapp_conversations.context.pendingSupplier` (com o id do pendente, mantido ao editar, trocar de obra ou pedir o resumo) e o cadastro em `suppliers` só é criado (ou reaproveitado) na confirmação, junto com o `supplier_id`. Cancelar ou deixar vencer não deixa fornecedor sobrando. Testes no fluxo de ponta a ponta. Parte 2 feita (sem migration): foto ou PDF do cupom, nota, recibo ou comprovante de pix (mensagem `image` ou `document`; JPG, PNG e WebP até 5 MB, PDF até 10 MB, HEIC e outros recebem aviso) lidos por `src/lib/ai/read-receipt.ts` (prompt `prompts/read-receipt.v1.ts`, `ANTHROPIC_MODEL_VISION` com padrão `claude-haiku-5-5`, 45 s sem nova tentativa; chamada estruturada comum em `ai/structured.ts`); regras pós-IA: as mesmas do texto, CNPJ/CPF e chave da NFC-e (44 dígitos) conferidos pelo dígito verificador em `src/lib/documents.ts` (errados ficam vazios), itens só se a soma bate com o total (2% abaixo, 10% acima por causa de desconto). O pendente nasce com `source = whatsapp_image`, `invoice_number`, `nfe_access_key`, a foto no bucket `comprovantes` (`org_id/expense_id/`, com `attachments`) e os itens em `expense_items` (`src/lib/whatsapp/receipts.ts`; se falharem, o gasto vale e o log anota `receipt_save_failed`); o resumo mostra "N itens". Sem total legível, pergunta o valor e baixa a foto de novo da Meta quando ele chega. O CNPJ vai em `pendingSupplier.document` e entra no cadastro na confirmação (`resolveSupplier` procura antes pelo documento). O cron `expire-pending` também apaga do bucket os comprovantes de gastos do WhatsApp cancelados. Webhook com `maxDuration = 90`. Avaliação real com 6 comprovantes fictícios (`node scripts/generate-receipts.mjs` gera `tests/fixtures/receipts/` pelo Playwright): 6 de 6 com o Haiku 5.5, 2 a 4,6 s e ~4.200 tokens de entrada cada. Atenção: o CNPJ alfanumérico (emitido desde julho de 2026) ainda não é aceito (`suppliers.document` e `nfe_access_key` só com dígitos); vira migration quando aparecer um. Parte 3 feita: áudio (mensagem de voz ou arquivo `ogg`, `mp3`, `m4a`, `wav`, `webm`, `flac` até 2 MB; AMR e AAC recebem aviso) transcrito por `src/lib/ai/transcribe-audio.ts` (Whisper `whisper-large-v3-turbo` da Groq por `fetch`, `language=pt`, vocabulário de obra no `prompt`, 20 s sem nova tentativa; silêncio e frases que o Whisper inventa em áudio mudo viram "não ouvi nada"; sem `GROQ_API_KEY`, o bot avisa que não consegue ouvir agora). A transcrição segue o caminho do texto em `handlers/audio.ts`: comando falado ("resumo") vira comando; o resto vai para a IA do gasto com `source = whatsapp_audio` e a transcrição em `raw_input` (também no rascunho sem valor e enquanto a pessoa escolhe a obra), e a resposta começa com 🎤 e o que foi ouvido, para a pessoa conferir. Migration `audio_usage` aplicada no `dev`: `usage_counters.audio_seconds` e `increment_usage` com `p_audio_seconds` (mínimo de 10 s por áudio, como a Groq cobra); o limite do plano é checado antes de transcrever, na conta ativa da conversa ou na padrão da pessoa. Erros no log: `audio_unsupported`, `audio_too_large`, `audio_download_failed`, `audio_empty`, `audio_unavailable`, `audio_invalid`, `audio_not_configured`. Testes de unidade (`transcribe-audio`) e de ponta a ponta (`tests/rls/whatsapp-audio.test.ts`, Groq e IA simuladas). Chave da Groq no `.env.local` e na Vercel. Teste real com 5 áudios gerados pela voz pt-BR do Windows (pedreiro, cimento na loja do Zé, areia ontem no pix, "resumo", silêncio): 5 de 5 certos, transcrição em ~0,5 s, valores, datas, pix e fornecedor lidos certo pelo Claude depois. Falta testar com voz de gente pelo celular (sotaque, barulho de obra). Parte 4 feita (sem migration): perguntas livres pelo WhatsApp. A leitura do gasto (prompt `extract-expense.v2.ts`) separa `intent = "question"`; a pergunta vai para `src/lib/ai/answer-question.ts` (prompt `answer-question.v1.ts`, Haiku 5.5, tool use com `strict` e `tool_choice: auto`), em que a IA só escolhe de 1 a 3 funções e os parâmetros, sem receber o resultado de volta. Ferramentas em `ai/query-tools.ts`: `expenses` (`view` = total, por grupo ou lista; uma ferramenta só porque o strict aceita no máximo 16 parâmetros que podem ser nulos somando todas, com teste), `budget_status` e `payables`; parâmetros conferidos pelo Zod (etapa pelo número da lista, datas válidas, lista de 1 a 10). As consultas ficam em `whatsapp/queries.ts` (só gastos confirmados e não excluídos, filtro explícito por `org_id` e `project_id`, somas no código em páginas de 1000), e a resposta é escrita pelo código em `whatsapp/question-format.ts` (construção e terreno separados, alertas do orçamento com `stageStatus`). Nenhum número sai da IA. Pergunta conta só como chamada de IA, não como lançamento (`canAskWhatsappQuestion` em `limits.ts`), e não mexe no pendente nem no estado da conversa. Quem só acompanha (viewer em todas as obras) passa a usar o bot para perguntas: `listBotProjects` devolve as obras que lança ou, se não lança em nenhuma, as que vê (`canLaunch = false`), e para essa pessoa toda mensagem de texto ou áudio vai direto para as perguntas; foto recebe aviso; `ajuda`, `obras` e `resumo` têm a versão de quem acompanha. Quem lança em alguma obra não pergunta pelo bot sobre as obras em que só acompanha. Testes: unidade (`query-tools`, `question-format`), ponta a ponta em `tests/rls/whatsapp-question.test.ts` (IA simulada; pendente, excluído e outra conta fora; viewer), e avaliação real em `tests/ai/answer-question.eval.test.ts` com 24 perguntas de `tests/fixtures/whatsapp-questions.json`: 24 de 24 com o Haiku 5.5, de 1 a 2,7 s e ~3.400 tokens de entrada cada. A leitura v2 passou nas 29 mensagens (5 novas, com perguntas). Falta testar pelo celular. Revisão da fase (parte 6, adiantada sobre as partes 1 a 4): `/code-review` achou 10 pontos, 9 corrigidos (orçamento da obra pelo bot só compara com as etapas que têm previsto, como a aba Etapas; o limite de lançamentos não bloqueia perguntas, pois antes da IA vale só o de chamadas e o de lançamentos é conferido quando a mensagem é gasto, com `whatsappAllowance` em `limits.ts`; confirmar grava o gasto antes de cadastrar o fornecedor; itens do cupom sem total ficam em `uncheckedItems` e valem se a soma bate com o valor mandado depois; foto fora do limite recebe só o aviso do limite; áudio usa o fuso da conta; "foi 350 reais" vale como resposta do valor; total e quantidade das contas batem; webhook com `maxDuration = 150` e a escolha das consultas sem nova tentativa). O décimo fica anotado: as somas das perguntas leem os gastos em páginas de 1000 (só pesa acima de 1000 gastos numa obra; a correção é uma função SQL de soma). `/security-review` sem achados. Parte 5 com o código pronto e **migration ainda não aplicada** (`20261115100000_whatsapp_notifications.sql`): `profiles.whatsapp_budget_alerts` e `whatsapp_weekly_report` (ligados por padrão, editáveis pela própria pessoa), `plans.max_template_messages_month` (provisório: 60 no pessoal, 600 no profissional), `usage_counters.template_messages` e `increment_usage` com `p_template_messages`, tabela `budget_alerts` (último nível avisado por etapa, só o servidor). Cron diário `/api/cron/whatsapp-notifications` (12:00 UTC) em `src/lib/whatsapp/notifications.ts`: alerta quando a etapa sobe para 80% ou 100% do previsto (com as contas a pagar), esquece o aviso quando volta abaixo de 80%, e às segundas (no fuso da conta) manda o resumo da semana anterior por obra com gasto ou conta para olhar (uma vez por dia, conferido no log). Só para dono e admin com WhatsApp ligado e o aviso ligado; o plano é checado antes de cada lote (`canSendTemplates`) e cada mensagem enviada conta. Modelos em `src/lib/whatsapp/templates.ts` (`alerta_orcamento` e `resumo_semanal`, `pt_BR`, categoria Utilidade), que precisam ser cadastrados e aprovados na Meta com o mesmo texto (depende do número +55). Opções em Configurações > WhatsApp. Regras puras em `notification-rules.ts` com testes de unidade; teste de ponta a ponta em `tests/rls/whatsapp-notifications.test.ts`, que ainda não rodou (precisa da migration). Os tipos dos campos novos foram acrescentados à mão em `src/types/database.ts`, no formato do gerador; depois do `npm run db:push`, rodar `npm run db:types` para conferir. Enquanto a migration não estiver no `dev`, o bot desta branch falha ao ler o uso do plano (coluna `template_messages`). Depois da parte 5: migration `whatsapp_notifications` aplicada no `dev` pelo usuário, tipos regenerados e teste de ponta a ponta dos avisos passando. **Número +55 ativo** (2026-11-11): conta do WhatsApp Business "Valor da Obra" (WABA `1115154618097865`, número `1358430937363410`, +55 87 9112-5300, que a Meta mostra sem o nono dígito; `wa.me` usa `558791125300`), registrado na Cloud API com o PIN do usuário e com o app inscrito; foto (ícone da marca, 640×640), recado, descrição, site e categoria do perfil gravados pela API; modelos `alerta_orcamento` e `resumo_semanal` enviados para análise. Os IDs certos ficam em developers.facebook.com > Casos de uso > Conectar no WhatsApp > Etapa 2 (o `selected_asset_id` das telas do Business Settings não é o WABA ID). O mesmo número ficou registrado também na conta "Custo da Obra" (WABA `1843195033381062`), sem uso: pode ser removido. Teste real pelo celular: `ajuda`, "250 pedreiro" → etapa → lançado, `desfazer`, foto de cupom (total, loja, data, pagamento e 2 itens), áudio com voz de gente, perguntas, `resumo` e `obras`, todos certos (no `next dev`: 2 a 3 s nos comandos, 6 a 7 s nas perguntas, 10 s no áudio, 16 s na foto). Melhorias depois do teste: o Editar ganhou descrição e fornecedor (por texto), forma de pagamento, nota fiscal (com/sem) e obra (outras obras da mesma conta), e a lista de etapas ganhou "Editar lançamento" (etapas em páginas de 6); dividir a nota por etapa (prompt `read-receipt.v2.ts` com a etapa de cada item; o bot propõe um gasto por etapa quando os itens caem em etapas diferentes, com "Dividir e lançar", "Ajustar divisão" e "Não dividir", e o Editar oferece a divisão em notas com 2 itens ou mais; cada gasto leva os seus itens e uma cópia da foto, o desconto é repartido pelos maiores restos e todos são confirmados juntos; regras em `src/lib/whatsapp/split.ts`). A leitura v2 passou nos 6 comprovantes, mas ficou mais lenta (4,6 a 8,3 s, antes 2 a 4,6 s). Em produção desde 2026-11-11: PR #6 mesclado na `main`; variáveis do número novo na Vercel (Production e Preview); `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` e `WHATSAPP_ACCESS_TOKEN` da Vercel iguais aos do `.env.local` (o token de verificação estava diferente e a Meta recusava o webhook com 403); webhook da Meta em `https://valordaobra.com.br/api/whatsapp/webhook`; forma de pagamento cadastrada na conta Valor da Obra. Tempo medido na produção pelo celular: `ajuda` ~1 s, "120 servente" → lista de etapas 3 s, etapa → lançado menos de 1 s, pergunta 5 s. Falta: remover o registro sem uso do número na conta "Custo da Obra"; testar a divisão da nota e o Editar novo pelo celular. Testes locais: rodar o Vitest a partir de `C:\` maiúsculo (com o terminal em `c:\` o Vitest carrega duas vezes e todo arquivo falha com "Cannot read properties of undefined (reading 'config')").
- **Fase 5:** em andamento; partes 1 a 6 na `main` desde 2026-11-12 (PRs #8 e #11; os PRs #9 e #10 foram mesclados nas branches de base e chegaram à `main` pelo #11), em 7 partes: 1) landing page e páginas legais; 2) exportar dados e excluir conta; 3) plano e uso, bloqueio suave; 4) cobrança recorrente (Asaas); 5) painel interno; 6) monitoramento de erros (Sentry); 7) revisão e Supabase de produção (o SMTP já está feito). Parte 1 feita: página inicial em `src/app/(marketing)/page.tsx` (conversa de exemplo com o bot em HTML, com o texto real do bot; como funciona, recursos, para quem, preços lidos da tabela `plans` com a chave anônima e `"use cache"` por horas, falha só por minutos; perguntas frequentes), `/termos` e `/privacidade` (texto-base em `features/marketing/legal.ts`, a revisar com advogado; citam Anthropic, Groq, Meta, Supabase, Vercel e Google), aviso dos termos no login, `APP_CONTACT_EMAIL` (`contato@valordaobra.com.br`, a caixa precisa existir) e `LEGAL_ENTITY` (Fabrício de Meneses Luna, CPF, pessoa física por enquanto) em `src/config/app.ts`. Parte 2 feita: Configurações > Seus dados: planilha com tudo o que a pessoa vê em todas as contas (`features/account/export.ts`, com a sessão dela) e excluir a conta digitando EXCLUIR (`features/account/delete.ts`: apaga pela API do Storage os comprovantes das contas de que é dona, depois `delete_my_account()`, migration `account_deletion`, que apaga essas contas, o log do WhatsApp e o login numa transação; a auditoria fica sem autor dentro da função, senão a chave estrangeira de `audit_log` recusa a remoção em cascata de quem é convidado em outra conta); página pública `/conta-excluida`. Parte 3 feita (sem migration): `subscriptionState` em `limits.ts` (teste, teste vencido, em dia, atraso com 7 dias de tolerância, cancelada), `canWrite` em criar gasto, criar conta e pagar conta pelo app, tela Configurações > Plano e uso (dono e admin) e aviso no topo do app; `BILLING_LIVE = false` em `src/lib/billing/plans.ts` até a cobrança existir (teste vencido e atraso ainda não bloqueiam; cancelada bloqueia). Parte 5 feita: migration `platform_admin` (tabela `platform_admins` sem acesso pelo app, inclusão por SQL; `admin_orgs(mês)` só responde a quem está nela), página `/admin` com totais do mês, custo estimado da IA (`src/lib/billing/costs.ts`: Haiku 5.5 a US$ 0,10/0,50 por milhão de tokens, Groq ~US$ 0,04/hora) e uma linha por conta. No `dev`, o usuário está em `platform_admins`. Migrations da fase 5 aplicadas no `dev`. Revisão das partes 1, 2, 3 e 5 (adiantada da parte 7): `/security-review` sem achados; `/code-review` achou 10 pontos, todos corrigidos: editar conta a pagar não é mais bloqueado (só criar e pagar); criar gasto confere o plano antes de cadastrar o fornecedor; o aviso no topo aparece para conta cancelada mesmo com `BILLING_LIVE = false` e fica num `<Suspense>` próprio (a página não espera por ele); teste com menos de 24 h diz "nas próximas 24 horas" em vez de "amanhã"; contagens de obras e pessoas compartilhadas entre o limite e a tela do plano (`countActiveProjects`, `countMembers`; falha vira erro em vez de 0); a planilha ordena com `id` como desempate entre páginas e, quando uma aba passa de 50.000 linhas, ganha a aba "Aviso" dizendo quais foram cortadas; excluir a conta também varre as pastas `org_id/` do bucket (arquivos sem linha em `attachments`) e, se o banco falha depois de apagar as fotos, a mensagem diz isso (`AccountDeletionAfterFilesError`). Limite conhecido: o Storage não deixa apagar pelo SQL, então os comprovantes saem antes da transação do banco; uma falha no meio deixa a conta sem as fotos (a pessoa tenta de novo). Parte 6 feita (branch `fase-5/sentry`, PR #9, base `fase-5/lancamento-comercial`): `@sentry/nextjs` 11.10, desligado sem `NEXT_PUBLIC_SENTRY_DSN`; no servidor, `onRequestError` e `captureConsoleIntegration` (todo `console.error` com prefixo vira evento); no navegador, erros e navegações, sem Session Replay; `src/app/global-error.tsx`; `sendDefaultPii: false`; source maps só com `SENTRY_AUTH_TOKEN`. No Next 16 + Sentry 11, `withSentryConfig` vem de `@sentry/nextjs/config` e o `global-error` recebe `retry` (não `reset`). Parte 4 com o código pronto (branch `fase-5/cobranca`, PR #10, base `fase-5/sentry`), migration `billing_asaas` aplicada no `dev` pelo usuário em 2026-11-12, depois do código na `main`, e tipos regenerados (batem com os escritos à mão): `subscriptions.provider_plan_code` (plano que vale quando o pagamento for confirmado), índice único da assinatura do Asaas, tabela `billing_events` (idempotência do webhook, só o servidor) e funções `billing_set_customer`, `billing_set_subscription` (só plano ativo com preço) e `billing_mark_cancelled`, de dono e admin. Cliente em `src/lib/billing/asaas.ts` (`fetch`, cabeçalho `access_token`, sandbox por padrão; produção só com `ASAAS_API_URL=https://api.asaas.com`), regras do webhook puras em `asaas-events.ts` (pago: em dia, plano novo, período até 1 mês depois do vencimento; atraso: tolerância a partir do vencimento; estorno: período acaba agora; assinatura removida: cancelada, mantendo o período pago; evento de outra assinatura é ignorado), processamento em `asaas-webhook.ts` e rota `POST /api/billing/asaas` (token `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN`; fora do proxy). Telas: Plano e uso ganhou "Assinar um plano", a fatura em aberto, "Mudar de plano" e "Cancelar assinatura"; `/configuracoes/plano/assinar` com o plano e, na primeira vez, nome, CPF/CNPJ (conferido pelo dígito) e e-mail; a pessoa paga na fatura do Asaas (Pix, boleto ou cartão, `billingType: UNDEFINED`); quem assina no teste tem a 1ª cobrança no fim dele. Tudo some sem `ASAAS_API_KEY` ou sem plano com preço. Revisão da parte 4 (`/code-review`, 10 pontos, todos tratados): eventos fora de ordem não mexem na conta (pagamento, atraso ou estorno de uma cobrança mais antiga que o período atual é ignorado); excluir a conta remove antes as assinaturas do Asaas (`features/billing/cancel-owned.ts`; se falhar, nada é apagado); `billing_set_subscription` é comparar e trocar (`p_previous_subscription_id`), e a ação desfaz no Asaas a assinatura que criou se a gravação falhar; o cliente do Asaas é procurado pela referência (`externalReference = org_id`) antes de criar outro; a troca de plano cria a assinatura nova (vencendo no fim do período pago) e remove a antiga, porque a documentação do Asaas não lista `value` no `PUT /v3/subscriptions/{id}`; faturas em aberto com o filtro de status do Asaas; "em dia" com o período vencido além da tolerância bloqueia (se um aviso de atraso se perder); a parte da assinatura na tela do plano fica num `<Suspense>` próprio; assinatura desconhecida só vira erro em pagamento, atraso ou estorno. Revisão de segurança da parte 4: dono ou admin podia chamar `billing_set_subscription` direto e trocar só o plano guardado, pagando o barato e levando o caro; agora a função exige assinatura nova (id diferente do anterior) e o webhook só aplica o plano guardado se o valor pago (`payment.value`) cobre o preço dele. Com a segunda chave de `subscriptions` para `plans`, os `select` com `plans(...)` passaram a `plans!subscriptions_plan_code_fkey(...)`. Testes: unidade (eventos, cliente com `fetch` simulado, data da 1ª cobrança, formulário) e `tests/rls/billing-asaas.test.ts` (permissões, assinatura de outra conta, eventos invisíveis ao app, pagamento uma vez só), este só no CI até a migration ir para o `dev`. Preços decididos em 2026-11-12: Pessoal R$ 24,90 e Profissional R$ 79,90 (migration `plan_prices`; a tela do plano avisa que a cobrança ainda não começou enquanto `BILLING_LIVE` estiver desligado). Conta sandbox do Asaas criada; `ASAAS_API_KEY` (sandbox) e `ASAAS_WEBHOOK_TOKEN` só no `.env.local`. A chave do Asaas começa com `$`: no `.env.local` ela fica sem aspas e com o cifrão escapado (`ASAAS_API_KEY=\$aact_...`), senão o leitor de `.env` do Next e do Vite a expande para vazio; na Vercel não precisa escapar. Teste de ponta a ponta no sandbox (2026-11-12, com o app local): cliente e assinatura criados e guardados, fatura com link, pagamento confirmado por `POST /v3/sandbox/payment/{id}/confirm`, evento com o pagamento real entregue ao webhook local (token errado 401, aplicado uma vez, repetido ignorado) e conta "em dia" no plano; tudo apagado depois. Faltou só o Asaas entregar o webhook sozinho (o túnel `cloudflared` foi bloqueado pelas permissões do Claude Code). Falta: aplicar a migration dos preços depois do merge (`npm run db:push`); para ligar de verdade, conta real do Asaas (documentos e conta bancária), `ASAAS_API_KEY` de produção, `ASAAS_API_URL=https://api.asaas.com` e `ASAAS_WEBHOOK_TOKEN` na Vercel (Production), webhook cadastrado no Asaas para `https://valordaobra.com.br/api/billing/asaas` com o token e os eventos `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`, `SUBSCRIPTION_DELETED` e `SUBSCRIPTION_INACTIVATED`, e só então `BILLING_LIVE = true`; parte 6: conta e DSN do Sentry; parte 7; criar a caixa de e-mail de contato (o domínio não tem MX). Modelos `alerta_orcamento` e `resumo_semanal` **aprovados pela Meta em 2026-11-12** e testados de verdade: o cron de produção (`GET /api/cron/whatsapp-notifications` com o `CRON_SECRET`) mandou o alerta da Fundação da "Casa 1" em 85% (cenário de teste no `dev`: previsto de R$ 1.000 e um gasto de teste de R$ 450, "Teste do alerta: concreto da fundacao"), e `runNotifications` com uma segunda-feira mandou o resumo da semana; os dois chegaram sem erro no log. Antes da aprovação, o cron das 12:00 UTC falhou com o erro 132001 (modelo inexistente) e, como o aviso não ficou marcado, saiu na vez seguinte. Testes ponta a ponta sem o servidor de desenvolvimento aberto: `npm run build` e depois `CI=1 E2E_PORT=3100 npx playwright test` (o `next dev` aberto ao lado de um `next build` quebra com "Jest worker encountered 2 child process exceptions").
- **Decisões da fase 5 (confirmadas):** ordem das partes acima; cobrança pelo Asaas (Pix, boleto e cartão); erros pelo Sentry (dependência nova aprovada); exclusão de conta e painel interno sem `service_role` (funções `security definer` que conferem a pessoa logada); bloqueio suave só cria nada novo (ver, editar, exportar e excluir continuam).
- **Decisões da fase 3 (confirmadas):** código de vínculo guardado como HMAC com `WHATSAPP_LINK_CODE_SECRET` (não SHA-256 puro, por serem só 1 milhão de combinações) e no máximo 5 códigos errados por número por hora, contados no log (`error = 'link_code_invalid'`); número já ligado a outra pessoa passa para quem ligou por último; envio com `fetch`, sem SDK da Meta; extração com structured outputs em vez de tool use forçado (o esquema vale direto na resposta); a IA devolve valor em reais e a etapa pelo número da lista (menos erro que centavos e UUIDs).
- **Decisões da fase 2 (confirmadas):** o orçamento vale por etapa e o total da obra é a soma delas (`projects.budget_total_cents` sai de uso); a estimativa usa o custo por m² digitado pela pessoa, sem valor de CUB embutido no app; convite por link de uso único (7 dias) que a pessoa copia ou manda pelo WhatsApp, e-mail só depois do SMTP; limite de membros conta cada pessoa com acesso uma vez (organização + convidados por obra) mais os convites pendentes; relatório em PDF como página própria para impressão ("Salvar como PDF" do navegador), sem dependência nova.
- **Decisões da fase 1 (confirmadas):** auditoria gravada por gatilho no banco (`private.audit_row`), em vez de `src/lib/audit.ts`, para nada escapar (app, WhatsApp, cron); gráficos com barras em HTML/CSS em vez de Recharts por enquanto; formulários com `useActionState` + Zod, sem React Hook Form; service worker próprio mínimo em vez de Serwist; comprovante enviado junto com o formulário (limite de 4 MB por causa da Vercel; fotos ficam com ~300 KB depois de reduzidas); `exceljs` aprovado para exportar XLSX.
- **E-mail (SMTP próprio): feito em 2026-11-11** no Supabase `valordaobra-dev` (que hoje atende a produção): Resend com o domínio `valordaobra.com.br` verificado (região São Paulo; DKIM `resend._domainkey`, CNAMEs `send` e `rsend`, DMARC `_dmarc` com `p=none`, tudo no DNS do registro.br), remetente `acesso@valordaobra.com.br` ("Valor da Obra"), host `smtp.resend.com:465`, usuário `resend`, senha = `RESEND_API_KEY` (chave só de envio; também está no `.env.local` e na Vercel, onde o app não a usa). Modelos "Confirm sign up" e "Magic link or OTP" com `supabase/templates/acesso.html` (sem o comentário do topo) e assunto `Seu código de acesso: {{ .Token }}`; limite de 100 e-mails por hora. Testado com `delivered@resend.dev` (usuário e conta de teste apagados depois). Agora qualquer e-mail entra, não só quem é da equipe. Ao criar o Supabase de produção, repetir o SMTP, os modelos e o limite lá.
- **Nome:** Valor da Obra (domínio valordaobra.com.br registrado em novembro de 2026; falta a busca no INPI e o depósito como marca mista, classes 42 e 9). Nome anterior: Custo da Obra.
- **Banco e autenticação:** Supabase (decidido)
- **Logo:** pronta em JPEG; falta a versão vetorial (SVG) e o ícone quadrado
- **Planos:** Pessoal R$ 24,90 e Profissional R$ 79,90 por mês (limites ainda provisórios), 14 dias de teste. `pessoal` (padrão do cadastro): 1 obra, 3 membros, 300 lançamentos por WhatsApp e 600 chamadas de IA por mês. `profissional`: 10 obras, 10 membros, 3000 e 6000.
- **Organização pessoal:** nasce com o nome da pessoa (Google) ou o começo do e-mail; no primeiro acesso a pessoa confirma ou troca (pelo próprio nome ou o da empresa).
- **Decisões da fase 4 (confirmadas):** fornecedor lido pela IA só é criado ao confirmar o lançamento (hoje nasce com o pendente e sobra se a pessoa cancela; corrigir no começo da fase 4); transcrição de áudio com o Whisper da Groq (`whisper-large-v3-turbo`, cerca de US$ 0,04 por hora de áudio, não gasta tokens do Claude; conferir o preço e o português na página da Groq ao implementar; a Política de Privacidade precisa citar a Groq); a fase começa pela correção do fornecedor (parte 1) e segue pela foto do cupom (parte 2). Plano em 6 partes: 1) fornecedor só ao confirmar (nome lido fica em `whatsapp_conversations.context`, sem migration); 2) foto ou PDF do cupom (até 10 MB; IA de visão lê total, fornecedor, CNPJ, data, pagamento e itens; pendente com `source = whatsapp_image`; foto guardada já no pendente no bucket `comprovantes`, e o cron diário apaga os arquivos dos gastos do WhatsApp cancelados; itens em `expense_items`; fornecedor criado na confirmação com o CNPJ; chave da NFC-e lida do texto impresso e conferida pelo dígito verificador, sem biblioteca de QR Code por enquanto); 3) áudio com a Groq; 4) perguntas livres com funções de consulta predefinidas (tool use); 5) alertas e relatório semanal por templates (depende do número +55); 6) revisão final. Sem fotos reais de cupom: os testes da IA de visão usam cupons fictícios gerados por script (sem dados pessoais), e uma foto real entra quando o usuário tiver uma.
- **Decisões pendentes:** nenhuma de planos (preços decididos em 2026-11-12; provedor Asaas)
- **Contas necessárias:** Supabase (dev e prod), Vercel, chave da API da Anthropic (cobrada à parte da assinatura do Claude), conta de desenvolvedor Meta com app do WhatsApp Business
