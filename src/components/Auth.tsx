import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, LogIn, UserCircle } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, signInAnonymously } from '../firebase';

export const LoginButton: React.FC = () => {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleGuestLogin = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      if (error.code === 'auth/admin-restricted-operation') {
        alert('Tính năng "Dùng thử" chưa được bật trong Firebase Console. Vui lòng bật "Anonymous sign-in" trong phần Authentication.');
      } else {
        console.error('Guest login error:', error);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleGuestLogin}
        className="px-4 py-2 bg-white border border-neutral-200 text-neutral-600 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-50 transition-all shadow-sm"
      >
        <UserCircle className="w-4 h-4" />
        <span className="text-sm hidden sm:inline">Dùng thử</span>
      </button>
      <button
        onClick={handleLogin}
        className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-sm"
      >
        <LogIn className="w-4 h-4" />
        <span className="text-sm">Đăng nhập</span>
      </button>
    </div>
  );
};

export const Login: React.FC = () => {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleGuestLogin = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      if (error.code === 'auth/admin-restricted-operation') {
        alert('Tính năng "Dùng thử" chưa được bật trong Firebase Console. Vui lòng bật "Anonymous sign-in" trong phần Authentication.');
      } else {
        console.error('Guest login error:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl border border-neutral-200 p-12 text-center space-y-8"
      >
        <div className="space-y-4">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-200">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-neutral-900">AI Studio Creative</h1>
            <p className="text-neutral-500">Đăng nhập để bắt đầu hành trình sáng tạo của bạn</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleLogin}
            className="w-full py-4 bg-white border-2 border-neutral-200 rounded-2xl font-bold flex items-center justify-center gap-3 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            <span className="text-neutral-700 group-hover:text-indigo-600">Tiếp tục với Google</span>
          </button>

          <button
            onClick={handleGuestLogin}
            className="w-full py-4 bg-neutral-50 border-2 border-transparent rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-neutral-100 transition-all text-neutral-600"
          >
            <UserCircle className="w-5 h-5" />
            <span>Tiếp tục với tư cách khách</span>
          </button>
        </div>

        <p className="text-xs text-neutral-400">
          Tài khoản khách sẽ bị xóa sau khi bạn đăng xuất hoặc xóa dữ liệu trình duyệt.
        </p>
      </motion.div>
    </div>
  );
};
