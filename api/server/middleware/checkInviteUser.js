const { getInvite } = require('~/models/inviteUser');
const { deleteTokens } = require('~/models/Token');
const logger = require('~/config/winston');

async function checkInviteUser(req, res, next) {
  const token = req.body.token;

  if (!token || token === 'undefined') {
    next();
    return;
  }

  try {
    const invite = await getInvite(token, req.body.email);

    if (!invite || invite.error === true) {
      const errorMessage = invite?.message || 'Invalid invite token';
      logger.error('[checkInviteUser] Invite validation failed:', { token: token.substring(0, 10) + '...', email: req.body.email, error: errorMessage });
      return res.status(400).json({ message: errorMessage });
    }

    await deleteTokens({ token: invite.token });
    req.invite = invite;
    next();
  } catch (error) {
    logger.error('[checkInviteUser] Unexpected error:', error);
    return res.status(429).json({ message: error.message });
  }
}

module.exports = checkInviteUser;
