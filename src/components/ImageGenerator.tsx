import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Download, 
  Loader2, 
  Camera, 
  Palette, 
  Sun, 
  Brush, 
  User, 
  MapPin,
  GraduationCap,
  Upload,
  X,
  BookOpen,
  Layers,
  Mic,
  MicOff,
  Pencil,
  ArrowLeft,
  Home,
  History,
  Trash2,
  Maximize2,
  RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateImage, generateComic, ImageGenerationParams } from '../services/geminiService';
import { DrawingCanvas } from './DrawingCanvas';
import { db, auth, collection, addDoc, query, orderBy, limit, onSnapshot, handleFirestoreError, OperationType } from '../firebase';
import { serverTimestamp } from 'firebase/firestore';

interface ImageHistoryItem {
  id: string;
  url: string;
  prompt: string;
  params: ImageGenerationParams;
  createdAt: any;
  isComic?: boolean;
  comicUrls?: string[];
}

const STUDENT_TEMPLATE: ImageGenerationParams = {
  subject: "Nhóm 4-5 học sinh trung học Việt Nam, nữ mặc áo sơ mi trắng chân váy xanh đen khăn quàng đỏ, nam mặc áo sơ mi trắng quần tây xanh đen, có phù hiệu trường thêu trên ngực",
  actionContext: "Đang cười nói, đi bộ cùng nhau trên hành lang sân trường lát gạch có cây phượng vĩ lớn và ghế đá, bối cảnh trường học Việt Nam đặc trưng với dãy lớp học nhiều tầng",
  style: "Realistic",
  lighting: "Golden hour",
  color: "Warm tones",
  camera: "Eye-level"
};

const COMIC_TEMPLATE: ImageGenerationParams = {
  subject: "Siêu anh hùng Việt Nam",
  actionContext: "Trang 1: Nhân vật đứng trên nóc nhà cao tầng tại Sài Gòn, nhìn xuống đường phố nhộn nhịp. 'Tôi sẽ bảo vệ thành phố này!'\nTrang 2: Một con quái vật khổng lồ xuất hiện từ dưới sông Sài Gòn. 'Gầm!!!'\nTrang 3: Siêu anh hùng bay xuống và tung một cú đấm rực lửa. 'Hãy nếm mùi này!'",
  style: "Digital Art",
  lighting: "Cinematic lighting",
  color: "Contrasting colors",
  camera: "Wide shot"
};

const STYLES = [
  { value: 'Realistic', label: 'Tả thực' },
  { value: '3D Render', label: '3D Render (Pixar)' },
  { value: 'Anime', label: 'Anime' },
  { value: 'Digital Art', label: 'Nghệ thuật số' },
  { value: 'Fantasy Art', label: 'Nghệ thuật kỳ ảo' },
  { value: 'Surrealism', label: 'Siêu thực' },
  { value: 'Oil Painting', label: 'Sơn dầu' },
  { value: 'Cyberpunk', label: 'Cyberpunk' },
  { value: 'Minimalist', label: 'Tối giản' },
];

const LIGHTING = [
  { value: 'Cinematic lighting', label: 'Ánh sáng điện ảnh' },
  { value: 'Golden hour', label: 'Giờ vàng' },
  { value: 'Neon lights', label: 'Đèn Neon' },
  { value: 'Soft lighting', label: 'Ánh sáng mềm' },
];

const COLORS = [
  { value: 'Warm tones', label: 'Tông màu nóng' },
  { value: 'Pastel colors', label: 'Màu pastel' },
  { value: 'Monochrome', label: 'Đen trắng' },
  { value: 'Contrasting colors', label: 'Màu tương phản' },
];

const CAMERA_ANGLES = [
  { value: 'Close-up', label: 'Cận cảnh' },
  { value: 'Wide shot', label: 'Góc rộng' },
  { value: 'Bird\'s eye view', label: 'Nhìn từ trên cao' },
  { value: 'Eye-level', label: 'Ngang tầm mắt' },
];

interface ImageGeneratorProps {
  onBack: () => void;
}

