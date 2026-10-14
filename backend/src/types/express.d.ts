import type { AuthContextUser } from './index.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthContextUser;
      /** Access token validado (nunca confiar em userId do corpo). */
      authToken?: string;
    }
  }
}

export {};
