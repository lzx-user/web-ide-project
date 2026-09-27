declare global {
  namespace Express {
    interface Request {
      user: {
        sessionId: string;
        username: string;
        roomId: string;
        role: 'owner' | 'editor';
      };
    }
  }
}

export {};
