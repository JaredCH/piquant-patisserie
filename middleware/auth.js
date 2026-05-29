/**
 * @module auth
 * @description Express middleware for admin session authentication.
 * Checks req.session.isAdmin flag set during login.
 */

/**
 * Middleware that requires an authenticated admin session.
 * Returns 401 JSON if the session is not authenticated.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { requireAdmin };
