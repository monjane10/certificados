# Microlegal - Plataforma de Gestão e Emissão de Certificados Digitais

Sprint 1: base do projecto, autenticação real (Supabase Auth), autorização por perfis
(`admin` / `user`), dashboards separados, perfis de utilizador e página pública de
validação (interface em preparação).

Sprint 2: gestão de cursos e formandos — CRUD real de cursos
(`/app/cursos`, `/app/cursos/novo`, `/app/cursos/:id`), registo e gestão de
formandos por curso, persistência no Supabase, autorização no backend e RLS.

Actualização Sprint 2 (N:N): um formando pode inscrever-se em vários cursos.
`formandos` (registo central com proprietário) + `matriculas`
(formando↔curso + avaliação por curso, `UNIQUE (formando_id, curso_id)`).
Ver migração `20261014000000_formandos_matriculas_nn.sql`.

## Arquitectura

Dois projectos **independentes** (sem npm workspaces) + SQL versionado:

- `frontend/` - projecto npm próprio (React + TypeScript + Vite + Tailwind +
  React Router), com o seu `package.json`, `package-lock.json` e
  `node_modules/` locais. Pode ser aberto, instalado e feito deploy sozinho.
- `backend/` - projecto npm próprio (Node.js + Express + TypeScript + Zod),
  também com `package.json`, `package-lock.json` e `node_modules/` locais.
- A raiz contém apenas scripts de conveniência (`npm run dev`, `build`,
  `install:all`, via `--prefix`) e o `concurrently` para correr ambos juntos.
  Não partilha dependências entre frontend e backend.

```text
microlegal-certificados/
├── frontend/               # React + TypeScript + Vite + Tailwind + React Router
│   └── src/
│       ├── components/     # ui/ (Button, Input, Card, Spinner, EmptyState), layout/
│       │                   # courses/ (CourseForm, TraineeForm, CourseTable,
│       │                   #   TraineeTable, GradeModal, EnrollPanel,
│       │                   #   CourseStatusBadge, Modal,
│       │                   #   ConfirmDialog, States) - Sprint 2 (N:N)
│       ├── contexts/       # AuthContext (sessão + perfil centralizados)
│       ├── layouts/        # PublicLayout
│       ├── lib/            # supabase.ts, api.ts (chamadas ao backend)
│       ├── pages/          # public/, auth/, admin/, user/ (user/: Dashboard,
│       │                   #   Courses, CourseNew, CourseDetail - Sprint 2)
│       │                   # user/Collections: só Certificados (Formações passou
│       │                   #   a /app/cursos; /app/formacoes redirecciona)
│       ├── routes/         # ProtectedRoute, AppRoutes
│       └── services/       # courses.ts (courseService, traineeService) - Sprint 2
├── backend/                # Node.js + Express + TypeScript + Zod
│   └── src/
│       ├── config/         # env (validado com Zod), supabase
│       ├── controllers/    # profileController, courseController (Sprint 2)
│       ├── middlewares/    # auth, requireRole, validate, rateLimit, errorHandler
│       ├── routes/         # api.ts (/health, /me, /profile, /admin/overview,
│       │                   #   /courses, /courses/:id, .../trainees,
│       │                   #   /trainees, /enrollments/:matriculaId - Sprint 2 N:N)
│       ├── schemas/        # validação Zod: profile, course, trainee (Sprint 2)
│       └── services/       # profileService (RLS via JWT do utilizador),
│                           # courseService (cursos + formandos, propriedade) - Sprint 2
├── supabase/migrations/    # SQL: tabela profiles, RLS, triggers (Sprint 1);
│                           # cursos + formandos_matriculados + RLS (Sprint 2)
└── README.md
```

## Estratégia de autenticação (decisão documentada)

- **Supabase Auth com EMAIL + PASSWORD.** O formulário de registo pede
  `organization_name` + `email` + `phone` + `password`.
- O **telefone é apenas dado de perfil** - não existe verificação por SMS/OTP
  (requereria configuração de Twilio/message provider no Supabase, em falta).
