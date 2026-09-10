# gestion-capital-back

API backend para **Gestiona Capital Humano** — Node.js, Express y TypeScript.

## Requisitos

- Node.js 20+
- PostgreSQL local (Docker `global_postgres` en puerto `5433`)

## Configuración

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales de correo si las necesitas.

## Desarrollo

```bash
npm install
npm run dev
```

El servidor inicia en `http://localhost:3001`.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor con recarga en caliente |
| `npm run build` | Compila a `dist/` |
| `npm run start` | Ejecuta build de producción |
| `npm run typecheck` | Verificación de tipos |

## Base de datos

```bash
npm run db:migrate   # Crea tablas staff y students
```

### Opción 1: SQL completo (recomendado si no hay tablas)

Ejecuta todo de una vez en PostgreSQL:

```bash
psql -h 127.0.0.1 -p 5433 -U user -d capital -f src/database/init.sql
```

O copia y pega el contenido de `src/database/init.sql` en tu cliente SQL (DBeaver, pgAdmin, etc.).

### Opción 2: Migraciones npm

```bash
npm run db:migrate   # Solo crea tablas
```

Luego inserta el admin con `src/database/seeds/001_admin.sql`.

### Tablas

| Tabla | Uso |
|-------|-----|
| `staff` | Administradores y maestros |
| `students` | Estudiantes (auth en fase posterior) |

## Auth (staff)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/staff/login` | Login admin/maestro |
| `GET` | `/api/auth/staff/me` | Perfil (Bearer token) |

## Panel admin (frontend)

- Login: `http://localhost:3000/admin/login`
- Dashboard: `http://localhost:3000/admin`

## Estructura del proyecto

```
src/
├── config/           # Variables de entorno y conexión DB
├── controllers/      # Manejo de req/res HTTP
├── services/         # Lógica de negocio
├── repositories/     # Acceso a base de datos
├── routes/           # Definición de rutas
├── middleware/       # Auth, errores, etc.
├── validators/       # Esquemas de validación (Zod)
├── types/            # Tipos TypeScript
├── errors/           # Errores personalizados
├── database/         # Migraciones y seed
├── app.ts            # Configuración Express
└── index.ts          # Punto de entrada
```

### Flujo de una petición

```
routes → middleware → controller → service → repository → DB
```

