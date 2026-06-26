import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, Loader2, ChefHat } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const [email, setEmail] = useState('admin@flowup.com');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (
  e: React.FormEvent
) => {
  e.preventDefault();

  setError("");
  setIsLoading(true);

  try {
    const result = await login(
      email,
      password
    );

    if (result.success) {
      navigate("/dashboard", {
        replace: true,
      });
    } else {
      setError(
        result.error ||
          "Login failed"
      );
    }
  } catch (error) {
    setError(
      "Something went wrong. Please try again."
    );
  } finally {
    setIsLoading(false);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900 p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-md">
        <div className="card p-8 sm:p-10">
          <div className="text-center mb-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 mb-4">
              <ChefHat className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">FlowUp Admin</h1>
            <p className="text-secondary-500 dark:text-secondary-400 mt-2">Restaurant Management Dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-4 rounded-xl bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800"><p className="text-sm text-danger-600 dark:text-danger-400">{error}</p></motion.div>}

            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-12" placeholder="admin@flowup.com" required />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-12 pr-12" placeholder="Enter your password" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn btn-primary w-full py-3.5 text-base">
              {isLoading ? (<><Loader2 className="w-5 h-5 animate-spin" /> Signing in...</>) : ('Sign In')}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-secondary-200 dark:border-secondary-700">
            <p className="text-center text-sm text-secondary-500 dark:text-secondary-400">Demo credentials: admin@flowup.com / 123456</p>
          </div>
        </div>
        <p className="text-center text-xs text-secondary-400 dark:text-secondary-500 mt-6">© 2024 FlowUp. All rights reserved.</p>
      </motion.div>
    </div>
  );
}
