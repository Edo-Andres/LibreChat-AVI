const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

/**
 * GET /api/avi-roles
 * Get all AVI roles
 */
router.get('/', async (req, res) => {
  try {
    const { listAviRoles } = require('~/models');
    const aviRoles = await listAviRoles();
    res.status(200).json(aviRoles);
  } catch (error) {
    console.error('Error fetching AVI roles:', error);
    res.status(500).json({ message: 'Failed to fetch AVI roles', error: error.message });
  }
});

/**
 * GET /api/avi-roles/:roleId/subroles
 * Get all subroles for a specific AVI role
 */
router.get('/:roleId/subroles', async (req, res) => {
  try {
    const { getAviSubrolesByParentId } = require('~/models');
    const { roleId } = req.params;
    
    const aviSubroles = await getAviSubrolesByParentId(roleId);
    res.status(200).json(aviSubroles);
  } catch (error) {
    console.error('Error fetching AVI subroles:', error);
    res.status(500).json({ message: 'Failed to fetch AVI subroles', error: error.message });
  }
});

module.exports = router;