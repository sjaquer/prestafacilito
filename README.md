# 💸 PrestaFacilito

> **PrestaFacilito** es una plataforma moderna y premium de administración de préstamos, cobranzas, gestión de clientes y análisis financiero automatizado. Diseñada con una arquitectura robusta de backend en Express y una interfaz de usuario fluida estilo Glassmorphism sobre React, está completamente optimizada para dispositivos móviles y de escritorio.

PrestaFacilito integra herramientas de Inteligencia Artificial mediante **Google Gemini** para análisis estratégico, procesamiento inteligente de comprobantes (OCR) con **Tesseract.js** y respaldos automatizados en **Google Drive** vía OAuth 2.0.

---

## ✨ Características Principales

*   📊 **Dashboard Financiero Premium**: Métricas en tiempo real de capital colocado, porcentaje de recuperación global, créditos activos y alertas automáticas de vencimiento mediante un diseño estilo Bento-grid reactivo.
*   👥 **Gestión Integral de Clientes**: Registro, búsqueda interactiva y perfiles financieros de prestatarios con histórico detallado de abonos y saldos pendientes.
*   📝 **Cronograma Dinámico de Amortización**: Generación en tiempo real del estado de deuda, cálculo automático de mora acumulada y proyección de cuotas con soporte para múltiples métodos de pago (Yape, Plin, Transferencias, Efectivo).
*   🛡️ **Plan de Ayuda y Flexibilidad**: Motor de facilidades de pago integrado que permite congelar intereses, aplicar periodos de gracia, condonar moras y modificar cuotas individuales de manera transparente para el prestatario.
*   🤖 **Inteligencia Artificial con Google Gemini**:
    *   **Reportes Gerenciales On-Demand**: Diagnóstico estratégico semanal de liquidez, proyecciones de flujo de caja para 4 semanas y estrategias de cobranza accionables de alto impacto.
    *   **Redactor de Cobro WhatsApp**: Plantillas de cobranza personalizadas y empáticas con emojis, listas para copiar y enviar en un clic.
*   📸 **OCR de Comprobantes (Conciliación Rápida)**: Procesamiento digital de capturas de pantalla (Yape, Plin, BCP) para extraer automáticamente montos, fechas y códigos de operación sin digitación manual.
*   ☁️ **Almacenamiento Seguro e Híbrido**: Almacenamiento local temporal con respaldos y proxy seguro para visualización de vouchers directo en Google Drive privado.
*   🕵️‍♂️ **Bitácora de Auditoría Completa (Logs)**: Registro inmutable de cada acción administrativa (ingresos, abonos, reestructuraciones y logins) para un control interno seguro.

---

## 🛠️ Stack Tecnológico

*   **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion (animaciones fluidas), Lucide React.
*   **Backend**: Node.js, Express (API REST segura con autenticación basada en JWT y Cookies HttpOnly).
*   **Base de Datos**: Supabase (PostgreSQL) con consultas e inserciones altamente optimizadas.
*   **Servicios Cloud e Integraciones**:
    *   Google Gemini API (Modelos `gemini-2.5-flash` para velocidad y ahorro de tokens).
    *   Google Drive API v3 (Almacenamiento privado de comprobantes vía OAuth 2.0).
    *   Tesseract.js (Reconocimiento Óptico de Caracteres en navegador).

---

## 📋 Requisitos Previos

Antes de desplegar el proyecto, asegúrate de contar con:
1.  **Node.js** v18 o superior y **npm**.
2.  Un proyecto activo en **Supabase** (puedes crear uno gratis).
3.  Una cuenta en **Google Cloud Console** con una aplicación configurada para Google Drive API y credenciales OAuth 2.0 (ClientId y ClientSecret).

---

## 🚀 Guía de Instalación y Configuración

### 1. Clonar el repositorio e instalar dependencias

```bash
git clone https://github.com/tu-usuario/prestafacilito.git
cd prestafacilito
npm install
```

### 2. Configurar la Base de Datos (Supabase)