- Nenhum email é inventado a partir do telefone.
- Se a **confirmação de email** estiver activa no projecto Supabase, o registo
  mostra o aviso correspondente e o login só cria sessão após confirmação; a
  rota protegida apresenta um estado "A finalizar a sua conta…" em vez de
  redireccionar em ciclo.
- O campo **`code`** (ex.: `ML-X7K2PQ`) é gerado pelo sistema no trigger SQL.
- Novos registos recebem **sempre `role = 'user'`** (forçado no trigger +
  políticas + backend; o `role` do cliente nunca é aceite).

## Pré-requisitos

- Node.js 20+ e npm 10+
- Um projecto Supabase (URL + anon/public key)

## Instalação

```powershell
# Opção A - tudo de uma vez (raiz do projecto):
npm run install:all

# Opção B - cada projecto em separado (totalmente independentes):
Set-Location backend; npm install; Set-Location ..
Set-Location frontend; npm install; Set-Location ..
```

## Variáveis de ambiente

```powershell
Copy-Item frontend\.env.example frontend\.env
Copy-Item backend\.env.example backend\.env
```

Preencher:

| Ficheiro | Variável | Descrição |
|---|---|---|
| `frontend/.env` | `VITE_SUPABASE_URL` | URL do projecto Supabase |
| `frontend/.env` | `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública (anon) - **nunca a `service_role`** |
| `frontend/.env` | `VITE_API_URL` | URL do backend (ex.: `http://localhost:4000`) |
| `backend/.env` | `PORT` | Porta do backend (ex.: `4000`) |
| `backend/.env` | `CLIENT_ORIGIN` | Origem do frontend para CORS |
| `backend/.env` | `TRUST_PROXY` | N.º de proxies à frente do servidor (`0` em local, `1` atrás de Nginx/Render/Railway) |
| `backend/.env` | `SUPABASE_URL` | Mesmo projecto Supabase |
| `backend/.env` | `SUPABASE_PUBLISHABLE_KEY` | Chave pública (validação de tokens) |
| `backend/.env` | `SUPABASE_SERVICE_ROLE_KEY` | Opcional, só no servidor, para operações admin futuras |

## Base de dados (Supabase)

1. Criar um projecto em <https://supabase.com>.
2. Aplicar as migrações `supabase/migrations/` por ordem (via **Supabase CLI**
   (`supabase db push`), ou colar o conteúdo no **SQL Editor** pela ordem dos
   nomes):
   - `20261010000000_profiles.sql` (Sprint 1)
   - tabela `public.profiles` (`id` → `auth.users`, `code` único, `role` com
     `CHECK (role IN ('admin','user'))`, índices, `updated_at` automático);
   - `handle_new_user()` - trigger idempotente `AFTER INSERT ON auth.users`
     que cria o perfil com `role='user'` e código `ML-XXXXXX`;
   - RLS activado + políticas: leitura/actualização/inserção do **próprio**
     perfil; acesso total apenas para admins (`is_admin()`);
   - triggers `protect_profile_role` (não-admin não muda `role`/`code`) e
     `force_default_role` (inserts directos ficam `user`).
4. **Auth → Providers → Email**: decidir se a confirmação de email fica activa.
5. **Primeiro administrador** (procedimento controlado, operador autorizado):
   ```sql
   -- 1. registar normalmente a conta do futuro admin (fica 'user')
   -- 2. localizar:
   select id, email, organization_name, role from public.profiles
   where email = 'admin@microlegal.co.mz';
   -- 3. promover:
   update public.profiles set role = 'admin'
   where email = 'admin@microlegal.co.mz';
   ```
    Ver `supabase/migrations/20261010000001_make_first_admin.sql`. Nunca expor
    este fluxo no frontend; nunca usar a `service_role` no cliente.
