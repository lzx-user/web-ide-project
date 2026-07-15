declare global {
  namespace Express {
    interface Request {
      user: {
        username: string;
        roomId: string;
      };
    }
  }
}

export {};
