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
    // IMPROVED PROMPT: Generates suggestions as QUESTIONS THE USER WOULD ASK (not questions the agent would ask)
    const prompt = `Eres un asistente experto que genera sugerencias para que el usuario continúe conversando con AVI sobre cuidado infantil y desarrollo emocional.

**Tu Tarea:**
Analizar el contexto de la conversación y generar EXACTAMENTE 3 preguntas que UN USUARIO podría hacer para profundizar, hacer seguimiento o explorar temas relacionados derivados de la última respuesta.

**Reglas ESTRICTAS:**
1. Cada sugerencia es una PREGUNTA que el usuario escribiría (no una pregunta que haría el agente para obtener contexto).
2. Forma: Interrogativa directa (¿Cómo...?, ¿Qué...?, ¿Por qué...?, etc.) o iniciada por verbo si es apropiado.
3. Longitud: EXACTAMENTE entre 6 y 12 palabras (sin contar signos de puntuación).
4. Idioma: EXACTAMENTE el mismo idioma del último mensaje del USUARIO.
5. Contenido: Preguntas PRÁCTICAS y DERIVADAS del contexto, no genéricas.

**Contexto de la conversación:**

${'    ' + conversationContext.replaceAll('\n', '\n    ')}

**Ejemplos de salida VÁLIDA** (preguntas que el usuario haría):
["¿Cómo manejar una rabieta emocional?", "¿Qué estrategias mejoran la concentración?", "¿Por qué los niños tienen miedos?"]

**IMPORTANTE:**
- Responde SOLO con el JSON array, sin texto adicional ni explicaciones.
- NO generes preguntas que el agente haría (como "¿Qué edad tiene?" o "¿Cuánto tiempo lleva así?").
- Cada pregunta debe ser algo que el usuario escribiría para profundizar en el tema.`;

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