6. Aplicar a migração `20261013000000_cursos_formandos.sql` (Sprint 2). Cria:
    - tabela `public.cursos` (`id` UUID, `nome`, `carga_horaria INTEGER > 0`,
      `codigo TEXT UNIQUE` gerado pelo sistema (`CUR-XXXXXX`),
      `data_abertura`/`data_encerramento DATE` com
      `CHECK (encerramento >= abertura)`,
      `status CHECK IN ('planeado','em_andamento','concluido','cancelado')`,
      `user_id → auth.users ON DELETE CASCADE`, `created_at`/`updated_at`);
    - (histórico) tabela `formandos_matriculados` — **substituída** pela
      migração seguinte; não utilizar.
7. Aplicar a migração `20261014000000_formandos_matriculas_nn.sql`
   (Sprint 2, N:N — DEPOIS da anterior). Cria:
    - tabela `public.formandos` (registo central: `id` UUID, `nome`, `email`
      opcional validado, `contacto` opcional, `user_id → auth.users`
      proprietário, timestamps);
    - tabela `public.matriculas` (`id` UUID, `formando_id → formandos` e
      `curso_id → cursos` em cascata, `avaliacao NUMERIC 0–20` opcional **por
      curso**, `UNIQUE (formando_id, curso_id)`, índices nas FKs);
    - **porta os dados** de `formandos_matriculados` (deduplica por
      utilizador via nome/email/contacto normalizados; avaliação e
      `created_at` viajam para a matrícula) e remove a tabela antiga;
    - triggers anti-troca de proprietário/ligação; RLS: formandos por
      proprietário directo, matrículas via curso associado (insert exige
      formando próprio — sem partilha entre utilizadores);
    - funções atómicas `remover_matricula(uuid)` (Caso A: última matrícula →
      remove o formando; Caso B: preserva) e `remover_curso(uuid)` (remove
      matrículas, preserva formandos com outros cursos, limpa só órfãos do
      dono), ambas com verificação de propriedade interna.
8. Aplicar a migração `20261021000000_correcoes_seguranca.sql` (DEPOIS da
   anterior). Corrige:
    - `remover_curso`/`remover_matricula`: retira o `EXECUTE` de `PUBLIC`
      (só `authenticated` executa), exige sessão e compara a propriedade de
      forma NULL-safe;
    - `protect_profile_role`: permite ao operador (SQL Editor / service_role,
      sem utilizador no JWT) promover o primeiro admin.
9. Aplicar a migração `20261021000001_tipo_curso.sql` (DEPOIS da anterior).
   Acrescenta `cursos.tipo` (obrigatório):
    - `participacao`: sem notas; certificado de participação (todos os
      matriculados);
    - `tecnico_profissional`: nota 0–20 por matrícula; aprovação a partir de
      10 valores (`NOTA_MINIMA_APROVACAO` no frontend);
    - cursos existentes ficam como `tecnico_profissional`;
    - triggers: recusa notas em matrículas de cursos de participação e só
      permite mudar um curso para participação se não houver notas lançadas.
10. Aplicar a migração `20261021000002_certificados.sql` (DEPOIS da
    anterior). Cria a tabela `public.certificados` e:
    - `emitir_certificados(curso)`: emissão em lote, num clique, para o curso
      **concluído** e com **data de encerramento**. Participação → todos os
      matriculados; técnico-profissional → nota ≥ `nota_minima_aprovacao()`
      (10). Um certificado activo por matrícula; reemitir não duplica;
    - cada certificado guarda uma cópia dos dados (nome, curso, nota,
      instituição) e um código `CERT-XXXXXXXX`;
    - `anular_certificado(id, motivo)`: certificados não se apagam, anulam-se;
    - `verificar_certificado(codigo)`: verificação pública (anon);
    - bloqueios enquanto houver certificado activo: alterar a nota, remover a
      matrícula/formando/curso, mudar o tipo do curso;
    - escrita na tabela apenas pelas funções (sem INSERT/UPDATE directos).