1.  Ingresa al panel de control de tu proyecto en **Supabase**.
2.  Abre el **SQL Editor** y pega el contenido completo del archivo [`supabase_schema.sql`](file:///i:/Documentos/DESARROLLO/APLICACIONES%20PERSONAS/prestafacilito/supabase_schema.sql) disponible en la raíz del proyecto.
3.  Ejecuta el script para crear de forma segura las tablas e índices necesarios (`clientes`, `prestamos`, `amortizaciones` y `logs`).
4.  Crea un **Bucket Público** de almacenamiento en la sección de Storage llamado `vouchers` (opcional, si deseas almacenar comprobantes en Supabase además de Google Drive).

### 3. Configurar las Variables de Entorno

Crea una copia del archivo `.env.example` y nómbrala `.env`:

```bash
cp .env.example .env
```

Edita el archivo `.env` configurando tus valores reales:

```env
# Claves de Supabase (Database & Auth)
SUPABASE_URL="https://tu-proyecto.supabase.co"
SUPABASE_KEY="tu-supabase-anon-key"

# Autenticación de PrestaFacilito
ADMIN_USER="admin"
ADMIN_PASS="tu_password_segura"
JWT_SECRET="un_secreto_aleatorio_muy_largo"

# Inteligencia Artificial
GEMINI_API_KEY="tu-gemini-api-key"

# Integración con Google Drive OAuth 2.0
GOOGLE_CLIENT_ID="tu-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="tu-google-client-secret"
GOOGLE_DRIVE_FOLDER_ID="id-de-la-carpeta-en-tu-drive-donde-se-guardaran-los-vouchers"
# Nota: GOOGLE_REFRESH_TOKEN se obtendrá y guardará automáticamente en el siguiente paso.
GOOGLE_REFRESH_TOKEN=""
```

### 4. Vincular Google Drive (OAuth 2.0 Flow)

Para evitar lidiar con la expiración constante de tokens de acceso de Google, PrestaFacilito cuenta con un flujo seguro y automático para capturar un **Refresh Token** de larga duración:

1.  Inicia el servidor localmente con `npm run dev`.
2.  Abre tu navegador e ingresa a: `http://localhost:3000/api/auth/google/login`.
3.  Inicia sesión con tu cuenta de Google y concede los permisos de lectura/escritura en Google Drive.
4.  Al finalizar, el servidor capturará automáticamente tu **Refresh Token** y **lo guardará en tu archivo `.env`**.
5.  ¡Listo! La carga de comprobantes estará activa de forma transparente.

---

## 🏃‍♂️ Ejecución en Entorno Local

*   **Modo Desarrollo (HMR activo)**:
    ```bash
    npm run dev
    ```
    El servidor arrancará en `http://localhost:3000` con Vite sirviendo el frontend en tiempo real y Express controlando los endpoints del backend en el mismo puerto de forma unificada.

*   **Compilación para Producción**:
    ```bash
    npm run build
    ```
    Este comando compila el frontend optimizado en la carpeta `dist/` y genera un bundle consolidado del servidor de backend en `dist/server.cjs` usando Esbuild.

*   **Ejecutar en Producción**:
    ```bash
    npm start
    ```

---

## 🔒 Seguridad y Buenas Prácticas

1.  **Exclusión de Secretos**: El archivo `.env` está expresamente excluido de Git mediante `.gitignore` para evitar cualquier filtración de accesos públicos.
2.  **Cookies HttpOnly**: La autenticación de la sesión administrativa viaja cifrada mediante Cookies seguras que no pueden ser accedidas por scripts del lado del cliente, previniendo ataques de tipo XSS.
3.  **Proxy Seguro**: Las imágenes de vouchers alojadas en Google Drive no se acceden mediante enlaces públicos directos. En su lugar, el backend actúa como un proxy seguro (`/api/vouchers/proxy/:fileId`) inyectando las cabeceras de autorización requeridas de forma invisible para el cliente.

---

## 📄 Licencia

Este proyecto es de código abierto. Siéntete libre de clonarlo, modificarlo y adaptarlo a tus necesidades comerciales o personales.

_Creado con dedicación para simplificar la administración financiera diaria._ 🚀
