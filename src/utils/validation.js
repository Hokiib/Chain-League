const { body, param, query, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Validation rules for player registration
const validatePlayerRegistration = [
  body('walletAddress')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum wallet address'),
  body('username')
    .isLength({ min: 3, max: 20 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-20 characters, alphanumeric and underscore only'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),
  handleValidationErrors
];

// Validation rules for team creation
const validateTeamCreation = [
  body('name')
    .isLength({ min: 2, max: 30 })
    .matches(/^[a-zA-Z0-9\s]+$/)
    .withMessage('Team name must be 2-30 characters, alphanumeric and spaces only'),
  body('color')
    .isHexColor()
    .withMessage('Invalid color format (hex)'),
  body('logo')
    .optional()
    .isURL()
    .withMessage('Invalid logo URL'),
  handleValidationErrors
];

// Validation rules for map clicks
const validateMapClick = [
  body('x')
    .isInt({ min: 0, max: 99 })
    .withMessage('X coordinate must be between 0 and 99'),
  body('y')
    .isInt({ min: 0, max: 99 })
    .withMessage('Y coordinate must be between 0 and 99'),
  handleValidationErrors
];

// Validation rules for betting
const validateBetting = [
  body('teamId')
    .isUUID()
    .withMessage('Invalid team ID'),
  body('amount')
    .isFloat({ min: 0.1 })
    .withMessage('Bet amount must be at least 0.1 CHZ'),
  body('sessionId')
    .isUUID()
    .withMessage('Invalid session ID'),
  handleValidationErrors
];

// Validation rules for subscription
const validateSubscription = [
  body('planId')
    .isIn(['monthly', 'yearly', 'lifetime'])
    .withMessage('Invalid subscription plan'),
  body('walletAddress')
    .isEthereumAddress()
    .withMessage('Invalid wallet address'),
  body('signature')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Signature is required'),
  handleValidationErrors
];

// Validation rules for pagination
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

// Validation rules for UUID parameters
const validateUUID = [
  param('id')
    .isUUID()
    .withMessage('Invalid UUID format'),
  handleValidationErrors
];

// Validation rules for game session
const validateGameSession = [
  param('sessionId')
    .isUUID()
    .withMessage('Invalid session ID'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validatePlayerRegistration,
  validateTeamCreation,
  validateMapClick,
  validateBetting,
  validateSubscription,
  validatePagination,
  validateUUID,
  validateGameSession
}; 