11. Aplicar a migração `20261021000003_modelos_certificado.sql` (DEPOIS da
    anterior). Modelos visuais de certificado, escolhidos por curso
    (`cursos.modelo_certificado`): `classico` (por defeito), `ondas_azuis`,
    `violeta`, `dourado`, `minimalista`. O modelo é copiado para cada
    certificado na emissão; mudar o modelo do curso actualiza também os
    certificados activos (só a aparência; o conteúdo não muda). O desenho de
    cada modelo está em `frontend/src/components/certificates/templates/`.
12. Aplicar a migração `20261021000004_identidade_certificados.sql` (DEPOIS
    da anterior). Logótipo, assinatura e responsável nos certificados:
    - perfil: `logo_path`, `assinatura_path`, `responsavel_nome`,
      `responsavel_cargo` (editáveis em **Perfil → Identidade nos
      certificados**);
    - bucket de Storage `branding` (leitura pública, máx. 1 MB, PNG/JPG/WebP);
      cada utilizador só escreve na pasta `<user_id>/`;
    - a assinatura tem o fundo branco removido no browser antes do envio;
    - os quatro campos são copiados para o certificado na emissão: alterar o
      logótipo/assinatura não muda certificados já emitidos.

## Execução

```powershell
# Opção A - ambos juntos (raiz, um só terminal):
npm run dev

# Opção B - cada projecto no seu terminal/pasta:
Set-Location backend; npm run dev   # backend  http://localhost:4000
Set-Location frontend; npm run dev  # frontend http://localhost:5173
```

Nota: o backend termina com erro claro se `backend/.env` estiver em falta
(`Configuração de ambiente inválida`) - comportamento intencional.

## Scripts

| Pasta | Comando | Efeito |
|---|---|---|
| backend | `npm run dev` | Express em watch (`tsx`) |
| backend | `npm run build` / `start` | Compila (`tsc`) / corre `dist/server.js` |
| backend | `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint |
| frontend | `npm run dev` | Vite dev |
| frontend | `npm run build` | `tsc --noEmit` + `vite build` |
| frontend | `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint |
| raiz | `npm run dev` | Ambos juntos (`concurrently`) |
| raiz | `npm run build` / `install:all` | Build / install de backend + frontend |

## Endpoints (backend)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/health` | não | Estado do servidor |
| GET | `/api/me` | sim | Utilizador + perfil autenticado |
| GET | `/api/profile` | sim | Perfil próprio |
| PATCH | `/api/profile` | sim | Actualiza só `organization_name`/`phone` (Zod `strict`) |
| GET | `/api/admin/overview` | `admin` | Indicadores (zeros honestos + total de utilizadores) |
| GET | `/api/courses` | sim | Lista cursos do utilizador (com `total_formandos`) |
| POST | `/api/courses` | sim | Cria curso (código gerado; `user_id` do token) |
| GET | `/api/courses/:id` | sim | Detalhes do curso + formandos (só próprios, 404 caso contrário) |
| PATCH | `/api/courses/:id` | sim | Actualiza curso próprio (código/proprietário preservados) |
| DELETE | `/api/courses/:id` | sim | Exclui curso próprio (remove matrículas; preserva formandos com outros cursos; devolve `removedMatriculas`/`removedOrphanFormandos`) |
| GET | `/api/courses/:id/trainees` | sim | Matrículas do curso próprio (vista formando + avaliação + data) |
| POST | `/api/courses/:id/trainees` | sim | Cria formando e matricula, ou matricula existente via `{formando_id}` (409 se duplicado; `curso_id` do path) |
| GET | `/api/trainees?q=` | sim | Pesquisa formandos próprios (para matricular noutro curso) |
| PATCH | `/api/trainees/:id` | sim | Actualiza dados pessoais (reflecte-se em todos os cursos) |
| PATCH | `/api/enrollments/:matriculaId` | sim | Actualiza avaliação SÓ nesta matrícula/curso |
| DELETE | `/api/enrollments/:matriculaId` | sim | Cancela matrícula (Caso A remove formando; Caso B preserva + informa) |

