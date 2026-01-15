const { logger } = require('@librechat/data-schemas');
const { getMessages } = require('~/models');
const { getAppConfig } = require('~/server/services/Config/app');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Generate follow-up conversation suggestions based on recent message history
 * @param {string} conversationId - The conversation ID
 * @param {string} userId - The user ID
 * @param {number} messageCount - Number of recent messages to consider (default: 6)
 * @returns {Promise<string[]>} Array of 4 suggestion strings
 */
async function generateFollowUpSuggestions(conversationId, userId, messageCount = 6) {
  try {
    // 1. Fetch recent messages from conversation
    const messages = await getMessages({ conversationId, user: userId });

    logger.info('=== [Follow-up Suggestions] DEBUG START ===');
    logger.info(`[Follow-up Suggestions] Total messages found: ${messages?.length || 0}`);
    logger.info(`[Follow-up Suggestions] ConversationId: ${conversationId}`);
    logger.info(`[Follow-up Suggestions] UserId: ${userId}`);

    if (!messages || messages.length === 0) {
      logger.debug('[Follow-up Suggestions] No messages found');
      return [];
    }

    // Get last N messages
    const recentMessages = messages.slice(-messageCount);
    
    logger.info(`[Follow-up Suggestions] Recent messages (last ${messageCount}):`);
    recentMessages.forEach((msg, index) => {
      const hasText = !!msg.text;
      const hasContent = msg.content && Array.isArray(msg.content) && msg.content.length > 0;
      const contentTypes = hasContent ? msg.content.map(c => c.type).join(', ') : 'none';
      
      logger.info(`  [${index}] isCreatedByUser: ${msg.isCreatedByUser}, sender: ${msg.sender}`);
      logger.info(`        hasText: ${hasText}, hasContent: ${hasContent}, contentTypes: [${contentTypes}]`);
      
      if (hasText) {
        logger.info(`        textPreview: "${msg.text?.substring(0, 80)}..."`);
      } else if (hasContent) {
        const textContent = msg.content.find(c => c.type === 'text');
        if (textContent?.text) {
          logger.info(`        contentTextPreview: "${textContent.text.substring(0, 80)}..."`);
        }
      }
    });

    // 2. Format messages for LLM context
    const conversationContext = recentMessages
      .map((msg) => {
        const role = msg.isCreatedByUser ? 'Usuario' : 'Asistente';
        
        // Extract text content - prioritize msg.text, but fall back to content array
        let messageText = msg.text || '';
        
        // If text is empty but content array exists (for agents/assistants)
        if (!messageText && msg.content && Array.isArray(msg.content)) {
          // Extract text from content array (filter out 'think' type, keep 'text' type)
          const textParts = msg.content
            .filter(part => part.type === 'text' && part.text)
            .map(part => part.text);
          
          messageText = textParts.join('\n');
        }
        
        return `${role}: ${messageText}`;
      })
      .join('\n');
    
    logger.info('[Follow-up Suggestions] Formatted conversation context:');
    logger.info('--- CONTEXT START ---');
    logger.info(conversationContext);
    logger.info('--- CONTEXT END ---');

    if (!conversationContext.trim()) {
      logger.debug('[Follow-up Suggestions] No valid conversation context');
      return [];
    }

    // 3. Get config for fast model
    const config = await getAppConfig();
    const fastModel = config?.conversationSuggestions?.fastModel || 'gemini-1.5-flash';

    // Check if conversationSuggestions is enabled
    if (config?.conversationSuggestions?.enabled === false) {
      logger.debug('[Follow-up Suggestions] Feature disabled in config');
      return [];
    }

    // 4. Call LLM to generate suggestions
    const suggestions = await callLLMForSuggestions(conversationContext, fastModel);
    
    logger.info(`[Follow-up Suggestions] Generated ${suggestions.length} suggestions`);
    logger.info('[Follow-up Suggestions] Suggestions:', JSON.stringify(suggestions));
    logger.info('=== [Follow-up Suggestions] DEBUG END ===');

    return suggestions;
  } catch (error) {
    logger.error('[Follow-up Suggestions] Error generating suggestions:', error);
    return [];
  }
}

