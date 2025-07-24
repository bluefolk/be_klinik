const admin = require('../config/firebase');

// Verify Firebase auth token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const verifyRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get user's custom claims
      const userRecord = await admin.auth().getUser(user.uid);
      const customClaims = userRecord.customClaims || {};
      
      // Check if user has any of the allowed roles
      const hasAllowedRole = allowedRoles.some(role => customClaims[role] === true);
      
      if (!hasAllowedRole) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('Error verifying role:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

module.exports = {
  verifyToken,
  verifyRole,
  isAdmin: verifyRole(['admin']),
  isDoctor: verifyRole(['doctor']),
  isPatient: verifyRole(['patient'])
}; 