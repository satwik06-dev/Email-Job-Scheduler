import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginWithGoogle: (credential: string) => Promise<boolean>;
  loginDemo: (email?: string, name?: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUserSlackStatus: (status: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('reachinbox_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        // Refresh profile in background
        if (parsed.id) {
          authApi.getMe(parsed.id)
            .then((fresh) => {
              setUser(fresh);
              localStorage.setItem('reachinbox_user', JSON.stringify(fresh));
            })
            .catch(() => {});
        }
      } catch (e) {
        localStorage.removeItem('reachinbox_user');
      }
    }
    setIsLoading(false);
  }, []);

  const loginWithGoogle = async (credential: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await authApi.googleLogin(credential);
      if (res.success && res.user) {
        setUser(res.user);
        localStorage.setItem('reachinbox_user', JSON.stringify(res.user));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Google login failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginDemo = async (email?: string, name?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await authApi.demoLogin(email, name);
      if (res.success && res.user) {
        setUser(res.user);
        localStorage.setItem('reachinbox_user', JSON.stringify(res.user));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Demo login failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('reachinbox_user');
  };

  const refreshUser = async () => {
    if (user?.id) {
      try {
        const fresh = await authApi.getMe(user.id);
        setUser(fresh);
        localStorage.setItem('reachinbox_user', JSON.stringify(fresh));
      } catch (err) {
        // ignore
      }
    }
  };

  const updateUserSlackStatus = (status: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...status };
      setUser(updated);
      localStorage.setItem('reachinbox_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loginWithGoogle,
        loginDemo,
        logout,
        refreshUser,
        updateUserSlackStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
