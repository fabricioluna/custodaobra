# CLAUDE.md

Este arquivo orienta o Claude Code neste repositório. Leia tudo antes de qualquer tarefa. Ao terminar cada fase, atualize a seção 15 (Estado atual).

---

## 1. O produto

**Nome: Custo da Obra.** Domínio pretendido: custodaobra.com.br. Slogan de trabalho: "Cada real da sua casa na ponta do lápis". O nome é descritivo, então a identidade visual (logo, cores, mascote) é o que diferencia a marca: mantenha os elementos visuais centralizados e consistentes em todo o app. Mesmo com o nome definido, nunca escreva o nome direto em componentes, textos ou metadados: use sempre `APP_NAME` (e `APP_DOMAIN`, `APP_TAGLINE`) de `src/config/app.ts`.

### Identidade visual

A logo é uma casa em contorno amarelo-dourado com três barras de gráfico dentro (duas brancas e uma dourada, em altura crescente) sobre fundo azul-marinho, com o nome "Custo da Obra" em branco, fonte sem serifa robusta.

- Arquivos: `public/brand/`. Hoje existe só a versão em JPEG (`logo-original.jpeg`); a versão vetorial (`logo.svg`, `icon.svg`) está pendente. Enquanto o SVG não chegar, use o JPEG apenas como referência e gere favicon e ícones PWA a partir dele, de forma provisória.
- Cores (tokens em `src/app/globals.css` e no tema do Tailwind, nunca valores soltos nos componentes):

  | Token | Cor | Uso |
  |---|---|---|
  | `brand-navy` (azul planta) | `#002344` | estrutura: cabeçalho, navegação, tela de login, ícone do app, texto principal |
  | `brand-gold` (dourado lápis) | `#FFB800` | só para dinheiro: botão "Lançar gasto", item ativo sobre o azul, "realizado" nos gráficos |
  | `brand-white` | `#FFFFFF` | texto sobre o azul |
  | `concrete` | `#F2F4F7` | fundo do app no tema claro |
  | `graphite` | `#4E5D72` | texto secundário |

  Cores tiradas da logo (o JPEG está em Adobe RGB; os valores acima já estão convertidos para sRGB).

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
- `invitations`: `id`, `org_id`, `project_id` (nulo se o convite é para a organização toda), `email` ou `phone`, `role`, `token_hash`, `expires_at`, `accepted_at`, `invited_by`

### Obras
- `projects` (obras): `id`, `org_id`, `name`, `address`, `city`, `state` (UF), `built_area_m2`, `standard` (`economico` | `normal` | `alto`), `start_date`, `expected_end_date`, `status` (`planejamento` | `em_andamento` | `pausada` | `concluida`), `budget_total_cents` (nulo até definir), `archived_at`
- `project_members`: `project_id`, `user_id`, `org_id`, `role` (`editor` | `viewer`)
- `stage_templates` (global, sem `org_id`, só leitura para usuários): `id`, `name`, `sort_order`, `default_percent`
- `stages` (etapas da obra): `id`, `org_id`, `project_id`, `name`, `sort_order`, `budget_cents` (nulo até definir), `progress_percent` (0 a 100, informado pelo usuário)
- `categories`: `id`, `org_id` (nulo = categoria padrão do sistema), `code`, `name`, `icon`

