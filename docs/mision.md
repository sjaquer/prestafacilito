
# DOCUMENTO MAESTRO — APP DE GESTIÓN DE PRÉSTAMOS Y ALQUILERES

## Documento de alineación para agente de IA (contexto de proyecto)

> Este documento define el objetivo, alcance y reglas de negocio de la aplicación.
> Debe usarse como fuente de verdad para verificar que el desarrollo actual esté alineado con esta visión.
> Cualquier funcionalidad que contradiga estas reglas debe ser marcada como desviación.

---

## 1. CONTEXTO Y ESCALA DEL PROYECTO

- App de uso **privado y exclusivo para 2 personas** (padre e hijo).
- **No es una empresa formal.** Es un sistema de préstamos informal a personas de confianza/conocidas.
- No debe diseñarse con lógica de "fintech multiusuario" ni con complejidad innecesaria de escalabilidad.
- Gestiona dos tipos de operaciones:
  1. **Préstamos** a personas (con interés variable, 0%–35%, definido manualmente según la persona).
  2. **Pagos de alquiler** (lógica distinta a préstamos — ver sección 4).
- Los documentos de respaldo (boletas, vouchers, capturas de pago, DNI, recibos de luz/agua, etc.) se almacenan en **Google Drive**, no dentro de la app. La app solo debe referenciar/vincular estos archivos, no gestionarlos internamente.

---

## 2. PRINCIPIOS GENERALES DE DISEÑO

- **Simplicidad sobre sofisticación.** Si una función no aporta valor directo a controlar quién debe pagar y cuánto, no debe existir.
- **Menos código, menos ruido visual, más claridad.**
- Eliminar cualquier funcionalidad decorativa o "empresarial" que no tenga uso real para 2 personas administrando préstamos personales.

---

## 3. FUNCIONALIDADES A ELIMINAR POR COMPLETO

Estas funciones deben ser removidas del sistema, incluyendo su lógica, tablas de base de datos y páginas asociadas:

- ❌ **Bitácora / logs de actividad.** No aporta valor, solo ocupa espacio en la base de datos.
- ❌ **Página de "Análisis con IA".** Se reemplaza completamente por un Dashboard/BI (ver sección 6).
- ❌ **Cuota mínima o avisos de "pago mínimo = interés".** No debe mostrarse textualmente en ninguna parte de la interfaz. Las cuotas de préstamos son libres por naturaleza; mostrar esto es "información basura". (Excepción: en **alquileres** sí debe mostrarse el monto fijo a pagar, ya que ahí sí existe un monto establecido).
- ❌ **Sistema automático que oculta deudores de la lista de "pagos próximos"** una vez que ya pagaron su cuota. La visibilidad en la página principal no depende de si ya pagaron o no su cuota del mes (ver sección 4).
- ❌ **Separación entre "pago de cuotas" y "pagos realizados"** en el detalle de préstamo. Debe ser una sola vista integrada y cronológica.

---

## 4. PÁGINA PRINCIPAL (HOME / DASHBOARD OPERATIVO)

### 4.1 Propósito

La página principal es el **centro de control en tiempo real de la cartera**. Debe mostrar únicamente información de máxima importancia operativa diaria. Todo lo demás (estadísticas, gráficas, análisis histórico) se mueve al Dashboard/BI.

### 4.2 Regla central de visibilidad de deudores

- Se debe mostrar a **TODOS los deudores cuya cuota vence dentro del mes actual**, sin importar si ya pagaron o no.
- **No** debe existir un filtro automático que oculte a alguien de esta lista solo porque ya realizó un pago. La verificación de si pagó o no la hace el usuario manualmente al entrar al detalle del préstamo.
- La fecha de pago/vencimiento mostrada siempre es la **fecha de vencimiento definida al momento de registrar el préstamo** (fecha fija de referencia mensual).
- Las tarjetas de cada deudor deben tener más detalle visual (ej. monto prestado, fecha que debe realizar el pago de su cuota, estado visual simple), con un diseño **minimalista**.

### 4.3 Formularios integrados (no modales/popups)

Los siguientes deben ser **secciones fijas dentro de la página principal**, no ventanas emergentes:

**A. Formulario de "Crear Préstamo"**

- Mismas funciones actuales, más:
  - Buscador rápido de cliente existente.
  - Botón de creación rápida de cliente sin pasos extra, sin salir del formulario.
  - **Previsualización de cuotas**: al ingresar capital, tasa de interés y número de cuotas deseado, el sistema debe calcular y mostrar el desglose de cada cuota (ver sección 4.4 — lógica de cálculo).

**B. Formulario de "Registro de Pago"**

- Sección independiente y completa, con buscador de cliente/préstamo y registro simple del monto abonado.

### 4.4 Lógica de cálculo de cuotas (previsualización al crear préstamo)

El sistema debe calcular cuotas **iguales** que amorticen tanto interés como capital, recalculando el interés sobre el capital restante en cada cuota. Ejemplo de referencia (préstamo S/100 al 10%, 2 cuotas):

Capital inicial: S/ 100 | Interés: 10%

