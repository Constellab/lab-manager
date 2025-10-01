import { AsyncLocalStorage } from 'async_hooks';

export interface AuthContextSpace {
  type: 'space';
}

export interface AuthContextLab {
  type: 'lab';
  env: 'dev' | 'prod';
}

export interface AuthContextPublic {
  type: 'public';
}

export interface AuthContextLocal {
  type: 'local';
}

export type AuthContext = AuthContextSpace | AuthContextLab | AuthContextPublic | AuthContextLocal;

export class AuthContextService {
  private static readonly asyncLocalStorage = new AsyncLocalStorage<AuthContext>();

  /**
   * Set the auth context for the current async execution
   */
  public static setContext(context: AuthContext): void {
    this.asyncLocalStorage.enterWith(context);
  }

  /**
   * Get the current auth context
   */
  public static getContext(): AuthContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  public static getAndCheckContext(): AuthContext {
    const context = this.getContext();
    if (!context) {
      throw new Error('No authentication context found');
    }
    return context;
  }
}
