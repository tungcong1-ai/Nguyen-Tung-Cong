import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Gamepad2,
  ChevronRight,
  LogOut,
  User as UserIcon,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageGenerator } from './components/ImageGenerator';
import { GameGenerator } from './components/GameGenerator';
import { StudyAssistant } from './components/StudyAssistant';
import { auth, onAuthStateChanged, signOut, doc, setDoc, db, User } from './firebase';
import { Login, LoginButton } from './components/Auth';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [activeModule, setActiveModule] = useState<'dashboard' | 'image' | 'game' | 'study'>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Sync user profile to Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          lastLogin: new Date().toISOString(),
          createdAt: new Date().toISOString() // In a real app, you'd check if it exists first
        }, { merge: true });
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-10 h-10 text-indigo-600" />
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
        {/* Header */}
        <header className="border-b border-neutral-200 bg-white sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveModule('dashboard')}>
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">AI Studio Creative</h1>
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-full border border-neutral-200">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="w-6 h-6 rounded-full" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-neutral-500" />
                    )}
                    <span className="text-xs font-bold text-neutral-700 hidden sm:inline">{user.displayName}</span>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <LoginButton />
              )}
            </div>
          </div>
        </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeModule === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto space-y-12 py-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-5xl font-black tracking-tight text-neutral-900">
                  Sáng tạo không giới hạn với <span className="text-indigo-600">AI</span>
                </h2>
                <p className="text-xl text-neutral-500 max-w-2xl mx-auto">
                  Chọn một công cụ bên dưới để bắt đầu hành trình sáng tạo của bạn.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Image Generator Card */}
                <button 
                  onClick={() => setActiveModule('image')}
                  className="group relative bg-white rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all text-left overflow-hidden h-[400px] flex flex-col"
                >
                  <div className="h-48 w-full overflow-hidden relative">
                    <img 
                      src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop" 
                      alt="AI Art" 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
                  </div>
                  <div className="p-8 space-y-4 flex-1 relative z-10 -mt-12">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">Trình Tạo Ảnh AI</h3>
                      <p className="text-neutral-500 mt-2">Biến ý tưởng thành tác phẩm nghệ thuật, truyện tranh từ mô tả văn bản hoặc hình vẽ phác thảo.</p>
                    </div>
                    <div className="flex items-center gap-2 text-indigo-600 font-bold pt-2">
                      Bắt đầu sáng tạo <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </button>

                {/* Game Generator Card */}
                <button 
                  onClick={() => setActiveModule('game')}
                  className="group relative bg-white rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all text-left overflow-hidden h-[400px] flex flex-col"
                >
                  <div className="h-48 w-full overflow-hidden relative">
                    <img 
                      src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop" 
                      alt="AI Gaming" 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
                  </div>
                  <div className="p-8 space-y-4 flex-1 relative z-10 -mt-12">
                    <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                      <Gamepad2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">Trình Tạo Trò Chơi AI</h3>
                      <p className="text-neutral-500 mt-2">Thiết kế các trò chơi phiêu lưu, trắc nghiệm hoặc giải đố độc đáo chỉ trong vài giây.</p>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 font-bold pt-2">
                      Bắt đầu thiết kế <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </button>

                {/* Study Assistant Card */}
                <button 
                  onClick={() => setActiveModule('study')}
                  className="group relative bg-white rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all text-left overflow-hidden h-[400px] flex flex-col md:col-span-2"
                >
                  <div className="h-48 w-full overflow-hidden relative">
                    <img 
                      src="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=1000&auto=format&fit=crop" 
                      alt="AI Study" 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
                  </div>
                  <div className="p-8 space-y-4 flex-1 relative z-10 -mt-12">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                      <BookOpen className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">Trợ Lý Học Tập AI</h3>
                      <p className="text-neutral-500 mt-2">Tóm tắt tài liệu, xây dựng sơ đồ tư duy và tạo câu hỏi trắc nghiệm thông minh.</p>
                    </div>
                    <div className="flex items-center gap-2 text-blue-600 font-bold pt-2">
                      Bắt đầu học tập <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>
          )}

          {activeModule === 'image' && (
            <motion.div
              key="image-generator"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ImageGenerator onBack={() => setActiveModule('dashboard')} />
            </motion.div>
          )}

          {activeModule === 'game' && (
            <motion.div
              key="game-generator"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <GameGenerator onBack={() => setActiveModule('dashboard')} />
            </motion.div>
          )}

          {activeModule === 'study' && (
            <motion.div
              key="study-assistant"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <StudyAssistant onBack={() => setActiveModule('dashboard')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-neutral-200 mt-8">
        <p className="text-center text-neutral-500 text-sm">
          Sử dụng công nghệ Google Gemini AI • 2024
        </p>
      </footer>
    </div>
    </ErrorBoundary>
  );
}

