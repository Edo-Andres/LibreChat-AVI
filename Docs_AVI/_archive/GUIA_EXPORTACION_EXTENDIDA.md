# 📊 Exportación Extendida de Chats - Guía de Uso

## ✨ Nuevos Campos Exportados

### **16 Columnas Totales:**

| # | Campo | Descripción | Origen |
|---|-------|-------------|--------|
| 1 | userEmail | Email del usuario | User.email |
| 2 | userName | Nombre del usuario | User.name |
| 3 | **userPhone** | Teléfono | User.phone ⭐ NUEVO |
| 4 | **userAviRole** | Rol AVI | AviRol.name ⭐ NUEVO |
| 5 | **userAviSubrole** | Subrol AVI | AviSubrol.name ⭐ NUEVO |
| 6 | **userCreatedAt** | Fecha registro usuario | User.createdAt ⭐ NUEVO |
| 7 | conversationId | ID conversación | Conversation.conversationId |
| 8 | conversationTitle | Título conversación | Conversation.title |
| 9 | **conversationCreatedAt** | Inicio conversación | Conversation.createdAt ⭐ NUEVO |
| 10 | **conversationUpdatedAt** | Última actividad | Conversation.updatedAt ⭐ NUEVO |
| 11 | sender | Emisor mensaje | Message.sender |
| 12 | text | Contenido mensaje | Message.text |
| 13 | isCreatedByUser | Creado por usuario | Message.isCreatedByUser |
| 14 | messageId | ID mensaje | Message.messageId |
| 15 | messageCreatedAt | Fecha mensaje | Message.createdAt |
| 16 | **feedback** | Feedback usuario | Message.feedback ⭐ NUEVO |

---

## 🚀 Comandos de Uso

### **Opción 1: Exportación Completa + Subida a Google Sheets**

```bash
# Desde la carpeta api/
cd api
npm run sync-chats-extended
```

Este comando ejecuta:
1. Exporta a `api/chats_extended.csv`
2. Sube automáticamente a Google Sheets (hoja "Chats Extended")
3. Limpia el archivo temporal

### **Opción 2: Solo Exportar CSV (sin subir)**

```bash
cd api
npm run export-chats-extended
```

Genera: `api/chats_extended.csv`

### **Opción 3: Solo Subir a Google Sheets**

```bash
cd api
npm run upload-to-sheets-extended
```

Requiere que exista: `api/chats_extended.csv`

### **Opción 4: Desde Docker**

```bash
# Ejecutar desde el contenedor
docker exec -it librechat-avi-api-1 sh /app/scripts/sync-chats-extended.sh

# O directamente
docker exec -it librechat-avi-api-1 npm run sync-chats-extended --prefix /app/api
```

---

## 📋 Configuración de Google Sheets

### **Variables de Entorno (.env):**

```env
# ID del Google Sheet (requerido)
GOOGLE_SHEETS_ID=TU_SPREADSHEET_ID

# Opcional: Usar un Sheet diferente para datos extendidos
GOOGLE_SHEETS_EXTENDED_ID=TU_SPREADSHEET_ID_EXTENDIDO

# Credenciales de Google (requerido)
GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}
```

### **Nombre de la Hoja:**
- **Hoja destino:** `Chats Extended`
- Si no existe, se creará automáticamente

---

## 🔍 Verificar Datos en MongoDB

Antes de exportar, puedes verificar qué datos están disponibles:

```bash
docker exec -it chat-mongodb mongosh

# Dentro de mongosh:
use LibreChat

# Ver usuarios con AVI Roles
db.users.findOne({}, { email: 1, phone: 1, aviRol_id: 1, aviSubrol_id: 1, createdAt: 1 })

# Ver conversaciones con fechas
db.conversations.findOne({}, { conversationId: 1, title: 1, createdAt: 1, updatedAt: 1 })

# Ver mensajes con feedback
db.messages.findOne({ feedback: { $exists: true } }, { messageId: 1, feedback: 1 })

# Estadísticas
print("Usuarios con phone: " + db.users.countDocuments({ phone: { $exists: true, $ne: "" } }))
print("Usuarios con aviRol_id: " + db.users.countDocuments({ aviRol_id: { $exists: true } }))
print("Mensajes con feedback: " + db.messages.countDocuments({ feedback: { $exists: true } }))

exit
```