Segurança: `authenticate` valida o access token via `supabase.auth.getUser()` e
propaga o JWT para o RLS (`auth.uid()`); a identidade **nunca** vem de `userId`
do cliente. `requireRole('admin')` aplica a autorização efectiva. Helmet, CORS
configurável, rate-limit em rotas sensíveis, tratamento centralizado de erros.

## Testes realizados (nesta máquina)

- `npm run typecheck` - backend ✅, frontend ✅
- `npm run lint` - backend ✅, frontend ✅
- `npm run build` - backend ✅ (`tsc`), frontend ✅ (`tsc` + `vite build`;
  apenas aviso pré-existente de chunk > 500 kB)
- Runtime: `GET /api/health` → `200 {"status":"ok",...}` ✅;
  `GET /api/me` sem token → `401` ✅; rota inexistente → `404` ✅
- Frontend `vite dev` → `200` na `/` ✅
- **Não testado de ponta a ponta**: registo/login reais, criação de perfil pelo
  trigger, RLS contra dados reais - **requer projecto Supabase configurado**
  (ver "Configuração pendente" abaixo). Nenhum resultado de integração é afirmado.

## Testes realizados — Sprint 2 (nesta máquina)

- `npm run typecheck` - backend ✅, frontend ✅ (inclui correcção
  `moduleResolution: node → Node16` no `backend/tsconfig.json`, exigida por
  versões recentes do TypeScript; `module: Node16` emparelhado)
- `npm run lint` - backend ✅, frontend ✅
- `npm run build` - backend ✅, frontend ✅
- Runtime (servidor local com `backend/.env` real):
  - `GET /api/health` → `200` ✅
  - `GET /api/courses`, `POST /api/courses`, `GET /api/courses/:id/trainees`,
    `DELETE /api/trainees/:id` sem token → `401` ✅
  - `GET /api/courses` com token inválido → `401` ✅
  - Rota inexistente → `404` ✅
  - `vite dev` → `200` na `/` ✅
- Validação Zod (script descartável via `tsx`, 17/17 ✅): nome obrigatório,
  carga horária inteira positiva, encerramento ≥ abertura, status permitido,
  `user_id`/`codigo`/`curso_id` injectados rejeitados (`strict`), email e
  contacto validados quando fornecidos, avaliação 0–20, updates vazios
  rejeitados.
- **Não testado de ponta a ponta**: fluxos autenticados reais (criar curso,
  matricular formando, RLS contra dados reais, isolamento entre utilizadores) —
  requer sessão de utilizador real no projecto Supabase. Executar após aplicar
  as migrações `20261013000000` e `20261014000000`, por esta ordem:
  1. login como utilizador A → criar curso → aparece em `/app/cursos`;
  2. registar formando → visível em `/app/cursos/:id`; persiste após refresh;
  3. matricular o mesmo formando noutro curso (separador «Já registado»);
     tentar duplicar no mesmo curso → mensagem clara (409);
  4. cancelar matrícula com 1 curso → formando removido (Caso A); com vários →
     restantes intactos + aviso (Caso B);
  5. editar dados pessoais → reflecte-se nos dois cursos; editar avaliação →
     só no curso seleccionado;
  6. excluir curso → formandos com outros cursos preservados;
  7. login como utilizador B → curso/matrícula de A dá `404`; pesquisa de
     formandos de A devolve vazio (sem fuga entre utilizadores).

## Funcionalidades concluídas (Sprint 1)

- [x] Estrutura frontend/backend/supabase
- [x] Migração SQL: profiles + RLS + triggers + procedimento de primeiro admin
- [x] Registo (email/password + organização + telefone), login com mostrar/ocultar
      password, logout, recuperação de sessão, estados de carregamento/erro
- [x] `AuthContext` centralizado (sessão + perfil + `refreshProfile`)
- [x] Separação admin (`/admin`) / user (`/app`), `ProtectedRoute` por perfil,
      página 403, 404, autorização efectiva no backend
