# Microlegal - Frontend (Sprint 1)

React 18 + TypeScript + Vite + Tailwind CSS + React Router. Projecto **independente**:
instala-se, configura-se e corre-se a partir desta pasta, sem depender da raiz nem
do backend para compilar.

## Pré-requisitos

- Node.js 20+ e npm 10+

## Instalação

```powershell
npm install
```

## Configuração

```powershell
Copy-Item .env.example .env
```

Preencher `.env`:

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública (anon) - **nunca a `service_role`** |
| `VITE_API_URL` | URL do backend (ex.: `http://localhost:4000`) |

Sem `.env`, a app arranca na mesma (com aviso na consola), mas login/perfil não funcionam.

## Correr

```powershell
npm run dev      # http://localhost:5173/
npm run build    # typecheck + build de produção (pasta dist/)
npm run preview  # pré-visualizar o build
npm run typecheck
npm run lint
```

## Notas

- Autenticação: Supabase Auth (email + password). O perfil (`organization_name`,
  `phone`, `code`, `role`) é lido da tabela `public.profiles` - ver `supabase/`
  na raiz do repositório para a migração SQL e o procedimento de primeiro admin.
- Chamadas ao backend centralizadas em `src/lib/api.ts` (base: `VITE_API_URL`).
- Rotas: `/` (landing), `/verificar`, `/login`, `/registo`, `/app/*` (user),
  `/admin/*` (admin). Documentação completa no `README.md` da raiz.