---

## 📊 Ejemplo de Salida

```csv
userEmail,userName,userPhone,userAviRole,userAviSubrole,userCreatedAt,conversationId,conversationTitle,conversationCreatedAt,conversationUpdatedAt,sender,text,isCreatedByUser,messageId,messageCreatedAt,feedback
echev.test@gmail.com,"Test",,Admin,Programador,2025-10-08T06:18:00.000Z,db088c18-051b-4906-aab3-edd1c4b8e756,"What Day Is It",2025-11-03T18:57:10.000Z,2026-01-14T04:17:48.000Z,User,"que dia es?",true,187d39d8-fd30-4938-8ca6-0ddc5490078c,2025-11-03T18:57:10.000Z,""
echev.test@gmail.com,"Test",,Admin,Programador,2025-10-08T06:18:00.000Z,db088c18-051b-4906-aab3-edd1c4b8e756,"What Day Is It",2025-11-03T18:57:10.000Z,2026-01-14T04:17:48.000Z,Assistant,"Hoy es 3 de noviembre de 2025.",false,6908fb12a60b606e762a7103,2025-11-03T18:57:22.000Z,""
```

---

## 🔧 Troubleshooting

### **Error: "Variable GOOGLE_CREDENTIALS_JSON no encontrada"**
- Verifica que `.env` tenga la variable `GOOGLE_CREDENTIALS_JSON`
- El contenido debe ser un JSON válido (sin saltos de línea adicionales)

### **Error: "Archivo no encontrado: chats_extended.csv"**
- Ejecuta primero: `npm run export-chats-extended`
- O usa el comando completo: `npm run sync-chats-extended`

### **Los campos aviRole/aviSubrole están vacíos**
- Verifica en MongoDB que los usuarios tengan `aviRol_id` y `aviSubrol_id`
- Ejecuta: `db.users.countDocuments({ aviRol_id: { $exists: true } })`

### **El campo phone está vacío**
- Normal si los usuarios no tienen teléfono registrado
- Verifica: `db.users.countDocuments({ phone: { $exists: true, $ne: "" } })`

---

## 📈 Casos de Uso

### **Análisis por Roles AVI:**
```sql
-- En Google Sheets o análisis de datos
SELECT userAviRole, COUNT(*) FROM chats_extended GROUP BY userAviRole
```

### **Análisis Temporal:**
```sql
-- Conversaciones por mes
SELECT DATE_TRUNC(conversationCreatedAt, 'MONTH'), COUNT(*) 
FROM chats_extended 
GROUP BY 1
```

### **Análisis de Feedback:**
```sql
-- Mensajes con feedback positivo
SELECT * FROM chats_extended WHERE feedback = 'thumbsUp'
```

### **Tiempo de Respuesta:**
```sql
-- Calcular duración de conversaciones
SELECT 
  conversationId,
  DATEDIFF(conversationUpdatedAt, conversationCreatedAt) AS dias_activo
FROM chats_extended
```

---

## 🆚 Comparación con Exportación Original

| Característica | Original | Extendido |
|----------------|----------|-----------|
| Columnas | 9 | 16 |
| AVI Roles | ❌ | ✅ |
| Fechas de Usuario | ❌ | ✅ |
| Fechas de Conversación | ❌ | ✅ |
| Teléfono | ❌ | ✅ |
| Feedback | ❌ | ✅ |
| Script | sync-chats.sh | sync-chats-extended.sh |
| Hoja Google | Hoja 1 | Chats Extended |

---

## 📝 Notas

- La exportación usa la zona horaria configurada en `TZ` (default: America/Santiago)
- Los campos vacíos se exportan como strings vacíos en CSV
- El feedback se serializa como: `rating|tag|text`
- Los nombres de AviRoles se obtienen mediante `populate` de MongoDB

---

## 🎯 Próximos Pasos

1. Ejecutar primera exportación de prueba
2. Verificar datos en Google Sheets
3. Crear análisis/dashboards con los nuevos campos
4. Automatizar con cron jobs si es necesario

---

Para más información, consulta:
- [config/export-all-chats-extended.js](../config/export-all-chats-extended.js)
- [config/upload-to-sheets-extended.js](../config/upload-to-sheets-extended.js)
- [scripts/sync-chats-extended.sh](../scripts/sync-chats-extended.sh)