/**
 * Call LLM to generate suggestions based on conversation context
 * @param {string} conversationContext - Formatted conversation history
 * @param {string} model - Model to use (e.g., 'gemini-1.5-flash')
 * @returns {Promise<string[]>} Array of suggestions
 */
async function callLLMForSuggestions(conversationContext, model) {
  try {
    // Check if Google API key is available
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_KEY;

    if (!apiKey) {
      logger.warn('[Follow-up Suggestions] Google API key not configured, returning empty suggestions');
      return [];
    }

    // Initialize Google Generative AI
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });

    // Create prompt for suggestion generation
    // IMPROVED PROMPT: Comprehensive UX Writing and Child Psychology prompt for dynamic Quick Replies
    const prompt = `Eres un experto en Diseño Conversacional y UX Writing enfocado en el contexto de AVI (Asistente Virtual en Infancia).

**TU OBJETIVO:**
Analizar el historial de conversación y generar EXACTAMENTE 3 opciones de "Quick Reply" que el USUARIO podría pulsar para continuar el diálogo, profundizar en el tema o explorar nuevas áreas relacionadas.

**CONTEXTO DE AVI:**
AVI apoya a equipos residenciales y cuidadores en la prevención y cuidado especializado de niños, niñas y adolescentes (NNA). Sus temas clave son: Cuidado y Bienestar, Fortalecimiento Familiar, y Gestión de Equipos.

**REGLAS DE ORO (PERSPECTIVA DE USUARIO):**
1. **Voz del Usuario:** Las sugerencias DEBEN estar en primera persona (ej: "Necesito...", "¿Qué hago si...?", "Dame ejemplos").
2. **Prohibido Cerrar:** NUNCA generes respuestas de cierre como "Gracias", "Entendido" o "Ok". El objetivo es EXTENDER la conversación.
3. **Rol Correcto:** NUNCA escribas frases que diría el asistente (ej: "¿En qué te ayudo?", "¿Quieres saber más?").
4. **Variedad:** Cubre distintos ángulos: Práctico (ejemplos), Técnico (profundización) o Situacional (qué hacer en caso X).

**EJEMPLOS DE REFERENCIA:**

 MALOS (EVITAR):
- "Excelente respuesta, gracias" (Cierra el chat)
- "¿Necesitas más detalles?" (Habla el asistente, no el usuario)
- "Ok, entendido" (Sin valor)

BUENOS (IMITAR):
- "¿Podrías explicarlo en palabras más simples?"
- "¿Qué hago si el niño me pega durante la crisis?"
- "Dame un ejemplo de rutina nocturna segura"
- "¿Cómo documento la revelación correctamente?"
- "¿Cuáles son las señales de burnout en el equipo?"

**ESPECIFICACIONES TÉCNICAS:**
- **Cantidad:** 3 sugerencias exactas.
- **Longitud:** 5 a 12 palabras por sugerencia (concisión para botones).
- **Idioma:** EXACTAMENTE el mismo idioma del último mensaje del usuario.
- **Formato:** ÚNICAMENTE un JSON array de strings.

**HISTORIAL DE CONVERSACIÓN ACTUAL:**
${'    ' + conversationContext.replaceAll('\n', '\n    ')}

Genera el JSON array con las 3 sugerencias:`;

    // Generate content
    const result = await genModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    const suggestions = parseJSONSuggestions(text);

    return suggestions.slice(0, 4); // Ensure exactly 3 suggestions
  } catch (error) {
    logger.error('[Follow-up Suggestions] Error calling LLM:', error);
    return [];
  }
}

/**
 * Parse JSON suggestions from LLM response
 * @param {string} text - Raw LLM response
 * @returns {string[]} Parsed suggestions array
 */
function parseJSONSuggestions(text) {
  try {
    // Remove markdown code blocks if present
    let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // Try to find JSON array in the text
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter(s => typeof s === 'string' && s.trim().length > 0);
    }

    logger.warn('[Follow-up Suggestions] Parsed response is not a valid array');
    return [];
  } catch (error) {
    logger.error('[Follow-up Suggestions] Error parsing JSON suggestions:', error);
    logger.debug('[Follow-up Suggestions] Raw text:', text);
    return [];
  }
}

module.exports = {
  generateFollowUpSuggestions,
};
