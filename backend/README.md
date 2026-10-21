# Microlegal - Backend (Sprint 1)

Node.js + Express + TypeScript + Zod. Projecto **independente**: instala-se,
configura-se e corre-se a partir desta pasta, sem depender da raiz nem do frontend.

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
| `PORT` | Porta (ex.: `4000`) |
| `CLIENT_ORIGIN` | Origem do frontend para CORS (ex.: `http://localhost:5173`) |
| `TRUST_PROXY` | N.º de proxies à frente do servidor (`0` em local, `1` atrás de Nginx/Render/Railway) |
| `SUPABASE_URL` | Mesmo projecto Supabase do frontend |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública (validação de tokens) |
| `SUPABASE_SERVICE_ROLE_KEY` | Opcional, só no servidor, para operações admin futuras |

Sem `.env` válido o servidor **termina no arranque** com erro explícito
(comportamento intencional - falha rápido em vez de correr mal configurado).

## Correr

```powershell
npm run dev        # watch (tsx) - http://localhost:4000
npm run build      # compila para dist/
npm start          # corre dist/server.js
npm run typecheck
npm run lint
```

## Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/health` | não | Estado do servidor |
| GET | `/api/me` | sim | Utilizador + perfil autenticado |
| GET | `/api/profile` | sim | Perfil próprio |
| PATCH | `/api/profile` | sim | Só `organization_name`/`phone` |
| GET | `/api/admin/overview` | `admin` | Indicadores (zeros na Sprint 1) |

Autenticar com `Authorization: Bearer <access_token do Supabase>`. A identidade vem
sempre do token validado - nunca de `userId` do cliente. Documentação completa
(incluindo migração SQL e RLS) no `README.md` da raiz.
