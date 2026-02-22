import React, { useState } from 'react';
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useMemberAuth } from '../hooks/useMemberAuth';

interface MemberLoginProps {
  onBack: () => void;
  onLoginSuccess: (memberId: string) => void;
}

const MemberLogin: React.FC<MemberLoginProps> = ({ onBack, onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showReset, setShowReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, resetPassword } = useMemberAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (showReset) {
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        const result = await resetPassword(formData.email, formData.password);
        if (result.success) {
          setShowReset(false);
          setFormData({ username: '', email: '', password: '', confirmPassword: '' });
          setError('');
          setSuccess('Password reset. You can log in with your new password.');
          setLoading(false);
          return;
        }
        setError(result.error || 'Password reset failed');
        setLoading(false);
        return;
      }

      if (isLogin) {
        const result = await login({
          email: formData.email,
          password: formData.password
        });

        if (result.success && result.member) {
          // State is updated synchronously, so we can call this immediately
          onLoginSuccess(result.member.id);
        } else {
          setError(result.error || 'Login failed');
        }
      } else {
        // Registration
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }

        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }

        const result = await register({
          username: formData.username,
          email: formData.email,
          password: formData.password
        });

        if (result.success && result.member) {
          // State is updated synchronously, so we can call this immediately
          onLoginSuccess(result.member.id);
        } else {
          setError(result.error || 'Registration failed');
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const inputClass = 'w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 bg-white/10 backdrop-blur-sm border-pink-500/30 text-white placeholder-pink-200/60 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0d0d0d' }}>
      <div className="fixed inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'url(/logo.png)', backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
      <div className="w-full max-w-md relative z-10">
        <button
          onClick={onBack}
          className="mb-6 flex items-center text-white hover:text-pink-400 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </button>

        <div
          className="rounded-2xl p-6 shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, #2d1b4e 0%, #1a0f2e 100%)',
            border: '1.5px solid rgba(255, 105, 180, 0.3)',
          }}
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-pink-500 to-fuchsia-500 rounded-full mb-4">
              <User className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              {showReset ? 'Reset Password' : isLogin ? 'Member Login' : 'Member Registration'}
            </h2>
            <p className="text-pink-200/80">
              {showReset ? 'Enter your email and new password' : isLogin ? 'Welcome back!' : 'Create your account'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-red-200 text-sm bg-red-500/20 border border-red-500/30">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg text-green-200 text-sm bg-green-500/20 border border-green-500/30">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {showReset && (
              <>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-pink-300/60" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={inputClass}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-pink-300/60" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className={inputClass + ' pr-12'}
                      placeholder="Enter new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-pink-300/60 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-pink-300/60" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className={inputClass}
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : 'Reset Password'}
                </button>
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReset(false);
                      setError('');
                      setSuccess('');
                      setFormData({ username: '', email: '', password: '', confirmPassword: '' });
                    }}
                    className="text-pink-400 hover:text-pink-300 transition-colors text-sm"
                  >
                    Back to login
                  </button>
                </div>
              </>
            )}
            {!showReset && (
              <>
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-pink-300/60" />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className={inputClass}
                    placeholder="Enter username"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-pink-300/60" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={inputClass}
                  placeholder="Enter email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-pink-300/60" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={inputClass + ' pr-12'}
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-pink-300/60 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-pink-300/60" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className={inputClass}
                    placeholder="Confirm password"
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
            </button>

            {isLogin && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowReset(true);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-pink-400 hover:text-pink-300 transition-colors text-sm"
                >
                  Forgot password?
                </button>
              </div>
            )}
              </>
            )}
          </form>

          {!showReset && (
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
                setFormData({ username: '', email: '', password: '', confirmPassword: '' });
              }}
              className="text-pink-400 hover:text-pink-300 transition-colors text-sm"
            >
              {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberLogin;