Cuota 1:
Interés sobre S/100 = S/10
Pago cuota 1 = S/60 (S/10 interés + S/50 amortización capital)
Capital restante = S/50

Cuota 2:
Interés sobre S/50 = S/5
Pago cuota 2 = S/55 (S/5 interés + S/50 amortización capital)
Capital restante = S/0 → préstamo liquidado

El sistema debe generalizar este cálculo para "N" cuotas, siempre iguales entre sí en la medida de lo posible, recalculando interés sobre saldo insoluto en cada periodo.

---

## 5. PÁGINA DE DETALLE DE PRÉSTAMO

### 5.1 Propósito

Vista única y clara para revisar el estado completo de un préstamo: cómo se calcula el interés, cómo baja el capital, cómo se amortiza o liquida.

### 5.2 Reglas de diseño

- **Una sola vista integrada**, sin separar "cronogramas de pago" de "historial de amortizaciones. Todo debe presentarse de forma cronológica y consolidada.
- Debe mostrarse el desglose real de cada abono, mes a mes, mostrando explícitamente:
  - Capital vigente al inicio del periodo.
  - Interés generado sobre ese capital.
  - Monto abonado por el cliente.
  - Cuánto de ese abono fue a interés y cuánto a capital.
  - Capital restante resultante.

### 5.3 Ejemplo de referencia (préstamo S/1000 al 10%, abono libre)

MES 1:
S/1000 — Capital prestado (10% interés)
S/100 — Interés generado sobre S/1000
Abono del cliente = S/200
→ S/100 cubre interés
→ S/100 baja capital
Capital restante = S/900

MES 2:
S/900 — Capital restante del mes anterior
S/90 — Interés generado sobre S/900
Abono del cliente = S/100
→ S/90 cubre interés
→ S/10 baja capital
Capital restante = S/890

Este patrón se repite consecutivamente hasta liquidar el préstamo. La interfaz debe reflejar esto de forma simple, sin tablas ni cuadros visualmente complejos.

---

## 6. DASHBOARD / BI (reemplaza "Análisis con IA")

- Página dedicada a estadísticas y gráficas relevantes del negocio, entre ellas:
  - Estado general de cartera (activa, liquidada, en mora).
  - Totales prestados, totales cobrados, intereses generados.
  - Gráficas por cliente, por periodo, por tipo (préstamo vs alquiler).
  - Cualquier métrica útil para la toma de decisiones, sin necesidad de IA generativa.

---

## 7. PÁGINA DE CLIENTES

### 7.1 Reorganización de prioridad visual

- La **lista de clientes es lo principal** de esta página. El formulario de inscripción pasa a ser secundario (accesible pero no protagonista).
- La lista debe combinar vista **vertical y horizontal** para mostrar, desde la primera vista, sin necesidad de entrar al detalle:
  - Buscador de clientes.
  - Número de préstamos activos.
  - Número de préstamos liquidados.
  - Monto total histórico prestado a ese cliente.
  - Score del cliente (ver sección 8).

### 7.2 Nuevo campo: Apodo

- Agregar campo de **apodo/alias** en el formulario de cliente, para facilitar el reconocimiento en búsquedas.

---

## 8. SISTEMA DE SCORE DE CLIENTE

### 8.1 Nueva tabla en base de datos

Se requiere una tabla de historial de comportamiento de pago por cliente, que registre:

- Tiempos de pago (a tiempo / fuera de tiempo).
- Frecuencia y puntualidad histórica.
- Monto habitual que suele solicitar en préstamos.
- Cualquier otro dato relevante de comportamiento de pago.

### 8.2 Cálculo de Score

- El sistema debe generar un **score por rangos: A, B, C**.
  - **A** = mejor comportamiento de pago.
  - **C** = peor comportamiento de pago.
- Este score se muestra en la lista principal de clientes (sección 7.1).

---

## 9. CHECKLIST DE ALINEACIÓN (para verificación por el agente de IA)

- [ ] ¿Se eliminó toda referencia a bitácora/logs?
- [ ] ¿Se eliminó la página de "Análisis con IA" y fue reemplazada por Dashboard/BI?
- [ ] ¿La interfaz NO muestra avisos de "cuota mínima" en préstamos (sí en alquiler)?
- [ ] ¿La página principal muestra a TODOS los deudores del mes, paguen o no?
- [ ] ¿La fecha mostrada es la fecha de vencimiento original del préstamo?
- [ ] ¿Los formularios de crear préstamo y registrar pago son secciones fijas, no modales?
- [ ] ¿El formulario de préstamo incluye previsualización de cuotas con cálculo correcto de interés sobre saldo?
- [ ] ¿El detalle de préstamo integra cuotas y pagos en una sola vista cronológica?
- [ ] ¿El detalle de préstamo muestra el desglose interés/capital de cada abono?
- [ ] ¿La página de clientes prioriza la lista sobre el formulario?
- [ ] ¿La lista de clientes muestra préstamos activos, liquidados, monto total y score?
- [ ] ¿Existe el campo de apodo en el formulario de cliente?
- [ ] ¿Existe la tabla de historial de pagos y el cálculo de score A/B/C?
