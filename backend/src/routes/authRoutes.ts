import { Router } from 'express';
import passport from 'passport';
import { login, logout, getMe, forgotPassword, resetPassword, changePassword, refresh, impersonate, impersonateExit } from '../controllers/authController';
import { authMiddleware } from '../middlewares/auth';
import { generateTokens } from '../utils/jwt';

const router = Router();

router.post('/login', login);
router.post('/logout', authMiddleware, logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', authMiddleware, changePassword);
router.post('/refresh', refresh);
router.get('/me', authMiddleware, getMe);

// --- Impersonation (Super Admin) ---
router.post('/impersonate/exit', authMiddleware, impersonateExit);
router.post('/impersonate/:tenantId', authMiddleware, impersonate);

// --- Google OAuth ---
// Rota para iniciar o fluxo OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/google/link', authMiddleware, passport.authenticate('google', { scope: ['profile', 'email'], session: false, state: 'link' }));
router.delete('/google/link', authMiddleware, async (req, res) => {
  try {
    const { unlinkGoogle } = await import('../controllers/authController');
    return unlinkGoogle(req, res);
  } catch(e) { res.status(500).json({ error: 'Erro interno' }); }
});

// Callback do Google
router.get('/google/callback', 
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=unauthorized' }),
  async (req, res) => {
    try {
      const user = req.user as any;
      if (!user) return res.redirect('/login?error=unauthorized');

      // Link conta se o state for 'link'
      if (req.query.state === 'link') {
        const { linkGoogle } = await import('../controllers/authController');
        return linkGoogle(req, res, user);
      }

      const { accessToken, refreshToken } = generateTokens(user.id, user.tenantId, user.role);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
      });

      // Redireciona para o Frontend com o Access Token na URL
      // O Frontend deve capturar, salvar e limpar a URL
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${FRONTEND_URL}/oauth-callback?token=${accessToken}`);
    } catch (error) {
      res.redirect('/login?error=server_error');
    }
  }
);

export default router;