### Gastos
- `suppliers` (fornecedores): `id`, `org_id`, `name`, `document` (CPF ou CNPJ, opcional), `phone`, `kind` (`loja` | `profissional` | `empresa` | `outro`)
- `expenses` (lançamentos): `id`, `org_id`, `project_id`, `stage_id` (nulo = sem etapa), `category_id`, `supplier_id` (nulo), `description`, `amount_cents`, `quantity` (numérico, nulo), `unit` (ex.: `saco`, `m³`, `milheiro`, nulo), `unit_price_cents` (nulo), `spent_on` (`date`), `payment_method` (`pix` | `dinheiro` | `cartao_credito` | `cartao_debito` | `boleto` | `transferencia` | `outro`), `has_invoice` (bool), `invoice_number`, `nfe_access_key`, `status` (`pending` | `confirmed` | `cancelled`), `source` (`app` | `whatsapp_text` | `whatsapp_audio` | `whatsapp_image` | `import`), `raw_input` (texto original ou transcrição), `ai_confidence` (0 a 1, nulo se manual), `payable_id` (nulo), `created_by`, `deleted_at`
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
- `usage_counters`: `org_id`, `month` (`date`, primeiro dia do mês), `whatsapp_entries`, `ai_calls`, `ai_input_tokens`, `ai_output_tokens`. PK `(org_id, month)`.
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
- Saída estruturada com tool use e esquema JSON; validar sempre com Zod. Se a validação falhar, perguntar ao usuário em vez de adivinhar.
- Contexto enviado em cada chamada: data de hoje no fuso da organização, etapas da obra ativa (id e nome), categorias, últimos 20 fornecedores usados.
- Campos de saída: `amount_cents`, `description`, `stage_id` (ou nulo), `category_code`, `supplier_name`, `spent_on`, `payment_method`, `has_invoice`, `confidence`, `missing_fields`.
- Regras de interpretação a cobrir com testes: "300", "1.500", "1,5 mil", "mil e duzentos", "trezentos conto"; vocabulário de obra regional ("milheiro de tijolo", "carrada de areia", "saco de cimento", "diária do servente", "empreita"). Pagamento a pessoa (pedreiro, servente, eletricista) sem menção a material vira Mão de obra.
- Validação pós-IA: valor maior que zero e menor que R$ 10 milhões; data não pode ser futura além de 1 dia.
- Fotos (fase 4): ler total, fornecedor, CNPJ, data e itens do cupom ou nota. Se houver QR Code de NFC-e, guardar a chave de acesso em `nfe_access_key`.
- Áudio (fase 4): transcrever com um serviço de transcrição (a definir) e seguir o fluxo de texto. A transcrição vai para `raw_input`.
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

- Segredos só em variáveis de ambiente. Nada com prefixo `NEXT_PUBLIC_` além da URL e da chave anônima do Supabase.
- Bucket de comprovantes **privado**, caminho `org_id/expense_id/arquivo`, acesso por URL assinada de curta duração. Aceitar só imagem e PDF, até 10 MB.
- Rate limit no webhook, no login e nos convites.
- Testes de RLS obrigatórios: um usuário de uma organização nunca lê nem altera dados de outra. Esses testes rodam no CI.
- Páginas de Termos de Uso e Política de Privacidade antes do lançamento comercial, informando que as mensagens do WhatsApp são processadas por IA.
- O usuário pode exportar todos os seus dados (CSV/XLSX) e excluir a conta. Exclusão remove dados pessoais e anexos.
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

WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
NEXT_PUBLIC_WHATSAPP_BOT_NUMBER=

CRON_SECRET=
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
npx supabase db push   # aplicar migrations no projeto ligado
npx supabase gen types typescript --linked > src/types/database.ts
```

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

---

## 15. Estado atual

- **Fase atual:** 0 (nada implementado)
- **Nome:** Custo da Obra (verificar e registrar o domínio custodaobra.com.br; criar logo próprio e depositar como marca mista no INPI, classes 42 e 9)
- **Banco e autenticação:** Supabase (decidido)
- **Logo:** pronta em JPEG; falta a versão vetorial (SVG) e o ícone quadrado
- **Planos:** provisórios, preço zero, 14 dias de teste. `pessoal` (padrão do cadastro): 1 obra, 3 membros, 300 lançamentos por WhatsApp e 600 chamadas de IA por mês. `profissional`: 10 obras, 10 membros, 3000 e 6000.
- **Organização pessoal:** nasce com o nome da pessoa (Google) ou o começo do e-mail; no primeiro acesso a pessoa confirma ou troca (pelo próprio nome ou o da empresa).
- **Decisões pendentes:** provedor de cobrança; serviço de transcrição de áudio; valores dos planos
- **Contas necessárias:** Supabase (dev e prod), Vercel, chave da API da Anthropic (cobrada à parte da assinatura do Claude), conta de desenvolvedor Meta com app do WhatsApp Business
