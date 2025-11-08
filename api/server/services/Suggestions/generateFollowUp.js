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
    const prompt = `You are an expert AI designed to generate conversational suggestions. Your task is to act as a guide for users interacting with AVI, the "Asistente Virtual en Infancia".

**AVI's Core Purpose:**
AVI is an AI assistant supporting professionals (caregivers, educators, psychologists) in residential care settings for children and adolescents who have experienced severe trauma and rights violations. AVI provides practical, empathetic, actionable, and rights-based guidance. It is a supportive, non-clinical tool for daily challenges and crisis management.

**User Profile:**
The user is a professional working in a high-stress environment who values practical, direct, and supportive advice to better care for the children.

**Your Task:**
Based on the last turn of the conversation provided below, generate 3 brief, proactive, and relevant chat suggestions to help the user continue the conversation in a useful direction. The suggestions should prompt the user to ask for practical steps, explore related concepts, or request specific examples.

**Conversation Context:**

${'    ' + conversationContext.replaceAll('\n', '\n    ')}


**Strict Rules:**
1.  The suggestions must be in the same language as the user's last message in the context.
2.  Each suggestion must be a maximum of 70 characters.
3.  Your response MUST be ONLY a JSON array of strings, without any other text, explanation, or markdown.

**Example Output Format:**
["Sugerencia de ejemplo 1", "Sugerencia de ejemplo 2", "¿Y si pasa esto otro?"]`;

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