- [x] Landing page (hero, vantagens, 2 categorias com preços 100 MT / 150 MT
      como informação comercial, validação/segurança, passos, FAQ provisória, footer)
- [x] `/verificar`: interface pública; **sem simulação de validação** (mensagem
      explícita de funcionalidade futura + área de resultado reservada)
- [x] Dashboards com sidebar responsiva, cartões honestos (zeros/estados vazios),
      gestão de utilizadores (listagem funcional; acções futuras marcadas),
      perfil funcional (só campos autorizados), definições
- [x] `.env.example` separados, `.gitignore`, ESLint, TypeScript estrito

## Funcionalidades concluídas (Sprint 2)

- [x] Migração `20261013000000_cursos_formandos.sql`: `cursos`, índices, CHECKs,
      triggers de código/propriedade, RLS por proprietário (+ admin)
- [x] Migração `20261014000000_formandos_matriculas_nn.sql` (N:N): `formandos`
      + `matriculas` com `UNIQUE (formando_id, curso_id)`, porte de dados
      deduplicado, remoção da tabela antiga, RLS, funções atómicas
      `remover_matricula` / `remover_curso`
- [x] Backend: `schemas/course.ts` + `schemas/trainee.ts` (Zod `strict`;
      `user_id`/`codigo`/`curso_id` do cliente nunca aceites), `services/`
      com verificação de propriedade reutilizável, `controllers/` +
      endpoints REST (cursos, `trainees`, `enrollments`), IDs validados como
      UUID, duplicados devolvem `409`
- [x] Frontend: `/app/cursos` (pesquisa, filtro por estado, tabela desktop +
      cartões mobile, total, loading/erro/vazia), `/app/cursos/novo`,
      `/app/cursos/:id` (detalhes + matrículas com pesquisa nome/email/contacto,
      avaliação e data de matrícula), registo com separadores
      «Novo formando» / «Já registado» (pesquisa + consulta de dados antes de
      matricular), edição de dados pessoais separada da avaliação por curso,
      cancelamento com mensagens Caso A/B, `ConfirmDialog` antes de exclusões,
      toasts, botões com loading, React Hook Form + Zod, serviços
      `courseService`/`traineeService`
- [x] Dashboard `/app` com contadores reais (cursos, formandos); sidebar com
      entrada «Cursos» (`/app/formacoes` redirecciona para `/app/cursos`)
- [x] `backend/tsconfig.json`: `module/moduleResolution Node16` (corrige aviso
      de depreciação do `node10` sem alterar o comportamento)

## Limitações / próxima sprint (explicitamente NÃO feito)

- Emissão de certificados, pagamentos/cobranças, QR code funcional, assinatura
  digital, edição de utilizadores pelo admin, testes automatizados (unit/e2e).
  Todos os botões futuros estão desactivados ou etiquetados ("Em breve" /
  "indisponível") - nenhum simula operação real.
- Sprint 2 — notas: sem paginação na listagem (ordenada por mais recentes;
  paginação se a lista crescer); sem exclusão em massa; avaliação 0–20 sem
  escala institucional acordada (opcional, por matrícula); exclusão de curso
  remove as matrículas e só os formandos órfãos do próprio dono (com retenção
  futura para certificados/pagamentos nos pontos marcados `remover_matricula`
  / `remover_curso`); sem partilha de formandos entre utilizadores (cada
  registo tem proprietário; RLS + `WITH CHECK` no insert da matrícula).

## Configuração pendente no Supabase (para o operador)

1. Criar projecto e obter URL + anon key.
2. Aplicar a migração SQL.
3. Definir confirmação de email (on/off) e, se activa, configurar templates/redirect.
4. Preencher `frontend/.env` e `backend/.env`.
5. Registar 1.ª conta → promover a `admin` via SQL (procedimento acima).
6. Testar: registo → perfil criado (`select * from profiles`) → login → `/app`;
   como `user`, tentar `/admin` (esperado: 403) e `PATCH /api/profile` com
   `{"role":"admin"}` (esperado: 400/rejeitado, role inalterado).
