const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const { User } = require('~/db/models');
const { getAppConfig } = require('~/server/services/Config/app');
const { generateFollowUpSuggestions } = require('~/server/services/Suggestions/generateFollowUp');
const { Conversation } = require('~/db/models');

const router = express.Router();

/**
 * GET /api/suggestions/initial
 * Get initial conversation suggestions based on user's AVI role
 */
router.get('/initial', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user with populated roles
    const user = await User.findById(userId)
      .populate('aviSubrol_id')
      .populate('aviRol_id')
      .lean();

    if (!user) {
      logger.warn('[Initial Suggestions] User not found:', userId);
      return res.json({ suggestions: [] });
    }

    let suggestions = [];

    // Priority: aviSubrol > aviRol > default from config
    if (user.aviSubrol_id?.initial_suggestions?.length) {
      suggestions = user.aviSubrol_id.initial_suggestions;
      logger.debug('[Initial Suggestions] Using aviSubrol suggestions for user:', userId);
    } else if (user.aviRol_id?.initial_suggestions?.length) {
      suggestions = user.aviRol_id.initial_suggestions;
      logger.debug('[Initial Suggestions] Using aviRol suggestions for user:', userId);
    } else {
      // Get default from config
      const config = await getAppConfig();
      suggestions = config?.conversationSuggestions?.defaultInitialSuggestions || [];
      logger.debug('[Initial Suggestions] Using default suggestions for user:', userId);
    }

    // Ensure we return exactly 4 suggestions (or less if not available)
    const limitedSuggestions = suggestions.slice(0, 4);

    res.json({ suggestions: limitedSuggestions });
  } catch (error) {
    logger.error('[Initial Suggestions] Error:', error);
    res.status(500).json({ suggestions: [] });
  }
});

/**
 * POST /api/suggestions/follow-up
 * Generate follow-up suggestions based on conversation context
 */
router.post('/follow-up', requireJwtAuth, async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({
        error: 'conversationId is required',
        suggestions: []
      });
    }

    // Verify user owns conversation
    const conversation = await Conversation.findOne({
      conversationId,
      user: userId
    }).lean();

    if (!conversation) {
      logger.warn('[Follow-up Suggestions] Conversation not found or unauthorized:', {
        conversationId,
        userId
      });
      return res.status(404).json({
        error: 'Conversation not found',
        suggestions: []
      });
    }

    // Generate follow-up suggestions
    const suggestions = await generateFollowUpSuggestions(conversationId, userId);

    res.json({ suggestions });
  } catch (error) {
    logger.error('[Follow-up Suggestions] Error:', error);
    res.status(500).json({ suggestions: [] });
  }
});

module.exports = router;
