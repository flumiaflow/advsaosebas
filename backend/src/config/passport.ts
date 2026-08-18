import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from './db';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'mock_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'mock_secret';
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback';

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: CALLBACK_URL,
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        
        if (!email) {
          return done(new Error('No email found in Google Profile'), false);
        }

        // Buscar usuário pelo Google ID ou E-mail
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { googleId: profile.id },
              { email }
            ]
          }
        });

        if (!user) {
          // Se o usuário não existe, rejeita o login (apenas usuários pré-cadastrados via Backoffice podem logar)
          return done(null, false, { message: 'Usuário não cadastrado no sistema.' });
        }

        // Se encontrou pelo e-mail, mas não tem googleId vinculado ainda, vincula agora
        if (!user.googleId) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId: profile.id }
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

export default passport;
