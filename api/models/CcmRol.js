const mongoose = require('mongoose');
const { ccmRolSchema } = require('@librechat/data-schemas');

const CcmRol = mongoose.model('CcmRol', ccmRolSchema);

module.exports = CcmRol;