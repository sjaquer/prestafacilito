# ⚙️ Módulo Interno: Autenticación, JWT y Seguridad (`jwt.ts` / `auth.ts`)

- **Ubicación del Código Fuente**: [`helpers/jwt.ts`](file:///home/sjaquer/Downloads/prestafacilito/helpers/jwt.ts), [`middleware/auth.ts`](file:///home/sjaquer/Downloads/prestafacilito/middleware/auth.ts), [`routes/auth.routes.ts`](file:///home/sjaquer/Downloads/prestafacilito/routes/auth.routes.ts)
- **Propósito**: Proporcionar el mecanismo de autenticación sin estado (Stateless Auth) basado en JSON Web Tokens y cookies HTTP-only seguras, validación de credenciales PIN por rol, y protección de endpoints API mediante middleware.

---

## 🔐 1. Gestión de Secreto JWT (`helpers/jwt.ts`)

### `getJwtSecret(): string`
Recupera la clave secreta desde la variable de entorno `JWT_SECRET`. Si no está configurada, utiliza una clave segura por defecto y emite una advertencia en la consola del servidor.

```typescript
export const getJwtSecret = (): string;
```

---

## 🍪 2. Configuración de Cookies Seguras (`middleware/auth.ts`)

```typescript
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" && process.env.DISABLE_SECURE_COOKIE !== "true",
  sameSite: "lax" as const,
  maxAge: 24 * 60 * 60 * 1000, // 24 Horas
};
```

### Propiedades de Seguridad:
- **`httpOnly: true`**: La cookie no puede ser leída ni modificada mediante scripts de JavaScript en el cliente (`document.cookie`), anulando ataques XSS orientados a robo de tokens.
- **`secure: true`**: La cookie solo se transmite a través de conexiones cifradas HTTPS en entornos de producción.
- **`sameSite: "lax"`**: Protege contra ataques CSRF (Cross-Site Request Forgery).

---

## 🛡️ 3. Middleware de Protección: `requireAuth`

Interrumpe la ejecución si la petición no incluye una cookie de sesión válida.

```typescript
export interface AuthRequest extends express.Request {
  user?: any;
}

export const requireAuth = (
  req: AuthRequest, 
  res: express.Response, 
  next: express.NextFunction
): void;
```

### Flujo de Verificación:
1. Extrae `req.cookies?.token`.
2. Si no existe token $\rightarrow$ Responde con `HTTP 401 Unauthorized`.
3. Verifica la firma con `jwt.verify(token, getJwtSecret())`.
4. Si la firma es correcta, inyecta `req.user = decoded` y llama a `next()`.
5. Si expiró o la firma fue alterada $\rightarrow$ Responde con `HTTP 401 Sesión inválida o expirada`.

---

## 🌐 4. Endpoints de Autenticación (`routes/auth.routes.ts`)

- **`POST /api/auth/login`**:
  - Parámetros: `{ username, password }`
  - Busca la variable de entorno correspondiente al usuario (`PIN_ADMIN`, `PIN_OPERATOR`, `PIN_VIEWER`).
  - Si coincide, genera el JWT con duración de 24 horas y emite la cookie `token`.
- **`GET /api/auth/me`**:
  - Valida el estado de autenticación actual del cliente y retorna `{ authenticated: boolean, user?: string }`.
- **`POST /api/auth/logout`**:
  - Invalida la sesión borrando la cookie `token` del navegador (`res.clearCookie`).