export const ImageGenerator = ({ onBack }: ImageGeneratorProps) => {
  const [params, setParams] = useState<ImageGenerationParams>({
    subject: '',
    actionContext: '',
    style: STYLES[0].value,
    lighting: LIGHTING[0].value,
    color: COLORS[0].value,
    camera: CAMERA_ANGLES[0].value,
    referenceType: 'composition'
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [comicImages, setComicImages] = useState<string[]>([]);
  const [isComicMode, setIsComicMode] = useState(false);
  const [numPages, setNumPages] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<'subject' | 'context' | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [refMode, setRefMode] = useState<'upload' | 'draw'>('upload');
  const [history, setHistory] = useState<ImageHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ImageHistoryItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, `users/${auth.currentUser.uid}/image_history`),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ImageHistoryItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as ImageHistoryItem);
      });
      setHistory(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'image_history');
    });

    return () => unsubscribe();
  }, []);

  const startListening = (field: 'subject' | 'context') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(field);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (field === 'subject') {
        setParams(prev => ({ ...prev, subject: prev.subject + ' ' + transcript }));
      } else {
        setParams(prev => ({ ...prev, actionContext: prev.actionContext + ' ' + transcript }));
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(null);
    };

    recognition.onend = () => {
      setIsListening(null);
    };

    recognition.start();
  };

  const handleApplyStudentTemplate = () => {
    setIsComicMode(false);
    setParams(STUDENT_TEMPLATE);
  };

  const handleApplyComicTemplate = () => {
    setIsComicMode(true);
    setParams(COMIC_TEMPLATE);
    setNumPages(3);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!params.subject && !isComicMode) {
      setError('Vui lòng nhập chủ thể!');
      return;
    }
    if (isComicMode && !params.actionContext) {
      setError('Vui lòng nhập kịch bản truyện tranh vào phần bối cảnh!');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImageUrl(null);
    setComicImages([]);

    try {
      let finalUrl = '';
      let finalComicUrls: string[] = [];

      if (isComicMode) {
        const urls = await generateComic({
          ...params,
          script: params.actionContext,
          numPages: numPages,
          referenceImage: uploadedImage || undefined
        });
        setComicImages(urls);
        finalComicUrls = urls;
      } else {
        const url = await generateImage({
          ...params,
          referenceImage: uploadedImage || undefined
        });
        setGeneratedImageUrl(url);
        finalUrl = url;
      }

      // Save to history
      if (auth.currentUser) {
        // Helper to resize image for history storage (Firestore 1MB limit)
        const resizeForHistory = async (base64: string): Promise<string> => {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 800;
              const MAX_HEIGHT = 800;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              // Use JPEG for history to save space
              resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = base64;
          });
        };

        const historyUrl = finalUrl ? await resizeForHistory(finalUrl) : '';
        const historyComicUrls = await Promise.all(finalComicUrls.map(url => resizeForHistory(url)));

        await addDoc(collection(db, `users/${auth.currentUser.uid}/image_history`), {
          url: historyUrl,
          comicUrls: historyComicUrls,
          isComic: isComicMode,
          prompt: params.subject || params.actionContext,
          params: params,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      setError('Có lỗi xảy ra khi tạo ảnh. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (generatedImageUrl) {
      const link = document.createElement('a');
      link.href = generatedImageUrl;
      link.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
            title="Quay lại"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-indigo-600" />
            Trình Tạo Ảnh AI
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-bold shadow-sm border ${showHistory ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'}`}
          >
            <History className="w-4 h-4" /> Lịch sử {history.length > 0 && `(${history.length})`}
          </button>
          <button 
            onClick={onBack}
            className="px-4 py-2 bg-white border border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 transition-all flex items-center gap-2 text-sm font-bold shadow-sm"
          >
            <Home className="w-4 h-4" /> Trang chủ
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  Ảnh đã tạo gần đây
                </h3>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {!auth.currentUser ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
                    <Lock className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900">Đăng nhập để lưu lịch sử</h4>
                    <p className="text-sm text-neutral-500 max-w-xs mx-auto">
                      Bạn cần đăng nhập bằng Google để có thể lưu và xem lại các tác phẩm đã tạo.
                    </p>
                  </div>
                </div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center text-neutral-400">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>Bạn chưa tạo ảnh nào gần đây.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {history.map((item) => (
                    <motion.div
                      key={item.id}
                      whileHover={{ scale: 1.02 }}
                      className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 cursor-pointer"
                      onClick={() => setSelectedHistoryItem(item)}
                    >
                      <img 
                        src={item.isComic ? item.comicUrls?.[0] : item.url} 
                        alt={item.prompt} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                        <p className="text-[10px] text-white line-clamp-2 font-medium">{item.prompt}</p>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[8px] text-white/70">
                            {item.isComic ? 'Truyện tranh' : 'Ảnh đơn'}
                          </span>
                          <Maximize2 className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Detail Modal */}
      <AnimatePresence>
        {selectedHistoryItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col"
            >
              <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="font-bold truncate pr-8">{selectedHistoryItem.prompt}</h3>
                <button 
                  onClick={() => setSelectedHistoryItem(null)}
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {selectedHistoryItem.isComic ? (
                    <div className="space-y-4">
                      {selectedHistoryItem.comicUrls?.map((url, i) => (
                        <div key={i} className="rounded-xl overflow-hidden border border-neutral-200 shadow-sm">
                          <img src={url} alt={`Page ${i+1}`} className="w-full h-auto" referrerPolicy="no-referrer" />
                          <div className="p-2 bg-neutral-50 text-[10px] font-bold text-neutral-500 text-center border-t border-neutral-100">
                            TRANG {i + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-lg">
                      <img src={selectedHistoryItem.url} alt="Generated" className="w-full h-auto" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Thông tin chi tiết</h4>
                    <div className="bg-neutral-50 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-500">Loại:</span>
                        <span className="font-bold">{selectedHistoryItem.isComic ? 'Truyện tranh' : 'Ảnh đơn'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-500">Phong cách:</span>
                        <span className="font-bold">{STYLES.find(s => s.value === selectedHistoryItem.params.style)?.label || selectedHistoryItem.params.style}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-500">Ánh sáng:</span>
                        <span className="font-bold">{LIGHTING.find(l => l.value === selectedHistoryItem.params.lighting)?.label || selectedHistoryItem.params.lighting}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-500">Màu sắc:</span>
                        <span className="font-bold">{COLORS.find(c => c.value === selectedHistoryItem.params.color)?.label || selectedHistoryItem.params.color}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-500">Góc máy:</span>
                        <span className="font-bold">{CAMERA_ANGLES.find(a => a.value === selectedHistoryItem.params.camera)?.label || selectedHistoryItem.params.camera}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Mô tả</h4>
                    <p className="text-sm text-neutral-700 leading-relaxed bg-neutral-50 rounded-2xl p-4 italic">
                      "{selectedHistoryItem.prompt}"
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setParams(selectedHistoryItem.params);
                        setIsComicMode(!!selectedHistoryItem.isComic);
                        setSelectedHistoryItem(null);
                        setShowHistory(false);
                      }}
                      className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCcw className="w-4 h-4" /> Dùng lại mô tả
                    </button>
                    <button
                      onClick={() => {
                        const urls = selectedHistoryItem.isComic ? selectedHistoryItem.comicUrls || [] : [selectedHistoryItem.url];
                        urls.forEach((url, i) => {
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `download-${i}-${Date.now()}.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        });
                      }}
                      className="px-6 bg-neutral-100 text-neutral-900 py-3 rounded-xl font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Tải về
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Column: Input */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-neutral-200"
        >
          {/* Reference Image Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Ảnh tham khảo
              </label>
              <div className="flex p-0.5 bg-neutral-100 rounded-lg">
                <button
                  onClick={() => setRefMode('upload')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${refMode === 'upload' ? 'bg-white shadow-sm text-indigo-600' : 'text-neutral-500 hover:text-neutral-700'}`}
                >
                  <Upload className="w-3 h-3" /> Tải lên
                </button>
                <button
                  onClick={() => setRefMode('draw')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${refMode === 'draw' ? 'bg-white shadow-sm text-indigo-600' : 'text-neutral-500 hover:text-neutral-700'}`}
                >
                  <Pencil className="w-3 h-3" /> Vẽ minh họa
                </button>
              </div>
            </div>

            {refMode === 'draw' && !uploadedImage && !isDrawingMode ? (
              <button
                onClick={() => setIsDrawingMode(true)}
                className="w-full border-2 border-dashed border-neutral-200 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-400 transition-colors bg-neutral-50 group"
              >
                <div className="bg-white p-3 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                  <Pencil className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="text-sm font-medium text-neutral-600">Bắt đầu vẽ minh họa</p>
                <p className="text-xs text-neutral-400 text-center px-4">Vẽ phác thảo ý tưởng của bạn để AI hiểu bố cục và chi tiết chính xác hơn</p>
              </button>
            ) : refMode === 'draw' && isDrawingMode ? (
              <DrawingCanvas 
                onSave={(dataUrl) => {
                  setUploadedImage(dataUrl);
                  setIsDrawingMode(false);
                }}
                onCancel={() => setIsDrawingMode(false)}
              />
            ) : (
              <div 
                onClick={() => refMode === 'upload' && fileInputRef.current?.click()}
                className={`border-2 border-dashed border-neutral-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors bg-neutral-50 ${refMode === 'upload' ? 'cursor-pointer hover:border-indigo-400' : ''}`}
              >
                {uploadedImage ? (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden group/img">
                    <img src={uploadedImage} alt="Reference" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {refMode === 'draw' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsDrawingMode(true); }}
                          className="bg-white text-neutral-900 p-2 rounded-full hover:bg-neutral-100 shadow-lg"
                          title="Sửa hình vẽ"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setUploadedImage(null); }}
                        className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-lg"
                        title="Xóa ảnh"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8 text-neutral-300" />
                    <p className="text-xs text-neutral-500">
                      {refMode === 'upload' ? 'Nhấn để tải lên hoặc kéo thả ảnh' : 'Chưa có hình vẽ minh họa'}
                    </p>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileUpload}
                />
              </div>
            )}

            {uploadedImage && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Mục đích tham khảo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'composition', label: 'Bố cục', icon: Layers },
                    { id: 'style', label: 'Phong cách', icon: Palette },
                    { id: 'subject', label: 'Chi tiết', icon: User },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setParams({ ...params, referenceType: type.id as any })}
                      className={`py-2 px-1 rounded-lg border text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${params.referenceType === type.id ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-neutral-200 text-neutral-500 hover:border-indigo-200'}`}
                    >
                      <type.icon className="w-3 h-3" />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Brush className="w-5 h-5 text-indigo-600" />
              Mô tả hình ảnh
            </h2>

            {/* Mode Toggle */}
            <div className="flex p-1 bg-neutral-100 rounded-xl">
              <button
                onClick={() => setIsComicMode(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${!isComicMode ? 'bg-white shadow-sm text-indigo-600' : 'text-neutral-500 hover:text-neutral-700'}`}
              >
                <ImageIcon className="w-4 h-4" /> Ảnh đơn
              </button>
              <button
                onClick={() => setIsComicMode(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${isComicMode ? 'bg-white shadow-sm text-indigo-600' : 'text-neutral-500 hover:text-neutral-700'}`}
              >
                <BookOpen className="w-4 h-4" /> Truyện tranh
              </button>
            </div>

            {/* Subject */}
            {!isComicMode && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 flex items-center justify-between">
                  <span className="flex items-center gap-2"><User className="w-4 h-4" /> Chủ thể chính</span>
                  <button
                    onClick={() => startListening('subject')}
                    className={`p-1.5 rounded-lg transition-colors ${isListening === 'subject' ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-neutral-100 text-neutral-500'}`}
                    title="Nhập bằng giọng nói"
                  >
                    {isListening === 'subject' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Một chú mèo, một phi hành gia..."
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  value={params.subject}
                  onChange={(e) => setParams({ ...params, subject: e.target.value })}
                />
              </div>
            )}

            {/* Action & Context / Script */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {isComicMode ? <BookOpen className="w-4 h-4" /> : <MapPin className="w-4 h-4" />} 
                  {isComicMode ? 'Kịch bản truyện tranh' : 'Hành động & Bối cảnh'}
                </span>
                <button
                  onClick={() => startListening('context')}
                  className={`p-1.5 rounded-lg transition-colors ${isListening === 'context' ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title="Nhập bằng giọng nói"
                >
                  {isListening === 'context' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </label>
              <textarea
                placeholder={isComicMode ? "Ví dụ: Trang 1: Nhân vật thức dậy. Trang 2: Nhân vật đi ra ngoài..." : "Ví dụ: đang đọc sách trong một thư viện cổ kính..."}
                rows={isComicMode ? 6 : 3}
                className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
                value={params.actionContext}
                onChange={(e) => setParams({ ...params, actionContext: e.target.value })}
              />
            </div>

            {isComicMode && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Số trang truyện
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setNumPages(n)}
                      className={`flex-1 py-2 rounded-xl border transition-all font-medium ${numPages === n ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-neutral-200 text-neutral-600 hover:border-indigo-300'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Style */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Phong cách
                </label>
                <select
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={params.style}
                  onChange={(e) => setParams({ ...params, style: e.target.value })}
                >
                  {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {/* Lighting */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                  <Sun className="w-4 h-4" /> Ánh sáng
                </label>
                <select
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={params.lighting}
                  onChange={(e) => setParams({ ...params, lighting: e.target.value })}
                >
                  {LIGHTING.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>

              {/* Color */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                  <Palette className="w-4 h-4" /> Màu sắc
                </label>
                <select
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={params.color}
                  onChange={(e) => setParams({ ...params, color: e.target.value })}
                >
                  {COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* Camera */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Góc máy
                </label>
                <select
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={params.camera}
                  onChange={(e) => setParams({ ...params, camera: e.target.value })}
                >
                  {CAMERA_ANGLES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm font-medium">{error}</p>
          )}

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleApplyStudentTemplate}
                className="bg-white border-2 border-indigo-100 hover:border-indigo-600 text-indigo-600 font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 group text-sm"
              >
                <GraduationCap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Mẫu: Học sinh VN
              </button>

              <button
                onClick={handleApplyComicTemplate}
                className="bg-white border-2 border-indigo-100 hover:border-indigo-600 text-indigo-600 font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 group text-sm"
              >
                <BookOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Mẫu: Truyện tranh
              </button>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang tạo ảnh...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Tạo ảnh ngay
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Right Column: Preview */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 min-h-[500px] flex flex-col"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-indigo-600" />
            Kết quả xem trước
          </h2>

          <div className="flex-1 bg-neutral-100 rounded-xl overflow-hidden relative flex items-center justify-center border-2 border-dashed border-neutral-200">
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 text-neutral-500"
                >
                  <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                  <p className="font-medium">{isComicMode ? 'AI đang vẽ truyện tranh cho bạn...' : 'AI đang vẽ cho bạn...'}</p>
                </motion.div>
              ) : comicImages.length > 0 ? (
                <motion.div
                  key="comic"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-full overflow-y-auto p-4 space-y-4"
                >
                  {comicImages.map((url, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden bg-white shadow-sm border border-neutral-200">
                      <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs font-bold z-10">
                        Trang {idx + 1}
                      </div>
                      <img 
                        src={url} 
                        alt={`Comic page ${idx + 1}`} 
                        className="w-full h-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `comic-page-${idx + 1}-${Date.now()}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="bg-white text-neutral-900 px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-neutral-100 transition-colors text-sm"
                        >
                          <Download className="w-4 h-4" />
                          Tải trang {idx + 1}
                        </button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : generatedImageUrl ? (
                <motion.div
                  key="image"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full h-full relative group"
                >
                  <img 
                    src={generatedImageUrl} 
                    alt="Generated" 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={handleDownload}
                      className="bg-white text-neutral-900 px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-neutral-100 transition-colors"
                    >
                      <Download className="w-5 h-5" />
                      Tải về
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="text-neutral-400 flex flex-col items-center gap-2 p-8 text-center">
                  <ImageIcon className="w-16 h-16 opacity-20" />
                  <p>Hình ảnh sẽ xuất hiện tại đây sau khi bạn nhấn nút tạo</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          {generatedImageUrl && !isGenerating && (
            <button
              onClick={handleDownload}
              className="mt-4 w-full lg:hidden bg-neutral-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Tải về hình ảnh
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
};
