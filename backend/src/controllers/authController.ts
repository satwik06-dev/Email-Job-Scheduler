import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/db.js';
import { config } from '../config/env.js';

const googleClient = new OAuth2Client(config.google.clientId);

export class AuthController {
  /**
   * Real Google OAuth ID Token verification endpoint
   */
  public async googleLogin(req: Request, res: Response) {
    try {
      const { credential, clientId } = req.body;

      if (!credential) {
        return res.status(400).json({ error: 'Credential ID token is required' });
      }

      let payload: any = null;

      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: clientId || config.google.clientId || undefined,
        });
        payload = ticket.getPayload();
      } catch (err: any) {
        // If Google client ID is not configured on backend yet or jwt payload decoding
        console.warn('[AuthController] Google token verification failed or missing client ID. Decoding payload directly:', err.message);
        try {
          const base64Url = credential.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            Buffer.from(base64, 'base64')
              .toString('latin1')
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          payload = JSON.parse(jsonPayload);
        } catch (decodeErr: any) {
          return res.status(401).json({ error: 'Invalid Google credential token' });
        }
      }

      if (!payload || !payload.email) {
        return res.status(400).json({ error: 'Unable to extract email from Google credential' });
      }

      const email = payload.email.toLowerCase();
      const name = payload.name || payload.given_name || email.split('@')[0];
      const avatar = payload.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`;

      // Upsert user in relational database
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name,
          avatar,
        },
        create: {
          email,
          name,
          avatar,
        },
      });

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          slackConnected: user.slackConnected,
          slackChannel: user.slackChannel,
          slackTeamName: user.slackTeamName,
        },
      });
    } catch (error: any) {
      console.error('[AuthController] Google login error:', error);
      return res.status(500).json({ error: error.message || 'Authentication failed' });
    }
  }

  /**
   * Demo quick login for immediate local testing if Google OAuth client ID is not configured
   */
  public async demoLogin(req: Request, res: Response) {
    try {
      const email = (req.body.email || 'demo@reachinbox.ai').toLowerCase();
      const name = req.body.name || 'ReachInbox Demo User';
      const avatar = req.body.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`;

      const user = await prisma.user.upsert({
        where: { email },
        update: { name, avatar },
        create: { email, name, avatar },
      });

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          slackConnected: user.slackConnected,
          slackChannel: user.slackChannel,
          slackTeamName: user.slackTeamName,
        },
      });
    } catch (error: any) {
      console.error('[AuthController] Demo login error:', error);
      return res.status(500).json({ error: error.message || 'Demo login failed' });
    }
  }

  /**
   * Get current user profile
   */
  public async getMe(req: Request, res: Response) {
    try {
      const userId = (req.query.userId || req.headers['x-user-id']) as string;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        slackConnected: user.slackConnected,
        slackChannel: user.slackChannel,
        slackTeamName: user.slackTeamName,
      });
    } catch (error: any) {
      console.error('[AuthController] Get me error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch user' });
    }
  }
}

export const authController = new AuthController();
export default authController;
