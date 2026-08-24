const { z } = require('zod');
const { Tool } = require('@langchain/core/tools');
const { logger } = require('@librechat/data-schemas');
const {
  searchUserMessages,
} = require('~/server/services/ConversationSearch/searchUserMessages');

/**
 * Búsqueda en el historial de conversaciones del propio usuario.
 *
 * Complementa a la memoria de usuario (`memory:` en librechat.yaml): esa guarda hechos curados
 * bajo claves fijas, mientras que esta recupera lo que se dijo literalmente en chats anteriores.
 *
 * Debe extender `Tool` (no `StructuredTool`): el escáner de arranque
 * (`api/server/services/start/tools.js`) filtra con `ToolClass.prototype instanceof Tool` y
 * descartaría la clase en silencio.
 */
class ConversationSearch extends Tool {
  name = 'conversation_search';

  description =
    'Busca en el historial de conversaciones anteriores DEL PROPIO USUARIO para recuperar ' +
    'información que él te contó antes: nombres, rutinas, citas médicas, acuerdos, avances o ' +
    'preferencias del niño, niña o adolescente a su cargo. ' +
    'Úsala SOLO cuando el usuario haga referencia a algo dicho en otro momento ' +
    '("lo que te conté", "la semana pasada", "¿recuerdas que...?", "el nombre que te dije") ' +
    'o cuando necesites un dato personal suyo que no aparece en la conversación actual. ' +
    'NO la uses para conocimiento general ni para información que ya está en esta conversación. ' +
    'Si no encuentras nada, dilo con naturalidad y pregúntale al usuario.';

  schema = z.object({
    query: z
      .string()
      .min(2)
      .describe(
        'Palabras clave de lo que se busca, en español y sin frases largas. ' +
          'Ej: "citas médicas Juan", "alergia maní", "rutina de sueño".',
      ),
    days_back: z
      .number()
      .int()
      .min(1)
      .max(365)
      .optional()
      .describe(
        'Opcional. Limita la búsqueda a los últimos N días. Usa 7 para "la semana pasada" y 30 ' +
          'para "el mes pasado". Omítelo si no hay ninguna pista temporal.',
      ),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe('Opcional. Número máximo de conversaciones a devolver. Por defecto 5.'),
  });

  /**
   * El constructor debe ser puro: `loadAndFormatTools` instancia la clase al arrancar con
   * `{ override: true }` solo para leer `name`, `description` y `schema`, y una excepción aquí
   * eliminaría la tool del catálogo sin dejar rastro visible.
   *
   * @param {object} [fields]
   * @param {string} [fields.userId] - inyectado por el servidor, nunca por el modelo
   * @param {import('express').Request} [fields.req]
   * @param {object} [fields.conversationSearchConfig] - bloque `conversationSearch` del yaml
   */
  constructor(fields = {}) {
    super(fields);
    this.override = fields.override ?? false;
    this.userId = fields.userId;
    this.req = fields.req;
    this.config = fields.conversationSearchConfig ?? {};
  }

  /**
   * @param {{ query: string, days_back?: number, max_results?: number }} input
   * @returns {Promise<string>}
   */
  async _call(input) {
    const { query, days_back: daysBack, max_results: maxResults } = input;

    if (!this.userId) {
      logger.warn('[conversation_search] Called without a userId; refusing to search');
      return 'No fue posible identificar al usuario, así que no puedo consultar su historial.';
    }

    return searchUserMessages({
      userId: this.userId,
      query,
      daysBack,
      maxResults,
      config: this.config,
      excludeConversationId: this.req?.body?.conversationId,
    });
  }
}

module.exports = ConversationSearch;
