declare global {
  namespace Express {
    interface Request {
      user: {
        sessionId: string;
        username: string;
        roomId: string;
        role: import('../auth/roles.js').WorkspaceRole;
      };
    }
  }
}

export {};
