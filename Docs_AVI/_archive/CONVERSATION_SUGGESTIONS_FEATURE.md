# Conversation Suggestions Feature / Función de Sugerencias de Conversación

**Documento de Implementación Técnica**
**Fecha:** 2025
**Versión:** 1.0
**Estado:** Implementado

---

## Tabla de Contenidos / Table of Contents

1. [Descripción General / Overview](#descripción-general--overview)
2. [Arquitectura / Architecture](#arquitectura--architecture)
3. [Guía de Configuración / Configuration Guide](#guía-de-configuración--configuration-guide)
4. [Uso / Usage](#uso--usage)
5. [Detalles Técnicos / Technical Details](#detalles-técnicos--technical-details)
6. [Solución de Problemas / Troubleshooting](#solución-de-problemas--troubleshooting)
7. [Archivos Modificados / Modified Files](#archivos-modificados--modified-files)
8. [Mejoras Futuras / Future Enhancements](#mejoras-futuras--future-enhancements)

---

## Descripción General / Overview

### ¿Qué es esta funcionalidad? / What is this feature?

La funcionalidad de **Sugerencias de Conversación** proporciona a los usuarios de AVI dos tipos de sugerencias inteligentes para mejorar la experiencia de chat, inspirado en el estilo de Perplexity:

1. **Sugerencias Iniciales** (_Initial Suggestions_): Aparecen cuando el usuario hace clic en el área de entrada de texto en una conversación nueva/vacía
2. **Sugerencias de Seguimiento** (_Follow-up Suggestions_): Se generan automáticamente después de cada respuesta del asistente usando IA

### Beneficios / Benefits

- **Acelera la interacción**: Los usuarios pueden iniciar conversaciones rápidamente con sugerencias predefinidas
- **Orientación contextual**: Las sugerencias de seguimiento guían al usuario hacia preguntas relevantes basadas en el contexto
- **Personalización por rol**: Las sugerencias iniciales se adaptan según el rol y subrol AVI del usuario
- **Experiencia profesional**: Interfaz moderna y fluida similar a Perplexity

### Experiencia de Usuario / User Experience

**Sugerencias Iniciales:**
- Se muestran en una cuadrícula 2x2 debajo de los botones de acción
- Aparecen cuando el usuario enfoca el área de texto en una conversación vacía
- Desaparecen automáticamente al hacer clic o enviar un mensaje
- Animación suave de entrada con retrasos escalonados

**Sugerencias de Seguimiento:**
- Aparecen debajo del último mensaje del asistente
- Se generan usando IA basándose en las últimas 6 interacciones
- Máximo 3-4 sugerencias de hasta 70 caracteres
- En el mismo idioma que el último mensaje del usuario

---

## Arquitectura / Architecture

### Diagrama de Flujo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│                   INITIAL SUGGESTIONS                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend (ChatForm.tsx)                                     │
│       │                                                      │
│       ├─> useQuery(['initialSuggestions'])                  │
│       │                                                      │
│       └─> GET /api/suggestions/initial                      │
│                  │                                           │
│                  ├─> requireJwtAuth                         │
│                  │                                           │
│                  ├─> User.findById(userId)                  │
│                  │    .populate('aviSubrol_id')             │
│                  │    .populate('aviRol_id')                │
│                  │                                           │
│                  ├─> Fallback Chain:                        │
│                  │    1. aviSubrol.initial_suggestions      │
│                  │    2. aviRol.initial_suggestions         │
│                  │    3. config.defaultInitialSuggestions   │
│                  │                                           │
│                  └─> { suggestions: [...] }                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  FOLLOW-UP SUGGESTIONS                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend (ContentRender.tsx)                                │
│       │                                                      │
│       ├─> useQuery(['followUpSuggestions', messageId])      │
│       │                                                      │
│       └─> POST /api/suggestions/follow-up                   │
│           { conversationId }                                 │
│                  │                                           │
│                  ├─> requireJwtAuth                         │
│                  │                                           │
│                  ├─> Verify conversation ownership          │
│                  │                                           │
│                  ├─> getMessages({ conversationId })        │
│                  │    └─> Last 6 messages                   │
│                  │                                           │
│                  ├─> Format conversation context            │
│                  │                                           │
│                  ├─> Call Google Gemini Flash               │
│                  │    └─> Generate 3 suggestions            │
│                  │        (max 70 chars each)               │
│                  │                                           │
│                  └─> { suggestions: [...] }                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Componentes Backend / Backend Components

#### 1. Database Schema Changes

**`packages/data-schemas/src/schema/aviRol.ts`**
```typescript
initial_suggestions: {
  type: [String],
  default: [],
  validate: [
    {
      validator: function(v: string[]) {
        return v.length <= 4;
      },
      message: 'Maximum 4 initial suggestions allowed'
    }
  ],
}
```

**`packages/data-schemas/src/schema/aviSubrol.ts`**
```typescript
initial_suggestions: {
  type: [String],
  default: [],
  validate: [
    {
      validator: function(v: string[]) {
        return v.length <= 4;
      },
      message: 'Maximum 4 initial suggestions allowed'
    }
  ],
}
```

#### 2. API Routes

**`api/server/routes/suggestions.js`**

- **GET `/api/suggestions/initial`**
  - Authentication: Required (JWT)
  - Response: `{ suggestions: string[] }`
  - Logic: Fallback chain (aviSubrol → aviRol → config defaults)

- **POST `/api/suggestions/follow-up`**
  - Authentication: Required (JWT)
  - Body: `{ conversationId: string }`
  - Response: `{ suggestions: string[] }`
  - Logic: Fetch messages → Format context → Call Google Gemini → Parse JSON

#### 3. Services

**`api/server/services/Suggestions/generateFollowUp.js`**

Funciones principales:
- `generateFollowUpSuggestions(conversationId, userId, messageCount)`: Función principal
- `callLLMForSuggestions(conversationContext, model)`: Llama a Google Gemini Flash
- `parseJSONSuggestions(text)`: Parsea la respuesta JSON del LLM

**Flujo:**
1. Obtener últimos N mensajes de la conversación (default: 6)
2. Formatear mensajes como contexto: `"Usuario: ...\nAsistente: ..."`
3. Enviar prompt estructurado a Google Gemini Flash
4. Parsear respuesta JSON: `["sugerencia 1", "sugerencia 2", "sugerencia 3"]`
5. Retornar máximo 4 sugerencias

#### 4. Configuration Validation

**`packages/data-provider/src/config.ts`**

```typescript
const conversationSuggestionsSchema = z.object({
  enabled: z.boolean().default(true),
  defaultInitialSuggestions: z.array(z.string()).max(4).default([]),
  fastModel: z.string().default('gemini-1.5-flash'),
}).optional();
```

### Componentes Frontend / Frontend Components

#### 1. InitialSuggestions Component

**`client/src/components/Chat/Input/InitialSuggestions.tsx`**

- Ubicación: Dentro de `ChatForm.tsx`, debajo de los botones de acción
- Fetching: React Query con `dataService.getInitialSuggestions()`
- UI: Cuadrícula 2x2 con animaciones escalonadas
- Comportamiento: Desaparece al hacer clic o al enviar mensaje (blur del textarea)

**Lógica de visibilidad:**
```typescript
const showInitialSuggestions = useMemo(() => {
  return (
    isTextAreaFocused &&
    (conversation?.messages?.length === 0 || !conversation?.messages) &&
    !textValue?.trim() &&
    !isSubmitting &&
    !isSubmittingAdded
  );
}, [isTextAreaFocused, conversation?.messages, textValue, isSubmitting, isSubmittingAdded]);
```

#### 2. FollowUpSuggestions Component

**`client/src/components/Chat/Messages/FollowUpSuggestions.tsx`**

- Ubicación: Dentro de `ContentRender.tsx`, debajo del último mensaje del asistente
- Fetching: React Query con `dataService.getFollowUpSuggestions({ conversationId })`
- Delay: 200ms después del render del mensaje (evita bloquear la UI)
- Cache: `staleTime: Infinity` (las sugerencias son contextuales al mensaje)

**Lógica de visibilidad:**
```typescript
const shouldRenderFollowUp =
  !msg.isCreatedByUser &&
  isLast &&
  !isSubmitting &&
  !!conversation?.conversationId;
```

#### 3. Data Provider

**`packages/data-provider/src/api-endpoints.ts`**
```typescript
export const initialSuggestions = () => `${BASE_URL}/api/suggestions/initial`;
export const followUpSuggestions = () => `${BASE_URL}/api/suggestions/follow-up`;
```

**`packages/data-provider/src/data-service.ts`**
```typescript
export function getInitialSuggestions(): Promise<{ suggestions: string[] }> {
  return request.get(endpoints.initialSuggestions());
}

export function getFollowUpSuggestions(params: { conversationId: string }): Promise<{ suggestions: string[] }> {
  return request.post(endpoints.followUpSuggestions(), params);
}
```

---

## Guía de Configuración / Configuration Guide

### 1. Configuración Básica en librechat.yaml

Agregar la siguiente sección a tu archivo `librechat.yaml`:

```yaml
# Conversation Suggestions Configuration
conversationSuggestions:
  enabled: true  # Habilitar/deshabilitar toda la funcionalidad
  defaultInitialSuggestions:
    - "¿Cómo puedo manejar una crisis emocional con un NNA?"
    - "Dame estrategias para crear rutinas efectivas"
    - "¿Qué hacer cuando un niño presenta conductas desafiantes?"
    - "Necesito consejos para fortalecer vínculos seguros"
  fastModel: "gemini-1.5-flash"  # Modelo para generar sugerencias de seguimiento
```

**Opciones de configuración:**

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Habilitar/deshabilitar sugerencias |
| `defaultInitialSuggestions` | string[] | `[]` | Sugerencias por defecto (máx. 4) |
| `fastModel` | string | `"gemini-1.5-flash"` | Modelo de Google Gemini a usar |

**Modelos soportados:**
- `gemini-1.5-flash` (recomendado - rápido y económico)
- `gemini-1.5-pro`
- `gemini-2.0-flash-exp`

### 2. Variables de Entorno

**Requerido para Sugerencias de Seguimiento:**

Agregar a tu archivo `.env`:

```bash
# Google API Key for Follow-up Suggestions
GOOGLE_API_KEY=tu_clave_api_de_google_aqui
# O alternativamente:
GOOGLE_KEY=tu_clave_api_de_google_aqui
```

**Cómo obtener una Google API Key:**

1. Ir a [Google AI Studio](https://aistudio.google.com/apikey)
2. Crear un nuevo proyecto o seleccionar uno existente
3. Generar una nueva API key
4. Copiar la clave a tu archivo `.env`

**Nota:** Sin la API key, las sugerencias de seguimiento retornarán un array vacío, pero las sugerencias iniciales seguirán funcionando.

### 3. Configuración por Rol AVI (MongoDB)

#### Agregar sugerencias a un rol AVI:

```javascript
// Conectar a MongoDB
use LibreChat;

// Actualizar un rol específico
db.aviRol.updateOne(
  { name: "Cuidador" },
  {
    $set: {
      initial_suggestions: [
        "¿Cómo establecer rutinas de autocuidado?",
        "Estrategias para manejar el estrés laboral",
        "Técnicas de contención emocional efectivas",
        "¿Qué hacer ante comportamientos agresivos?"
      ]
    }
  }
);
```

#### Agregar sugerencias a un subrol AVI:

```javascript
// Actualizar un subrol específico
db.aviSubrol.updateOne(
  { name: "Cuidador Principal" },
  {
    $set: {
      initial_suggestions: [
        "¿Cómo liderar al equipo en situaciones de crisis?",
        "Coordinación efectiva entre turnos",
        "Protocolo de atención inmediata en emergencias",
        "Supervisión y apoyo al equipo de cuidado"
      ]
    }
  }
);
```

#### Verificar configuración:

```javascript
// Ver sugerencias de un rol
db.aviRol.findOne({ name: "Cuidador" }, { name: 1, initial_suggestions: 1 });

// Ver sugerencias de un subrol
db.aviSubrol.findOne({ name: "Cuidador Principal" }, { name: 1, initial_suggestions: 1 });
```

### 4. Prioridad de Sugerencias (Fallback Chain)

El sistema sigue esta jerarquía para determinar qué sugerencias iniciales mostrar:

```
1. aviSubrol.initial_suggestions (más específico)
   ↓
2. aviRol.initial_suggestions (menos específico)
   ↓
3. config.conversationSuggestions.defaultInitialSuggestions (genérico)
   ↓
4. [] (array vacío si nada está configurado)
```

**Ejemplo:**
- Usuario con rol "Cuidador" y subrol "Cuidador Principal"
- Si "Cuidador Principal" tiene `initial_suggestions` → se usan esas
- Si no, se busca en rol "Cuidador"
- Si tampoco, se usan las de `librechat.yaml`
- Si ninguna está configurada, no se muestran sugerencias

---

## Uso / Usage

### Para Usuarios Finales / For End Users

#### Sugerencias Iniciales

1. **Abrir una conversación nueva o vacía**
2. **Hacer clic en el área de entrada de texto** (enfocarlo)
3. **Aparecerán 4 sugerencias** debajo de los botones de acción
4. **Hacer clic en una sugerencia** para enviarla automáticamente
5. Las sugerencias **desaparecen** inmediatamente después de hacer clic o al escribir

**Captura Visual:**
```
┌──────────────────────────────────────────────┐
│  [Adjuntar]  [Badges]  [Audio]  [Enviar] 📞 │
├──────────────────────────────────────────────┤
│  Sugerencias                                 │
├──────────────────────────────────────────────┤
│ ┌────────────────┐  ┌────────────────┐      │
│ │ Sugerencia 1   │  │ Sugerencia 2   │      │
│ └────────────────┘  └────────────────┘      │
│ ┌────────────────┐  ┌────────────────┐      │
│ │ Sugerencia 3   │  │ Sugerencia 4   │      │
│ └────────────────┘  └────────────────┘      │
└──────────────────────────────────────────────┘
```

#### Sugerencias de Seguimiento

1. **Enviar un mensaje al asistente**
2. **Esperar la respuesta completa** del asistente
3. Después de 200ms, **aparecen 3-4 sugerencias** debajo del mensaje del asistente
4. **Hacer clic en una sugerencia** para continuar la conversación
5. Las sugerencias son **contextuales** basadas en las últimas interacciones

**Captura Visual:**
```
┌──────────────────────────────────────────────┐
│ 🤖 Asistente                                 │
├──────────────────────────────────────────────┤
│ Aquí está la respuesta a tu pregunta...     │
│                                              │
│ [Sugerencia 1] [Sugerencia 2] [¿Y si...?]   │
└──────────────────────────────────────────────┘
```

### Para Administradores / For Administrators

#### Habilitar/Deshabilitar la Funcionalidad

**Deshabilitar completamente:**
```yaml
# librechat.yaml
conversationSuggestions:
  enabled: false
```

**Deshabilitar solo sugerencias de seguimiento:**
- No configurar `GOOGLE_API_KEY` en `.env`
- Las sugerencias iniciales seguirán funcionando

#### Gestión de Sugerencias por Rol

**Script para actualizar múltiples roles:**

```javascript
// update-suggestions.js
const mongoose = require('mongoose');

// Configuración de sugerencias por rol
const rolesSuggestions = {
  "Cuidador": [
    "¿Cómo manejar situaciones de crisis?",
    "Técnicas de contención emocional",
    "Estrategias de autocuidado",
    "Trabajo en equipo efectivo"
  ],
  "Psicologo": [
    "¿Cómo evaluar trauma complejo?",
    "Intervenciones terapéuticas basadas en evidencia",
    "Manejo de transferencia y contratransferencia",
    "Protocolos de derivación y coordinación"
  ],
  "Administrativo": [
    "Gestión de casos y documentación",
    "Coordinación con equipos externos",
    "Cumplimiento normativo",
    "Planificación de intervenciones"
  ]
};

async function updateRoleSuggestions() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const [roleName, suggestions] of Object.entries(rolesSuggestions)) {
    await mongoose.model('aviRol').updateOne(
      { name: roleName },
      { $set: { initial_suggestions: suggestions } }
    );
    console.log(`✓ Updated ${roleName}`);
  }

  await mongoose.disconnect();
}

updateRoleSuggestions();
```

#### Monitoreo y Análisis

**Ver qué usuarios tienen sugerencias configuradas:**
```javascript
// Contar usuarios por tipo de configuración
db.users.aggregate([
  {
    $lookup: {
      from: 'aviSubrol',
      localField: 'aviSubrol_id',
      foreignField: '_id',
      as: 'subrol'
    }
  },
  {
    $lookup: {
      from: 'aviRol',
      localField: 'aviRol_id',
      foreignField: '_id',
      as: 'rol'
    }
  },
  {
    $project: {
      hasSubrolSuggestions: {
        $gt: [{ $size: { $ifNull: [{ $arrayElemAt: ['$subrol.initial_suggestions', 0] }, []] } }, 0]
      },
      hasRolSuggestions: {
        $gt: [{ $size: { $ifNull: [{ $arrayElemAt: ['$rol.initial_suggestions', 0] }, []] } }, 0]
      }
    }
  },
  {
    $group: {
      _id: null,
      withSubrolSuggestions: { $sum: { $cond: ['$hasSubrolSuggestions', 1, 0] } },
      withRolSuggestions: { $sum: { $cond: ['$hasRolSuggestions', 1, 0] } },
      total: { $sum: 1 }
    }
  }
]);
```

---

## Detalles Técnicos / Technical Details

### API Endpoints

#### GET `/api/suggestions/initial`

**Request:**
```http
GET /api/suggestions/initial HTTP/1.1
Authorization: Bearer <JWT_TOKEN>
```

**Response (Success - 200):**
```json
{
  "suggestions": [
    "¿Cómo establecer límites saludables con los NNA?",
    "Estrategias para manejar crisis emocionales",
    "¿Qué hacer ante conductas desafiantes?",
    "Técnicas de comunicación efectiva"
  ]
}
```

**Response (No suggestions - 200):**
```json
{
  "suggestions": []
}
```

**Response (Error - 500):**
```json
{
  "suggestions": []
}
```

**Autenticación:** Requerida (JWT)
**Rate Limiting:** Aplica el rate limiting general de la API
**Cache:** Los resultados se cachean en el cliente con React Query

---

#### POST `/api/suggestions/follow-up`

**Request:**
```http
POST /api/suggestions/follow-up HTTP/1.1
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "conversationId": "8862585a-6f85-45d0-9e5a-7273884f4997"
}
```

**Response (Success - 200):**
```json
{
  "suggestions": [
    "¿Puedes darme ejemplos prácticos?",
    "¿Y si el niño no responde a esto?",
    "¿Cómo lo aplico en mi turno de noche?"
  ]
}
```

**Response (Conversation not found - 404):**
```json
{
  "error": "Conversation not found",
  "suggestions": []
}
```

**Response (Invalid request - 400):**
```json
{
  "error": "conversationId is required",
  "suggestions": []
}
```

**Response (Google API error - 500):**
```json
{
  "suggestions": []
}
```

**Autenticación:** Requerida (JWT)
**Validación:** Verifica que el usuario sea dueño de la conversación
**Rate Limiting:** Aplica el rate limiting general de la API

---

### LLM Prompt para Follow-up Suggestions

**Contexto enviado al modelo:**
```
Usuario: ¿Cómo puedo manejar una crisis emocional con un NNA?
Asistente: Para manejar una crisis emocional con un niño, niña o adolescente (NNA), es fundamental...
Usuario: ¿Puedes darme un ejemplo concreto?
Asistente: Claro, un ejemplo concreto sería...
```

**Prompt completo:**
```
You are an expert AI designed to generate conversational suggestions. Your task is to act as a guide for users interacting with AVI, the "Asistente Virtual en Infancia".

**AVI's Core Purpose:**
AVI is an AI assistant supporting professionals (caregivers, educators, psychologists) in residential care settings for children and adolescents who have experienced severe trauma and rights violations. AVI provides practical, empathetic, actionable, and rights-based guidance. It is a supportive, non-clinical tool for daily challenges and crisis management.

**User Profile:**
The user is a professional working in a high-stress environment who values practical, direct, and supportive advice to better care for the children.

**Your Task:**
Based on the last turn of the conversation provided below, generate 3 brief, proactive, and relevant chat suggestions to help the user continue the conversation in a useful direction. The suggestions should prompt the user to ask for practical steps, explore related concepts, or request specific examples.

**Conversation Context:**

    Usuario: ¿Cómo puedo manejar una crisis emocional con un NNA?
    Asistente: Para manejar una crisis emocional...
    Usuario: ¿Puedes darme un ejemplo concreto?
    Asistente: Claro, un ejemplo concreto sería...

**Strict Rules:**
1. The suggestions must be in the same language as the user's last message in the context.
2. Each suggestion must be a maximum of 70 characters.
3. Your response MUST be ONLY a JSON array of strings, without any other text, explanation, or markdown.

**Example Output Format:**
["Sugerencia de ejemplo 1", "Sugerencia de ejemplo 2", "¿Y si pasa esto otro?"]
```

**Respuesta esperada del LLM:**
```json
["¿Puedes darme más ejemplos?", "¿Qué hago si esto no funciona?", "¿Cómo lo adapto a niños pequeños?"]
```

---

### Seguridad / Security

#### Autenticación
- Ambos endpoints requieren JWT válido (`requireJwtAuth` middleware)
- El token JWT se extrae del header `Authorization: Bearer <token>`
- El userId se obtiene de `req.user.id`

#### Autorización
- `/api/suggestions/follow-up` verifica que el usuario sea dueño de la conversación:
```javascript
const conversation = await Conversation.findOne({
  conversationId,
  user: userId
}).lean();

if (!conversation) {
  return res.status(404).json({ error: 'Conversation not found' });
}
```

#### Validación de Entrada
- `conversationId` es requerido en POST `/follow-up`
- Se valida el formato de los arrays de sugerencias (máx. 4 strings)
- Se sanitizan las respuestas del LLM antes de parsear JSON

#### Manejo de Errores
- Todos los errores se logean con `logger.error()`
- Los errores se retornan como arrays vacíos para no romper la UI
- No se expone información sensible en los mensajes de error

---

### Rendimiento / Performance

#### Caching Frontend
```typescript
// InitialSuggestions.tsx
const { data: suggestionData } = useQuery(
  ['initialSuggestions'],
  () => dataService.getInitialSuggestions(),
  {
    enabled: show,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    retry: 1,
  }
);

// FollowUpSuggestions.tsx
const { data: suggestionData } = useQuery(
  ['followUpSuggestions', messageId],
  () => dataService.getFollowUpSuggestions({ conversationId }),
  {
    enabled: shouldFetch && isLatestAssistantMessage,
    staleTime: Infinity, // No refetch - contextuales al mensaje
    retry: 1,
  }
);
```

#### Optimizaciones
1. **Delay de 200ms** antes de fetch de follow-up (evita bloquear render del mensaje)
2. **Límite de mensajes**: Solo últimos 6 mensajes para contexto (reduce tokens LLM)
3. **Modelo rápido**: `gemini-1.5-flash` (baja latencia, bajo costo)
4. **Cache infinito**: Follow-up suggestions no se refetchean (son específicas al mensaje)
5. **Lazy loading**: Sugerencias solo se cargan cuando son visibles

#### Costos Estimados (Google Gemini Flash)

**Costos por request de follow-up:**
- Input tokens: ~500 tokens (6 mensajes promedio)
- Output tokens: ~50 tokens (3 sugerencias cortas)
- Costo total: ~$0.0001 USD por request

**Volumen esperado:**
- 1000 usuarios activos/mes
- 10 conversaciones/usuario/mes promedio
- 5 mensajes asistente/conversación promedio
- **Total requests/mes:** 1000 × 10 × 5 = 50,000 requests
- **Costo mensual estimado:** $5 USD

---

## Solución de Problemas / Troubleshooting

### Problema 1: No aparecen sugerencias iniciales

**Síntomas:**
- El área de sugerencias no se muestra al enfocar el input

**Posibles causas y soluciones:**

1. **Configuración deshabilitada**
   ```yaml
   # librechat.yaml - Verificar que esté habilitado
   conversationSuggestions:
     enabled: true  # Debe ser true
   ```

2. **No hay sugerencias configuradas**
   ```javascript
   // Verificar en MongoDB
   db.aviRol.findOne({ name: "TuRol" }, { initial_suggestions: 1 });
   db.aviSubrol.findOne({ name: "TuSubrol" }, { initial_suggestions: 1 });

   // Verificar librechat.yaml
   conversationSuggestions:
     defaultInitialSuggestions:
       - "Al menos una sugerencia aquí"
   ```

3. **Error de validación en librechat.yaml**
   ```bash
   # Ver logs del backend
   npm run backend:dev
   # Buscar: "Invalid custom config file" o "ZodError"
   ```

4. **La conversación ya tiene mensajes**
   - Las sugerencias iniciales solo aparecen en conversaciones vacías
   - Verificar condición: `conversation?.messages?.length === 0`

**Debugging:**
```javascript
// Abrir consola del navegador (F12)
// Buscar logs:
[InitialSuggestions] Component rendered: { ... }
[InitialSuggestions] Query success: { suggestions: [...] }
```

---

### Problema 2: No aparecen sugerencias de seguimiento

**Síntomas:**
- El asistente responde pero no aparecen sugerencias debajo

**Posibles causas y soluciones:**

1. **Google API Key no configurada**
   ```bash
   # .env
   GOOGLE_API_KEY=tu_clave_aqui
   # o
   GOOGLE_KEY=tu_clave_aqui

   # Reiniciar el backend
   npm run backend:dev
   ```

2. **API Key inválida o sin permisos**
   ```bash
   # Ver logs del backend
   # Buscar: "Google API key not configured" o errores de Google
   ```

3. **Conversación no tiene ID**
   ```javascript
   // Consola del navegador
   // Buscar logs:
   [ContentRender] FollowUpSuggestions conditions: {
     conversationId: undefined,  // ← Problema si es undefined
     shouldRenderFollowUp: false
   }
   ```

4. **El componente no se está renderizando**
   ```javascript
   // Verificar en consola:
   [ContentRender] FollowUpSuggestions conditions: {
     isCreatedByUser: false,  // ✓ Debe ser false para asistente
     isLast: true,            // ✓ Debe ser true
     isSubmitting: false,     // ✓ Debe ser false
     shouldRenderFollowUp: true  // ✓ Debe ser true
   }
   ```

**Debugging avanzado:**
```javascript
// Ver request en Network tab (F12)
// POST /api/suggestions/follow-up
// Response: { suggestions: [...] }

// Ver logs en backend:
npm run backend:dev
// Buscar: [Follow-up Suggestions]
```

---

### Problema 3: Sugerencias en idioma incorrecto

**Síntomas:**
- Las sugerencias de seguimiento están en inglés cuando deberían estar en español

**Causa:**
- El prompt del LLM depende del idioma del último mensaje del usuario

**Solución:**
- Asegurarse de que el último mensaje del usuario esté en español
- Verificar que el contexto de conversación se esté enviando correctamente

**Debug:**
```javascript
// Ver en logs del backend el contexto enviado al LLM:
[Follow-up Suggestions] Conversation context:
Usuario: ¿Cómo manejo esto?  // ← Español detectado
Asistente: Para manejar...
```

---

### Problema 4: Error "Conversation not found"

**Síntomas:**
```json
{
  "error": "Conversation not found",
  "suggestions": []
}
```

**Causa:**
- El `conversationId` enviado no existe o no pertenece al usuario

**Solución:**
```javascript
// Verificar en MongoDB
db.conversations.findOne({
  conversationId: "tu-conversation-id",
  user: "tu-user-id"
});

// Si retorna null, la conversación no existe o no es del usuario
```

---

### Problema 5: Sugerencias vacías constantemente

**Síntomas:**
- `{ suggestions: [] }` siempre

**Posibles causas:**

1. **Mensajes sin texto**
   ```javascript
   // Ver en MongoDB
   db.messages.find({ conversationId: "..." }, { text: 1, isCreatedByUser: 1 });
   // Si text es null o vacío, no hay contexto
   ```

2. **Google API quota excedida**
   ```bash
   # Ver logs del backend
   # Buscar: "quota exceeded" o "rate limit"
   ```

3. **LLM retorna formato incorrecto**
   ```bash
   # Ver logs del backend
   [Follow-up Suggestions] Error parsing JSON suggestions
   [Follow-up Suggestions] Raw text: <respuesta del LLM>
   ```

**Solución:**
- Verificar que hay mensajes con texto en la conversación
- Revisar cuota de Google API en [Google Cloud Console](https://console.cloud.google.com)
- Ajustar el prompt si el LLM no retorna JSON válido

---

### Logs Útiles

**Backend:**
```bash
# Habilitar logs de debug
LOG_LEVEL=debug npm run backend:dev

# Buscar en logs:
[Initial Suggestions] User not found
[Initial Suggestions] Using aviSubrol suggestions
[Follow-up Suggestions] No messages found
[Follow-up Suggestions] Google API key not configured
[Follow-up Suggestions] Error calling LLM
```

**Frontend (Consola del navegador):**
```javascript
// Logs de InitialSuggestions
[InitialSuggestions] Component rendered: { ... }
[InitialSuggestions] useEffect triggered: { ... }
[InitialSuggestions] Fetching suggestions for: ...
[InitialSuggestions] Query success: { ... }

// Logs de FollowUpSuggestions
[FollowUpSuggestions] Component rendered: { ... }
[FollowUpSuggestions] Setting shouldFetch to true
[FollowUpSuggestions] Fetching suggestions for: ...
[FollowUpSuggestions] Query success: { ... }

// Logs de ContentRender
[ContentRender] FollowUpSuggestions conditions: { ... }
```

---

## Archivos Modificados / Modified Files

### Archivos Backend Modificados (17 archivos)

1. **`api/server/index.js`**
   - Registró ruta `/api/suggestions`

2. **`api/server/routes/config.js`**
   - Agregó `conversationSuggestions` al payload de configuración

3. **`api/server/routes/index.js`**
   - Exportó módulo `suggestions`

4. **`api/server/services/AppService.js`**
   - Agregó `conversationSuggestions` al config cacheado

5-6. **`packages/data-schemas/src/schema/aviRol.ts` y `aviSubrol.ts`**
   - Agregó campo `initial_suggestions: [String]` con validación (máx. 4)

7-8. **`packages/data-schemas/src/types/aviRol.ts` y `aviSubrol.ts`**
   - Agregó tipos TypeScript `initial_suggestions?: string[]`

9-10. **`packages/data-provider/src/types/aviRoles.ts`**
   - Actualizó tipos `TAviRol` y `TAviSubrol` con `initial_suggestions`

11. **`packages/data-provider/src/api-endpoints.ts`**
   - Agregó endpoints `initialSuggestions()` y `followUpSuggestions()`

12. **`packages/data-provider/src/data-service.ts`**
   - Agregó funciones `getInitialSuggestions()` y `getFollowUpSuggestions()`

13. **`packages/data-provider/src/config.ts`**
   - Agregó Zod schema `conversationSuggestionsSchema`
   - Integró en `configSchema`

14-15. **`docker-compose.yml` y `deploy-compose.yml`**
   - Ajustes menores de configuración (no relacionados directamente)

16. **`client/src/components/Chat/Input/ChatForm.tsx`**
   - Agregó lógica `showInitialSuggestions`
   - Integró componente `<InitialSuggestions />`

17. **`client/src/components/Chat/Messages/ui/MessageRender.tsx`**
   - Agregó lógica de renderizado condicional
   - Integró `<FollowUpSuggestions />` (con logs de debug)

18. **`client/src/components/Messages/ContentRender.tsx`**
   - **Este es el archivo clave** donde se renderan los mensajes del asistente
   - Integró `<FollowUpSuggestions />` correctamente (línea 210-234)

### Archivos Backend Nuevos (3 archivos)

1. **`api/server/routes/suggestions.js`** (100 líneas)
   - Rutas GET `/initial` y POST `/follow-up`
   - Lógica de fallback para sugerencias iniciales
   - Validación de ownership de conversaciones

2. **`api/server/services/Suggestions/generateFollowUp.js`** (153 líneas)
   - Función `generateFollowUpSuggestions()`
   - Integración con Google Gemini Flash
   - Parsing de JSON responses

3. **`config/.temp-migrate-avi-roles.js`**
   - Script temporal (no relacionado)

### Archivos Frontend Nuevos (2 archivos)

1. **`client/src/components/Chat/Input/InitialSuggestions.tsx`** (~63 líneas)
   - Componente para sugerencias iniciales
   - React Query hook con cache
   - UI en grid 2x2 con animaciones

2. **`client/src/components/Chat/Messages/FollowUpSuggestions.tsx`** (~76 líneas)
   - Componente para sugerencias de seguimiento
   - Delay de 200ms antes de fetch
   - Manejo de estados de carga

### Archivos de Configuración

1. **`librechat.yaml`** (ya existente, modificado por el usuario)
   - Agregada sección `conversationSuggestions`

2. **`.env`** (ya existente, modificado por el usuario)
   - Agregada variable `GOOGLE_API_KEY`

---

## Mejoras Futuras / Future Enhancements

### 1. Soporte Multi-Proveedor LLM

**Descripción:**
Permitir usar otros proveedores además de Google Gemini (OpenAI, Anthropic, etc.)

**Configuración propuesta:**
```yaml
conversationSuggestions:
  enabled: true
  provider: "google"  # "openai" | "anthropic" | "google"
  model: "gemini-1.5-flash"
  apiKey: "${GOOGLE_API_KEY}"
```

**Beneficios:**
- Mayor flexibilidad para usuarios con diferentes APIs
- Posibilidad de usar modelos locales (Ollama)
- Reducción de dependencia en un solo proveedor

---

### 2. Admin UI para Gestión de Sugerencias

**Descripción:**
Interfaz gráfica para que administradores puedan editar sugerencias sin usar MongoDB

**Funcionalidades:**
- CRUD de sugerencias por rol/subrol
- Preview en tiempo real
- Validación de caracteres (máx. 70)
- Importar/exportar configuraciones

**Mockup:**
```
╔════════════════════════════════════════╗
║ Gestión de Sugerencias                 ║
╠════════════════════════════════════════╣
║ Rol: [Cuidador ▼]                      ║
║ Subrol: [Cuidador Principal ▼]         ║
║                                        ║
║ Sugerencias Iniciales:                 ║
║ ┌────────────────────────────────────┐ ║
║ │ 1. [Editar] [Eliminar]             │ ║
║ │    ¿Cómo manejar crisis?           │ ║
║ ├────────────────────────────────────┤ ║
║ │ 2. [Editar] [Eliminar]             │ ║
║ │    Técnicas de contención          │ ║
║ └────────────────────────────────────┘ ║
║                                        ║
║ [+ Agregar Sugerencia]  [Guardar]     ║
╚════════════════════════════════════════╝
```

---

### 3. Analytics de Uso

**Descripción:**
Tracking de qué sugerencias son más usadas para optimizar el contenido

**Métricas a trackear:**
- Click-through rate por sugerencia
- Sugerencias más populares por rol
- Tiempo promedio para usar una sugerencia
- A/B testing de diferentes sugerencias

**Schema propuesto:**
```javascript
// Nueva colección: suggestionAnalytics
{
  userId: ObjectId,
  roleId: ObjectId,
  subrolId: ObjectId,
  suggestionText: String,
  type: "initial" | "followup",
  clicked: Boolean,
  conversationId: String,
  timestamp: Date
}
```

**Dashboard:**
```
Top 5 Sugerencias Más Usadas (Cuidadores):
1. ¿Cómo manejar crisis? (234 clicks)
2. Técnicas de contención (189 clicks)
3. Estrategias de autocuidado (156 clicks)
4. Trabajo en equipo (142 clicks)
5. Rutinas efectivas (128 clicks)
```

---

### 4. Caching de Follow-up Suggestions

**Descripción:**
Cachear sugerencias generadas para reducir costos de API

**Estrategia:**
```javascript
// Generar hash del contexto de conversación
const contextHash = crypto
  .createHash('sha256')
  .update(conversationContext)
  .digest('hex');

// Buscar en Redis
const cached = await redis.get(`suggestions:${contextHash}`);
if (cached) {
  return JSON.parse(cached);
}

// Si no está en cache, generar y guardar
const suggestions = await callLLMForSuggestions(...);
await redis.setex(`suggestions:${contextHash}`, 3600, JSON.stringify(suggestions));
return suggestions;
```

**Beneficios:**
- Reducción de costos de API (~70% con cache efectivo)
- Respuestas más rápidas
- Menor dependencia de disponibilidad de Google API

---

### 5. Sugerencias Adaptativas (Machine Learning)

**Descripción:**
Aprender de las interacciones del usuario para personalizar sugerencias

**Implementación:**
1. Trackear qué sugerencias ignora el usuario
2. Qué preguntas hace frecuentemente
3. Patrones de conversación preferidos
4. Usar un modelo ML simple (Naive Bayes, Logistic Regression) para rankear sugerencias

**Ejemplo:**
```javascript
// Usuario "Juan" frecuentemente pregunta sobre crisis
// El sistema aprende y prioriza sugerencias relacionadas:

// Antes (genéricas):
["¿Cómo establecer rutinas?", "Técnicas de contención", ...]

// Después (personalizadas para Juan):
["¿Cómo prevenir crisis?", "Protocolo en situaciones de emergencia", ...]
```

---

### 6. Sugerencias Multimodales

**Descripción:**
Incluir imágenes, videos o documentos en las sugerencias

**Mockup:**
```
╔══════════════════════════════════════╗
║ Sugerencias                          ║
╠══════════════════════════════════════╣
║ ┌──────────────────────────────────┐ ║
║ │ 📄 Protocolo de Crisis           │ ║
║ │    Ver documento completo        │ ║
║ └──────────────────────────────────┘ ║
║ ┌──────────────────────────────────┐ ║
║ │ 🎥 Video: Técnicas de Contención │ ║
║ │    Ver video (3:45)              │ ║
║ └──────────────────────────────────┘ ║
╚══════════════════════════════════════╝
```

**Schema:**
```javascript
{
  text: "Protocolo de Crisis",
  type: "document",
  resourceUrl: "/docs/protocolo-crisis.pdf",
  icon: "📄"
}
```

---

### 7. Sugerencias por Contexto Temporal

**Descripción:**
Adaptar sugerencias según hora del día, día de la semana, etc.

**Ejemplos:**

**Lunes por la mañana:**
- "Planificación de la semana"
- "Coordinación de turnos"
- "Revisión de casos pendientes"

**Viernes por la tarde:**
- "Cierre de semana efectivo"
- "Handover entre equipos"
- "Autocuidado para el fin de semana"

**Turno de noche:**
- "Manejo de crisis nocturnas"
- "Rutinas de sueño para NNA"
- "Coordinación con turno día"

---

### 8. Integración con Knowledge Base

**Descripción:**
Vincular sugerencias con artículos, guías o recursos específicos

**Implementación:**
```javascript
{
  suggestion: "¿Cómo manejar crisis emocionales?",
  relatedResources: [
    {
      title: "Guía: Intervención en Crisis",
      url: "/knowledge/crisis-intervention",
      type: "article"
    },
    {
      title: "Video: Técnicas de Contención",
      url: "/resources/containment-video",
      type: "video"
    }
  ]
}
```

**UI:**
```
┌────────────────────────────────────────┐
│ ¿Cómo manejar crisis emocionales?  📚 │
│                                        │
│ Al hacer clic, también verás:         │
│ • Guía: Intervención en Crisis         │
│ • Video: Técnicas de Contención        │
└────────────────────────────────────────┘
```

---

## Conclusión / Conclusion

La funcionalidad de **Conversation Suggestions** mejora significativamente la experiencia de usuario en LibreChat-AVI al:

✅ **Facilitar el inicio de conversaciones** con sugerencias basadas en roles
✅ **Guiar interacciones contextuales** con IA generativa
✅ **Personalizar la experiencia** según aviRol y aviSubrol
✅ **Mantener fluidez profesional** con UI tipo Perplexity
✅ **Reducir fricción** en la interacción con AVI

**Impacto esperado:**
- Mayor engagement de usuarios
- Conversaciones más productivas
- Mejor aprovechamiento de las capacidades de AVI
- Reducción de tiempo para obtener respuestas útiles

---

## Referencias / References

- **Código fuente:** [LibreChat-AVI GitHub](https://github.com/TuRepo/LibreChat-AVI)
- **Documentación AVI Roles:** `Docs_AVI/AVI_ROLES_DOCUMENTATION.md`
- **Google Gemini API:** https://ai.google.dev/
- **React Query:** https://tanstack.com/query/latest
- **LibreChat Docs:** https://docs.librechat.ai

---

## Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2025 | Implementación inicial completa |

---

**Documento creado por:** Claude Code
**Última actualización:** 2025
**Mantenedor:** Equipo AVI - Corporación Crecer Mejor
