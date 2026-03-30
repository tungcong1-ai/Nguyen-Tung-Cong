import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { 
  Gamepad2, 
  Loader2, 
  ArrowLeft, 
  Play, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Lightbulb,
  Mic,
  MicOff,
  RefreshCcw,
  User,
  Trophy,
  Star,
  Timer,
  Upload,
  Users,
  FileText,
  AlertCircle,
  X,
  Image as ImageIcon,
  Grid3X3,
  Lock,
  Map as MapIcon,
  Compass,
  Flag,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Plus,
  Home,
  Sword,
  Shield,
  Zap,
  Flame,
  Heart,
  Coins,
  Backpack,
  Skull
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateGame, generateImage, GameContent, getAI } from '../services/geminiService';
import { db, auth, doc, setDoc, getDoc, collection, handleFirestoreError, OperationType, getDocs, query, orderBy } from '../firebase';
import * as XLSX from 'xlsx';
import { serverTimestamp } from 'firebase/firestore';

interface Question {
  text: string;
  options: string[];
  answerIndex: number;
}

const WheelComponent = ({ students, rotation, customImage }: { students: string[], rotation: number, customImage?: string }) => {
  const size = 400;
  const center = size / 2;
  const radius = size / 2 - 20;
  const total = students.length;
  const angleStep = 360 / total;

  return (
    <div className="relative w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] mx-auto">
      {/* Pointer */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20">
        <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[40px] border-t-red-600 drop-shadow-xl" />
      </div>
      
      <motion.div 
        className="w-full h-full rounded-full shadow-[0_0_50px_rgba(0,0,0,0.15)] border-8 border-white overflow-hidden bg-white"
        animate={{ rotate: rotation }}
        transition={{ duration: 5, ease: [0.15, 0, 0.15, 1] }}
      >
        {customImage ? (
          <div className="relative w-full h-full">
            <img src={customImage} className="w-full h-full object-cover" alt="Wheel" referrerPolicy="no-referrer" />
            <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 pointer-events-none">
              {students.map((name, i) => {
                const angle = i * angleStep + angleStep / 2;
                const textStart = total > 40 ? radius * 0.4 : total > 20 ? radius * 0.3 : radius * 0.2;
                
                return (
                  <text
                    key={i}
                    x={center + textStart}
                    y={center}
                    fill="white"
                    stroke="black"
                    strokeWidth="0.5"
                    fontSize={total > 40 ? "8" : total > 20 ? "10" : "12"}
                    fontWeight="900"
                    textAnchor="start"
                    dominantBaseline="middle"
                    transform={`rotate(${angle - 90}, ${center}, ${center})`}
                    className="drop-shadow-md"
                    style={{ paintOrder: 'stroke' }}
                  >
                    {name.length > 20 ? name.substring(0, 18) + '..' : name}
                  </text>
                );
              })}
            </svg>
          </div>
        ) : (
          <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
            {students.map((name, i) => {
              const startAngle = i * angleStep;
              const endAngle = (i + 1) * angleStep;
              const x1 = center + radius * Math.cos((Math.PI * (startAngle - 90)) / 180);
              const y1 = center + radius * Math.sin((Math.PI * (startAngle - 90)) / 180);
              const x2 = center + radius * Math.cos((Math.PI * (endAngle - 90)) / 180);
              const y2 = center + radius * Math.sin((Math.PI * (endAngle - 90)) / 180);
              
              const largeArcFlag = angleStep > 180 ? 1 : 0;
              const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
              
              const colors = [
                '#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
                '#EF4444', '#8B5CF6', '#D946EF', '#06B6D4', '#84CC16', '#F97316'
              ];
              
              const angle = startAngle + angleStep / 2;
              const textStart = total > 40 ? radius * 0.4 : total > 20 ? radius * 0.3 : radius * 0.2;
              
              return (
                <g key={i}>
                  <path d={pathData} fill={colors[i % colors.length]} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                  <text
                    x={center + textStart}
                    y={center}
                    fill="white"
                    fontSize={total > 40 ? "8" : total > 20 ? "10" : "12"}
                    fontWeight="bold"
                    textAnchor="start"
                    dominantBaseline="middle"
                    transform={`rotate(${angle - 90}, ${center}, ${center})`}
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                  >
                    {name.length > 20 ? name.substring(0, 18) + '..' : name}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </motion.div>
      {/* Center Pin */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-xl z-10 flex items-center justify-center border-4 border-indigo-50">
        <div className="w-6 h-6 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-full shadow-inner" />
      </div>
    </div>
  );
};

interface GameGeneratorProps {
  onBack: () => void;
}

export const GameGenerator = ({ onBack }: GameGeneratorProps) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [game, setGame] = useState<GameContent | null>(null);
  const [savedGames, setSavedGames] = useState<any[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isManualWheel, setIsManualWheel] = useState(false);
  const [isManualPuzzle, setIsManualPuzzle] = useState(false);
  const [isManualMaze, setIsManualMaze] = useState(false);
  const [isManualRPG, setIsManualRPG] = useState(false);
  const [rpgQuestions, setRpgQuestions] = useState<Question[]>([]);
  
  // Manual Wheel State
  const [manualStudents, setManualStudents] = useState<string[]>([]);
  const [manualStudentsText, setManualStudentsText] = useState('');
  const [manualQuestions, setManualQuestions] = useState<Question[]>([]);
  const [wheelImage, setWheelImage] = useState<string | null>(null);
  const studentInputRef = useRef<HTMLInputElement>(null);
  const wheelImageInputRef = useRef<HTMLInputElement>(null);

  // Manual Puzzle State
  const [puzzleImage, setPuzzleImage] = useState<string | null>(null);
  const [puzzleQuestions, setPuzzleQuestions] = useState<Question[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Manual Maze State
  const [mazeQuestions, setMazeQuestions] = useState<Question[]>([]);

  // RPG State
  const [rpgState, setRpgState] = useState<{
    character: {
      name: string;
      type: string;
      hp: number;
      maxHp: number;
      attack: number;
      level: number;
      exp: number;
      gold: number;
      skills: { name: string; vfx: string }[];
    } | null;
    position: { x: number; y: number };
    defeatedMonsters: number;
    inventory: { healthPotions: number };
    mode: 'selection' | 'exploration' | 'battle' | 'gameOver' | 'newMap';
    currentMonster: any | null;
    battleLog: string[];
    mapTheme: string;
    mapImage: string | null;
  }>({
    character: null,
    position: { x: 1, y: 1 },
    defeatedMonsters: 0,
    inventory: { healthPotions: 2 },
    mode: 'selection',
    currentMonster: null,
    battleLog: [],
    mapTheme: 'Cánh đồng Khởi đầu',
    mapImage: null
  });

  // Game State
  const [gameState, setGameState] = useState<any>(null);

  const getSafeId = (str: string) => {
    try {
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => 
        String.fromCharCode(parseInt(p1, 16))
      )).substring(0, 20);
    } catch (e) {
      return str.replace(/[^a-z0-9]/gi, '').substring(0, 20);
    }
  };

  const saveRPGProgress = async () => {
    if (!auth.currentUser || !game || game.type !== 'rpg' || !rpgState.character) return;

    try {
      const gameId = getSafeId(game.title);
      const progressRef = doc(db, `users/${auth.currentUser.uid}/rpg_progress`, gameId);
      await setDoc(progressRef, {
        userId: auth.currentUser.uid,
        gameId,
        character: rpgState.character,
        position: rpgState.position,
        defeatedMonsters: rpgState.defeatedMonsters,
        inventory: rpgState.inventory,
        mapTheme: rpgState.mapTheme,
        mapImage: rpgState.mapImage,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rpg_progress');
    }
  };

  useEffect(() => {
    if (game?.type === 'rpg' && rpgState.character) {
      saveRPGProgress();
    }
  }, [rpgState.character, rpgState.position, rpgState.defeatedMonsters, rpgState.inventory, rpgState.mapTheme, rpgState.mapImage]);

  const loadRPGProgress = async (gameTitle: string) => {
    if (!auth.currentUser) return;

    try {
      const gameId = getSafeId(gameTitle);
      const progressRef = doc(db, `users/${auth.currentUser.uid}/rpg_progress`, gameId);
      const snap = await getDoc(progressRef);
      if (snap.exists()) {
        const data = snap.data();
        setRpgState({
          character: data.character,
          position: data.position,
          defeatedMonsters: data.defeatedMonsters,
          inventory: data.inventory,
          mode: 'exploration',
          currentMonster: null,
          battleLog: ['Đã tải tiến trình gần nhất.'],
          mapTheme: data.mapTheme || 'Vùng đất đã lưu',
          mapImage: data.mapImage || 'https://picsum.photos/seed/rpgmap/1280/720'
        });
      }
    } catch (error) {
      console.error('Error loading RPG progress:', error);
    }
  };

  const fetchSavedGames = async () => {
    if (!auth.currentUser) return;
    setIsLoadingSaved(true);
    try {
      const gamesRef = collection(db, `users/${auth.currentUser.uid}/games`);
      const q = query(gamesRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const games = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedGames(games);
    } catch (err) {
      console.error('Error fetching saved games:', err);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  useEffect(() => {
    fetchSavedGames();
  }, []);

  const handleSelectSavedGame = (savedGame: any) => {
    const g = savedGame.gameData;
    setGame(g);
    setPrompt(savedGame.prompt || '');
    
    // Initialize game state based on type
    if (g.type === 'adventure') {
      setGameState({ currentNode: g.content.startNode });
    } else if (g.type === 'quiz') {
      setGameState({ currentQuestion: 0, score: 0, finished: false });
    } else if (g.type === 'logic') {
      setGameState({ currentPuzzle: 0, solved: false, showHint: false });
    } else if (g.type === 'wheel') {
      setGameState({ spinning: false, countdown: 0, winner: null, challenges: [], rotation: 0, currentQuestion: null, showResult: false, isCorrect: null });
    } else if (g.type === 'puzzle') {
      setGameState({ revealedPieces: [], currentQuestion: null, showResult: false, isCorrect: null, finished: false, showFullScreen: false });
    } else if (g.type === 'maze') {
      const size = 8;
      const maze = generateMazeData(size);
      setGameState({ 
        playerPos: { r: 0, c: 0 },
        maze,
        size,
        currentQuestionIdx: 0,
        showQuestion: false,
        finished: false,
        visited: [{ r: 0, c: 0 }]
      });
    } else if (g.type === 'rpg') {
      loadRPGProgress(g.title).then(() => {
        if (!rpgState.character) {
          setRpgState({
            character: null,
            position: { x: 1, y: 1 },
            defeatedMonsters: 0,
            inventory: { healthPotions: 2 },
            mode: 'selection',
            currentMonster: null,
            battleLog: [],
            mapTheme: g.content.worldName || 'Vương quốc Tri Thức',
            mapImage: 'https://picsum.photos/seed/rpgmap/1280/720'
          });
        }
      });
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      setPrompt(prev => prev + ' ' + event.results[0][0].transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setPuzzleImage(evt.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleWheelImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setWheelImage(evt.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleManualPuzzleStart = () => {
    if (!puzzleImage) {
      setError('Vui lòng tải lên ảnh nền!');
      return;
    }
    if (puzzleQuestions.length === 0) {
      setError('Vui lòng nhập danh sách câu hỏi!');
      return;
    }

    const shuffledQuestions = shuffleQuestionOptions(puzzleQuestions);

    const manualGame: GameContent = {
      title: 'Mở Mảnh Ghép',
      description: 'Trả lời đúng các câu hỏi để lật mở bức hình bí ẩn.',
      type: 'puzzle',
      content: {
        image: puzzleImage,
        questions: shuffledQuestions
      }
    };

    setGame(manualGame);
    setGameState({ 
      revealedPieces: [], 
      currentQuestion: null,
      showResult: false,
      isCorrect: null,
      finished: false,
      showFullScreen: false
    });
    setIsManualPuzzle(false);
  };

  const handleManualMazeStart = () => {
    if (mazeQuestions.length === 0) {
      setError('Vui lòng nhập danh sách câu hỏi!');
      return;
    }

    const shuffledQuestions = shuffleQuestionOptions(mazeQuestions);

    const manualGame: GameContent = {
      title: 'Mê Cung Trí Tuệ',
      description: 'Vượt qua mê cung bằng cách trả lời các câu hỏi tại mỗi ngã rẽ.',
      type: 'maze',
      content: {
        questions: shuffledQuestions
      }
    };

    const size = 8;
    const maze = generateMazeData(size);

    setGame(manualGame);
    setGameState({ 
      playerPos: { r: 0, c: 0 },
      maze,
      size,
      currentQuestionIdx: 0,
      showQuestion: false,
      finished: false,
      visited: [{ r: 0, c: 0 }]
    });
    setIsManualMaze(false);
  };

  const generateMazeData = (size: number) => {
    const grid = Array(size).fill(0).map(() => Array(size).fill(0).map(() => ({
      visited: false,
      walls: { top: true, right: true, bottom: true, left: true }
    })));

    const stack: [number, number][] = [];
    let current: [number, number] = [0, 0];
    grid[0][0].visited = true;
    let visitedCount = 1;

    while (visitedCount < size * size) {
      const [r, c] = current;
      const neighbors: [number, number, string][] = [];

      if (r > 0 && !grid[r-1][c].visited) neighbors.push([r-1, c, 'top']);
      if (r < size - 1 && !grid[r+1][c].visited) neighbors.push([r+1, c, 'bottom']);
      if (c > 0 && !grid[r][c-1].visited) neighbors.push([r, c-1, 'left']);
      if (c < size - 1 && !grid[r][c+1].visited) neighbors.push([r, c+1, 'right']);

      if (neighbors.length > 0) {
        const [nr, nc, dir] = neighbors[Math.floor(Math.random() * neighbors.length)];
        if (dir === 'top') { grid[r][c].walls.top = false; grid[nr][nc].walls.bottom = false; }
        if (dir === 'bottom') { grid[r][c].walls.bottom = false; grid[nr][nc].walls.top = false; }
        if (dir === 'left') { grid[r][c].walls.left = false; grid[nr][nc].walls.right = false; }
        if (dir === 'right') { grid[r][c].walls.right = false; grid[nr][nc].walls.left = false; }
        grid[nr][nc].visited = true;
        visitedCount++;
        stack.push(current);
        current = [nr, nc];
      } else if (stack.length > 0) {
        current = stack.pop()!;
      }
    }
    return grid;
  };

  const handleManualRPGStart = () => {
    if (rpgQuestions.length === 0) {
      setError('Vui lòng nhập ít nhất một câu hỏi.');
      return;
    }
    const shuffledQuestions = shuffleQuestionOptions(rpgQuestions);

    setGame({
      title: 'Hành Trình Tri Thức (Thủ công)',
      description: 'Khám phá thế giới và chiến đấu bằng tri thức.',
      type: 'rpg',
      content: {
        worldName: 'Vương quốc Tri Thức',
        story: 'Vương quốc đang bị đe dọa bởi sự thiếu hụt kiến thức. Hãy lên đường giải cứu!',
        questions: shuffledQuestions,
        monsters: [
          { name: 'Quái vật Lười Biếng', hp: 50, attack: 10, image: 'monster1' },
          { name: 'Bóng Ma Thiếu Hiểu Biết', hp: 70, attack: 15, image: 'monster2' },
          { name: 'Rồng Quên Lãng', hp: 100, attack: 20, image: 'monster3' }
        ]
      }
    });
    setRpgState({
      character: null,
      position: { x: 1, y: 1 },
      defeatedMonsters: 0,
      inventory: { healthPotions: 2 },
      mode: 'selection',
      currentMonster: null,
      battleLog: [],
      mapTheme: 'Cánh đồng Khởi đầu',
      mapImage: 'https://picsum.photos/seed/rpgmap/1280/720'
    });
    setIsManualRPG(false);
  };

  const handleGenerate = async () => {
    if (!prompt) {
      setError('Vui lòng nhập ý tưởng trò chơi!');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGame(null);
    setGameState(null);

    try {
      const generatedGame = await generateGame(prompt);
      
      // Shuffle questions if they exist
      if (generatedGame.content.questions) {
        generatedGame.content.questions = shuffleQuestionOptions(generatedGame.content.questions);
      }
      
      // If it's a puzzle and the image is a description, generate it
      if (generatedGame.type === 'puzzle' && (!generatedGame.content.image || !generatedGame.content.image.startsWith('http'))) {
        try {
          const imageUrl = await generateImage({
            subject: generatedGame.content.image || generatedGame.title,
            actionContext: `A high quality, vibrant image for a puzzle game about ${generatedGame.title}`,
            style: 'Digital Art',
            lighting: 'Bright',
            color: 'Vibrant',
            camera: 'Eye level'
          });
          generatedGame.content.image = imageUrl;
        } catch (imgErr) {
          console.error("Failed to generate puzzle image:", imgErr);
          generatedGame.content.image = 'https://picsum.photos/seed/puzzle/1280/720';
        }
      }

      setGame(generatedGame);
      
      // Save game to Firestore
      if (auth.currentUser) {
        try {
          const gameId = getSafeId(generatedGame.title);
          const gameRef = doc(db, `users/${auth.currentUser.uid}/games`, gameId);
          await setDoc(gameRef, {
            userId: auth.currentUser.uid,
            prompt,
            gameData: generatedGame,
            createdAt: serverTimestamp()
          });
          fetchSavedGames(); // Refresh list
        } catch (saveErr) {
          console.error("Failed to save game:", saveErr);
        }
      }
      
      // Initialize game state based on type
      if (generatedGame.type === 'adventure') {
        setGameState({ currentNode: generatedGame.content.startNode });
      } else if (generatedGame.type === 'quiz') {
        setGameState({ currentQuestion: 0, score: 0, finished: false });
      } else if (generatedGame.type === 'logic') {
        setGameState({ currentPuzzle: 0, solved: false, showHint: false });
      } else if (generatedGame.type === 'wheel') {
        setGameState({ spinning: false, countdown: 0, winner: null, challenges: [], rotation: 0, currentQuestion: null, showResult: false, isCorrect: null });
      } else if (generatedGame.type === 'puzzle') {
        setGameState({ revealedPieces: [], currentQuestion: null, showResult: false, isCorrect: null, finished: false, showFullScreen: false });
      } else if (generatedGame.type === 'maze') {
        const size = 8;
        const maze = generateMazeData(size);
        setGameState({ 
          playerPos: { r: 0, c: 0 },
          maze,
          size,
          currentQuestionIdx: 0,
          showQuestion: false,
          finished: false,
          visited: [{ r: 0, c: 0 }]
        });
      } else if (generatedGame.type === 'rpg') {
        setRpgState({
          character: null,
          position: { x: 1, y: 1 },
          defeatedMonsters: 0,
          inventory: { healthPotions: 2 },
          mode: 'selection',
          currentMonster: null,
          battleLog: [],
          mapTheme: generatedGame.content.worldName || 'Vương quốc Tri Thức',
          mapImage: 'https://picsum.photos/seed/rpgmap/1280/720'
        });
      }
    } catch (err) {
      setError('Có lỗi xảy ra khi tạo trò chơi. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStudentFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        const names = data.flat().filter(cell => cell && typeof cell === 'string' && cell.trim().length > 0);
        if (names.length === 0) throw new Error('Không tìm thấy danh sách tên trong file.');
        if (names.length > 60) {
          setError('Danh sách học sinh tối đa là 60 người. File của bạn có ' + names.length + ' người.');
          return;
        }
        setManualStudents(names);
        setManualStudentsText(names.join('\n'));
        setError(null);
      } catch (err: any) {
        setError('Lỗi khi đọc file Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleManualStudentsChange = (text: string) => {
    setManualStudentsText(text);
    const names = text.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    if (names.length > 60) {
      setError('Danh sách học sinh tối đa là 60 người.');
    } else {
      setError(null);
    }
    setManualStudents(names);
  };

  const parseQuestions = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsed: Question[] = [];
    let currentQ: Partial<Question> | null = null;

    lines.forEach(line => {
      const lowerLine = line.toLowerCase();
      if (lowerLine.startsWith('câu') || lowerLine.includes('?')) {
        if (currentQ && currentQ.text && currentQ.options?.length === 4) {
          parsed.push(currentQ as Question);
        }
        currentQ = { text: line, options: [], answerIndex: 0 };
      } else if (currentQ) {
        const match = line.match(/^([A-D])\.\s*(.*)/i);
        if (match) {
          let optionText = match[2];
          if (line.includes('(*)')) {
            currentQ.answerIndex = (currentQ.options?.length || 0);
            optionText = optionText.replace('(*)', '').trim();
          }
          currentQ.options?.push(optionText);
        }
      }
    });

    if (currentQ && currentQ.text && currentQ.options?.length === 4) {
      parsed.push(currentQ as Question);
    }
    return parsed;
  };

  const shuffleQuestionOptions = (questions: any[]): any[] => {
    if (!Array.isArray(questions)) return questions;
    
    return questions.map(q => {
      if (!q.options || !Array.isArray(q.options)) return q;
      
      const options = [...q.options];
      const answerKey = q.answerIndex !== undefined ? 'answerIndex' : 'answer';
      
      if (q[answerKey] === undefined) return q;

      const correctAnswer = options[q[answerKey]];
      
      const shuffled = options
        .map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value);
      
      const newAnswerIndex = shuffled.indexOf(correctAnswer);
      
      return {
        ...q,
        options: shuffled,
        [answerKey]: newAnswerIndex
      };
    });
  };

  const handleManualWheelStart = () => {
    if (manualStudents.length === 0) {
      setError('Vui lòng nhập danh sách học sinh!');
      return;
    }
    if (manualQuestions.length === 0) {
      setError('Vui lòng nhập danh sách câu hỏi!');
      return;
    }

    const shuffledQuestions = shuffleQuestionOptions(manualQuestions);

    const manualGame: GameContent = {
      title: 'Vòng Quay May Mắn',
      description: 'Trò chơi quay số chọn học sinh và trả lời câu hỏi.',
      type: 'wheel',
      content: {
        students: manualStudents,
        questions: shuffledQuestions.map(q => q.text), // Simplified for the existing renderWheel
        fullQuestions: shuffledQuestions, // Store full info for enhanced UI
        wheelImage: wheelImage
      }
    };

    setGame(manualGame);
    setGameState({ 
      spinning: false, 
      countdown: 0, 
      winner: null, 
      challenges: [],
      rotation: 0,
      currentQuestion: null,
      showResult: false,
      isCorrect: null
    });
    setIsManualWheel(false);
  };

  const renderAdventure = () => {
    if (!game || game.type !== 'adventure') return null;
    const node = game.content.nodes[gameState.currentNode];
    
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <p className="text-lg leading-relaxed text-neutral-800">{node.text}</p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {node.options.map((option: any, idx: number) => (
            <button
              key={idx}
              onClick={() => setGameState({ ...gameState, currentNode: option.nextNode })}
              className="w-full p-4 text-left bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-100 transition-all font-medium flex items-center justify-between group"
            >
              {option.text}
              <Play className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
        {node.options.length === 0 && (
          <button 
            onClick={() => setGameState({ currentNode: game.content.startNode })}
            className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <RefreshCcw className="w-5 h-5" /> Chơi lại
          </button>
        )}
      </div>
    );
  };

  const renderQuiz = () => {
    if (!game || game.type !== 'quiz') return null;
    const { currentQuestion, score, finished } = gameState;
    
    if (finished) {
      return (
        <div className="text-center space-y-6 py-8">
          <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Hoàn thành!</h3>
            <p className="text-neutral-500">Điểm số của bạn: {score}/{game.content.questions.length}</p>
          </div>
          <button 
            onClick={() => setGameState({ currentQuestion: 0, score: 0, finished: false })}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            Thử lại
          </button>
        </div>
      );
    }

    const question = game.content.questions[currentQuestion];
    
    const handleAnswer = (idx: number) => {
      const isCorrect = idx === question.answer;
      const nextScore = isCorrect ? score + 1 : score;
      const nextQuestion = currentQuestion + 1;
      
      if (nextQuestion >= game.content.questions.length) {
        setGameState({ ...gameState, score: nextScore, finished: true });
      } else {
        setGameState({ ...gameState, currentQuestion: nextQuestion, score: nextScore });
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center text-sm font-medium text-neutral-500">
          <span>Câu hỏi {currentQuestion + 1}/{game.content.questions.length}</span>
          <span>Điểm: {score}</span>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm text-center">
          <h3 className="text-xl font-bold text-neutral-800">{question.question}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {question.options.map((option: string, idx: number) => (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              className="p-4 text-center bg-white hover:bg-indigo-50 border border-neutral-200 hover:border-indigo-200 rounded-xl transition-all font-medium"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderLogic = () => {
    if (!game || game.type !== 'logic') return null;
    const { currentPuzzle, solved, showHint } = gameState;
    const puzzle = game.content.puzzles[currentPuzzle];
    const [userAnswer, setUserAnswer] = useState('');

    const checkAnswer = () => {
      if (userAnswer.toLowerCase().trim() === puzzle.answer.toLowerCase().trim()) {
        setGameState({ ...gameState, solved: true });
      } else {
        alert('Sai rồi, thử lại nhé!');
      }
    };

    const nextPuzzle = () => {
      const nextIdx = currentPuzzle + 1;
      if (nextIdx >= game.content.puzzles.length) {
        alert('Chúc mừng! Bạn đã giải hết các câu đố.');
        setGameState({ currentPuzzle: 0, solved: false, showHint: false });
      } else {
        setGameState({ currentPuzzle: nextIdx, solved: false, showHint: false });
        setUserAnswer('');
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center text-sm font-medium text-neutral-500">
          <span>Câu đố {currentPuzzle + 1}/{game.content.puzzles.length}</span>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm text-center space-y-4">
          <HelpCircle className="w-10 h-10 text-indigo-600 mx-auto opacity-50" />
          <h3 className="text-xl font-bold text-neutral-800">{puzzle.riddle}</h3>
        </div>
        
        {!solved ? (
          <div className="space-y-4">
            <input 
              type="text"
              placeholder="Nhập câu trả lời của bạn..."
              className="w-full px-6 py-4 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none text-center font-bold text-lg"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setGameState({ ...gameState, showHint: !showHint })}
                className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Lightbulb className="w-4 h-4" /> {showHint ? 'Ẩn gợi ý' : 'Gợi ý'}
              </button>
              <button 
                onClick={checkAnswer}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold"
              >
                Kiểm tra
              </button>
            </div>
            {showHint && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100"
              >
                Gợi ý: {puzzle.hint}
              </motion.p>
            )}
          </div>
        ) : (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-emerald-50 border border-emerald-100 p-8 rounded-2xl text-center space-y-4"
          >
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-2xl font-bold text-emerald-800">Chính xác!</h3>
            <p className="text-emerald-600">Đáp án là: {puzzle.answer}</p>
            <button 
              onClick={nextPuzzle}
              className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold"
            >
              Câu đố tiếp theo
            </button>
          </motion.div>
        )}
      </div>
    );
  };

  const renderWheel = () => {
    if (!game || game.type !== 'wheel') return null;
    const { spinning, rotation, winner, challenges } = gameState;

    const spin = async () => {
      if (spinning) return;

      const students = game.content.students;
      const questions = game.content.fullQuestions || game.content.questions.map((q: string) => ({ text: q, options: [], answerIndex: -1 }));
      
      const winnerIndex = Math.floor(Math.random() * students.length);
      const luckyStudent = students[winnerIndex];
      const luckyQuestion = questions[Math.floor(Math.random() * questions.length)];

      const angleStep = 360 / students.length;
      const extraSpins = 5 + Math.floor(Math.random() * 5);
      const targetRotation = rotation + (extraSpins * 360) + (360 - (winnerIndex * angleStep + angleStep / 2));

      setGameState({ 
        ...gameState, 
        spinning: true, 
        winner: null, 
        challenges: [],
        currentQuestion: null,
        showResult: false,
        isCorrect: null,
        rotation: targetRotation
      });
      
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 4000));

      setGameState(prev => ({ 
        ...prev,
        spinning: false, 
        winner: luckyStudent, 
        challenges: [luckyQuestion.text],
        currentQuestion: luckyQuestion
      }));
    };

    const handleAnswer = (idx: number) => {
      if (!gameState.currentQuestion) return;
      const correct = idx === gameState.currentQuestion.answerIndex;
      setGameState(prev => ({ ...prev, isCorrect: correct, showResult: true }));
    };

    return (
      <div className={`space-y-8 mx-auto transition-all duration-500 ${winner && !spinning ? 'max-w-5xl' : 'max-w-xl'}`}>
        {/* Fullscreen Wheel while spinning */}
        {spinning && (
          <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative w-full max-w-4xl aspect-square flex items-center justify-center"
            >
              <div className="scale-[1.2] sm:scale-[1.8] md:scale-[2]">
                <WheelComponent 
                  students={game.content.students} 
                  rotation={rotation} 
                  customImage={game.content.wheelImage} 
                />
              </div>
            </motion.div>
            
            <div className="mt-12 text-center space-y-6 relative z-10">
              <h3 className="text-3xl sm:text-5xl font-black animate-pulse text-indigo-600 tracking-tight">
                ĐANG TÌM CHỦ NHÂN MAY MẮN...
              </h3>
              <div className="flex justify-center gap-3">
                {[0, 0.2, 0.4].map((delay) => (
                  <div 
                    key={delay}
                    className="w-4 h-4 bg-indigo-600 rounded-full animate-bounce" 
                    style={{ animationDelay: `${delay}s` }} 
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Normal view before spinning */}
        {!winner && !spinning && (
          <>
            <div className="py-8">
              <WheelComponent 
                students={game.content.students} 
                rotation={rotation} 
                customImage={game.content.wheelImage} 
              />
            </div>
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Sẵn sàng quay số?</h3>
                <p className="text-neutral-500">Nhấn nút bên dưới để tìm chủ nhân may mắn của thử thách hôm nay!</p>
              </div>
              <button
                onClick={spin}
                className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-3 mx-auto"
              >
                <RefreshCcw className="w-6 h-6" /> QUAY NGAY
              </button>
            </div>
          </>
        )}

        {/* Result view after spinning (Wheel disappears) */}
        {winner && !spinning && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 w-full"
          >
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
              {/* Congratulations Banner */}
              <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[2.5rem] text-white text-center shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[300px]">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Trophy className="w-32 h-32" />
                </div>
                <Star className="w-8 h-8 text-amber-400 mx-auto mb-4 fill-current" />
                <p className="text-indigo-100 font-bold uppercase tracking-widest text-xs mb-2">Chúc mừng bạn</p>
                <h3 className="text-4xl font-black mb-6 leading-tight">{winner.toUpperCase()}</h3>
                <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full text-xs font-bold backdrop-blur-sm mx-auto">
                  <Trophy className="w-4 h-4 text-amber-400" /> Chủ nhân may mắn
                </div>
              </div>

              {/* Question Section */}
              {gameState.currentQuestion && (
                <div className="lg:col-span-3 bg-white p-8 rounded-[2.5rem] border border-neutral-200 shadow-xl space-y-6 flex flex-col justify-center">
                  <div className="space-y-4">
                    <h4 className="font-bold text-neutral-400 uppercase tracking-widest text-[10px] flex items-center gap-2">
                      <HelpCircle className="w-4 h-4" /> Thử thách dành cho bạn
                    </h4>
                    <p className="text-2xl font-black text-neutral-800 leading-snug">{gameState.currentQuestion.text}</p>
                  </div>
                  
                  {gameState.currentQuestion.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {gameState.currentQuestion.options.map((opt: string, idx: number) => (
                        <button
                          key={idx}
                          disabled={gameState.showResult}
                          onClick={() => handleAnswer(idx)}
                          className={`p-4 text-left rounded-2xl border-2 transition-all font-bold flex items-center gap-3 group ${
                            gameState.showResult 
                              ? idx === gameState.currentQuestion.answerIndex
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                : 'bg-neutral-50 border-neutral-100 text-neutral-400'
                              : 'bg-white border-neutral-100 hover:border-indigo-500 hover:bg-indigo-50 text-neutral-700'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                            gameState.showResult && idx === gameState.currentQuestion.answerIndex
                              ? 'bg-emerald-500 text-white'
                              : 'bg-neutral-100 text-neutral-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                          }`}>
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <span className="text-sm">{opt}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {gameState.showResult && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`p-5 rounded-2xl text-center font-black text-xl shadow-inner ${
                        gameState.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {gameState.isCorrect ? 'CHÍNH XÁC! 🎉' : 'TIẾC QUÁ, SAI RỒI! 😢'}
                    </motion.div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-center pt-4">
              <button
                onClick={spin}
                className="w-full max-w-md py-5 bg-neutral-900 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-neutral-800 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
              >
                <RefreshCcw className="w-6 h-6" /> QUAY TIẾP
              </button>
            </div>
          </motion.div>
        )}
      </div>
    );
  };

  const renderPuzzle = () => {
    if (!game || game.type !== 'puzzle') return null;
    const { revealedPieces, currentQuestion, showResult, isCorrect, finished } = gameState;
    const questions = game.content.questions;
    const totalPieces = questions.length;

    // Calculate grid columns
    const cols = Math.ceil(Math.sqrt(totalPieces));
    const rows = Math.ceil(totalPieces / cols);

    const handlePieceClick = (idx: number) => {
      if (revealedPieces.includes(idx) || currentQuestion !== null) return;
      setGameState({ ...gameState, currentQuestion: idx, showResult: false, isCorrect: null });
    };

    const handleAnswer = (answerIdx: number) => {
      const question = questions[currentQuestion];
      const correct = answerIdx === question.answerIndex;
      
      if (correct) {
        const nextRevealed = [...revealedPieces, currentQuestion];
        const isFinished = nextRevealed.length === totalPieces;
        setGameState({ 
          ...gameState, 
          isCorrect: true, 
          showResult: true, 
          revealedPieces: nextRevealed,
          finished: isFinished,
          showFullScreen: isFinished
        });
      } else {
        setGameState({ ...gameState, isCorrect: false, showResult: true });
      }
    };

    const revealAll = () => {
      const allPieces = Array.from({ length: totalPieces }, (_, i) => i);
      setGameState({ 
        ...gameState, 
        revealedPieces: allPieces, 
        finished: true,
        showFullScreen: true,
        currentQuestion: null,
        showResult: false
      });
    };

    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Puzzle Board */}
          <div className="space-y-4">
            <div className="relative aspect-video bg-neutral-200 rounded-[2rem] overflow-hidden shadow-2xl border-8 border-white">
              {/* The Actual Image (Hidden behind pieces) */}
              <img 
                src={game.content.image} 
                className="absolute inset-0 w-full h-full object-cover"
                alt="Hidden"
                referrerPolicy="no-referrer"
              />

              {/* Puzzle Grid - The "Covers" */}
              <div 
                className="absolute inset-0 grid"
                style={{ 
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gridTemplateRows: `repeat(${rows}, 1fr)`
                }}
              >
                {Array.from({ length: totalPieces }).map((_, i) => {
                  const isRevealed = revealedPieces.includes(i);
                  return (
                    <motion.div
                      key={i}
                      onClick={() => handlePieceClick(i)}
                      initial={false}
                      animate={{ 
                        rotateY: isRevealed ? 180 : 0,
                        opacity: isRevealed ? 0 : 1,
                        scale: isRevealed ? 1.1 : 1,
                      }}
                      transition={{ 
                        duration: 0.8, 
                        ease: "circOut"
                      }}
                      className={`relative cursor-pointer ${isRevealed ? 'pointer-events-none' : 'z-10'}`}
                      style={{ perspective: '1000px' }}
                    >
                      {/* Piece Cover */}
                      <div className="absolute inset-0 bg-indigo-600 border border-white/20 flex flex-col items-center justify-center text-white shadow-lg overflow-hidden group">
                        {/* Decorative pattern */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                          <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />
                        </div>
                        
                        <span className="font-black text-4xl drop-shadow-lg relative z-10">{i + 1}</span>
                        
                        {/* Hover effect */}
                        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300" />
                        
                        {/* Active indicator */}
                        {currentQuestion === i && (
                          <motion.div 
                            layoutId="activePiece"
                            className="absolute inset-0 border-4 border-amber-400 z-20 shadow-[0_0_20px_rgba(251,191,36,0.6)]"
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                          />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Victory Overlay removed to keep image unobstructed */}
            </div>
            
            <div className="flex justify-between items-center px-4 py-3 bg-white rounded-2xl border border-neutral-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <Grid3X3 className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Tiến độ khám phá</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-black text-neutral-800">{revealedPieces.length} / {totalPieces}</p>
                    <div className="w-24 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-indigo-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${(revealedPieces.length / totalPieces) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              {!finished && (
                <button 
                  onClick={revealAll}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-amber-100"
                >
                  <Grid3X3 className="w-4 h-4" /> Mở tất cả
                </button>
              )}
            </div>
          </div>

          {/* Question Area */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {currentQuestion !== null ? (
                <motion.div 
                  key={currentQuestion}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-indigo-600 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5" /> Mảnh ghép số {currentQuestion + 1}
                    </h4>
                    <button 
                      onClick={() => setGameState({ ...gameState, currentQuestion: null })}
                      className="p-1 hover:bg-neutral-100 rounded-full"
                    >
                      <X className="w-5 h-5 text-neutral-400" />
                    </button>
                  </div>

                  <p className="text-xl font-bold text-neutral-800 leading-tight">
                    {questions[currentQuestion].text}
                  </p>

                  <div className="grid grid-cols-1 gap-3">
                    {questions[currentQuestion].options.map((opt: string, idx: number) => (
                      <button
                        key={idx}
                        disabled={showResult}
                        onClick={() => handleAnswer(idx)}
                        className={`p-4 text-left rounded-2xl border-2 transition-all font-bold flex items-center gap-3 ${
                          showResult 
                            ? idx === questions[currentQuestion].answerIndex
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                              : isCorrect === false && idx === questions[currentQuestion].answerIndex // Not needed but for clarity
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                : 'bg-neutral-50 border-neutral-100 text-neutral-400'
                            : 'bg-white border-neutral-100 hover:border-indigo-500 hover:bg-indigo-50 text-neutral-700'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          showResult && idx === questions[currentQuestion].answerIndex
                            ? 'bg-emerald-500 text-white'
                            : 'bg-neutral-100 text-neutral-500'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        {opt}
                      </button>
                    ))}
                  </div>

                  {showResult && (
                    <div className="space-y-4">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-4 rounded-2xl text-center font-black text-xl ${
                          isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {isCorrect ? 'CHÍNH XÁC! 🎉' : 'SAI RỒI! 😢'}
                      </motion.div>
                      <button
                        onClick={() => setGameState({ ...gameState, currentQuestion: null })}
                        className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold"
                      >
                        Tiếp tục
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : finished ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 text-center space-y-6"
                >
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border-4 border-emerald-500">
                    <Trophy className="w-10 h-10 text-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-2xl font-black text-emerald-900">BẠN ĐÃ CHIẾN THẮNG!</h4>
                    <p className="text-emerald-600">Chúc mừng bạn đã lật mở hoàn toàn bức hình bí ẩn.</p>
                  </div>
                  <button
                    onClick={() => setGameState({ revealedPieces: [], currentQuestion: null, showResult: false, isCorrect: null, finished: false, showFullScreen: false })}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg"
                  >
                    <RefreshCcw className="w-5 h-5" /> Chơi lại
                  </button>
                  <button
                    onClick={() => setGameState({ ...gameState, showFullScreen: true })}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg mt-3"
                  >
                    <ImageIcon className="w-5 h-5" /> Xem ảnh nền
                  </button>
                </motion.div>
              ) : (
                <div className="bg-indigo-50 p-8 rounded-3xl border border-indigo-100 text-center space-y-4">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <Grid3X3 className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-indigo-900">Chọn một mảnh ghép</h4>
                    <p className="text-sm text-indigo-600">Trả lời đúng để lật mở bức hình bí ẩn bên dưới.</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <AnimatePresence>
          {gameState.showFullScreen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4"
            >
              <button 
                onClick={() => setGameState({ ...gameState, showFullScreen: false })}
                className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-[110]"
              >
                <X className="w-8 h-8" />
              </button>
              <img 
                src={game.content.image} 
                className="max-w-full max-h-full object-contain shadow-2xl"
                alt="Revealed"
                referrerPolicy="no-referrer"
              />
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 text-center"
              >
                <h2 className="text-4xl font-black text-white drop-shadow-lg mb-2">Chúc mừng!</h2>
                <p className="text-white/70 text-lg">Bạn đã khám phá toàn bộ bức hình bí ẩn.</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderRPG = () => {
    if (!game || game.type !== 'rpg') return null;

    const handleSelectCharacter = (type: string) => {
      const baseStats: Record<string, any> = {
        Warrior: { hp: 120, attack: 15, skills: [{ name: 'Cú chém sấm sét', vfx: '⚡' }] },
        Archer: { hp: 100, attack: 20, skills: [{ name: 'Mưa tên hỏa lực', vfx: '🔥' }] },
        Mage: { hp: 80, attack: 25, skills: [{ name: 'Cầu lửa hỏa ngục', vfx: '💥' }] }
      };

      const stats = baseStats[type];
      const typeMap: Record<string, string> = {
        Warrior: 'Chiến binh',
        Archer: 'Cung thủ',
        Mage: 'Pháp sư'
      };

      setRpgState(prev => ({
        ...prev,
        character: {
          name: 'Người chơi 1',
          type: typeMap[type],
          hp: stats.hp,
          maxHp: stats.hp,
          attack: stats.attack,
          level: 1,
          exp: 0,
          gold: 50,
          skills: stats.skills
        },
        mode: 'exploration'
      }));
    };

    const handleMove = (dx: number, dy: number) => {
      setRpgState(prev => {
        const newX = Math.max(0, Math.min(4, prev.position.x + dx));
        const newY = Math.max(0, Math.min(4, prev.position.y + dy));
        
        // Random encounter chance
        if (Math.random() < 0.2) {
          const monster = game.content.monsters[Math.floor(Math.random() * game.content.monsters.length)];
          return {
            ...prev,
            position: { x: newX, y: newY },
            mode: 'battle',
            currentMonster: { ...monster, currentHp: monster.hp },
            battleLog: [`Bạn đã chạm trán ${monster.name}!`]
          };
        }

        return { ...prev, position: { x: newX, y: newY } };
      });
    };

  const generateNewMap = async () => {
    if (!game || game.type !== 'rpg') return;
    
    setRpgState(prev => ({ ...prev, mode: 'newMap' }));
    
    const themes = [
      { name: 'Rừng Phép Thuật', prompt: 'A magical glowing forest with floating lights and ancient trees' },
      { name: 'Núi Tuyết Vĩnh Cửu', prompt: 'Majestic snowy mountains with crystal clear ice and blue sky' },
      { name: 'Sa Mạc Tri Thức', prompt: 'Golden sand dunes with ancient ruins and oasis' },
      { name: 'Thành Phố Trên Mây', prompt: 'Futuristic city floating above clouds with white marble buildings' },
      { name: 'Đại Dương Sâu Thẳm', prompt: 'Underwater kingdom with colorful corals and glowing fish' }
    ];
    
    const theme = themes[Math.floor(Math.random() * themes.length)];
    
    try {
      const mapImageUrl = await generateImage({
        subject: theme.name,
        actionContext: theme.prompt,
        style: 'Digital Art',
        lighting: 'Cinematic',
        color: 'Vibrant',
        camera: 'Wide angle'
      });

      // Generate new questions and monsters for this theme
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Tạo 10 câu hỏi trắc nghiệm và 3 quái vật mới cho chủ đề "${theme.name}" trong trò chơi giáo dục. 
        Trả về định dạng JSON: 
        {
          "questions": [{"text": "...", "options": ["...", "...", "...", "..."], "answerIndex": 0}],
          "monsters": [{"name": "...", "hp": 100, "attack": 20, "image": "mô tả hình ảnh quái vật"}]
        }` }] }],
        config: { responseMimeType: "application/json" }
      });

      const newData = JSON.parse(response.text || '{}');
      
      // Generate monster images
      const monstersWithImages = await Promise.all((newData.monsters || []).map(async (m: any) => {
        try {
          const img = await generateImage({
            subject: m.name,
            actionContext: m.image,
            style: 'Fantasy Art',
            lighting: 'Dramatic',
            color: 'Vibrant',
            camera: 'Close up'
          });
          return { ...m, image: img };
        } catch (e) {
          return { ...m, image: 'https://picsum.photos/seed/monster/400/400' };
        }
      }));

      setGame(prev => {
        if (!prev) return null;
        return {
          ...prev,
          content: {
            ...prev.content,
            questions: newData.questions || prev.content.questions,
            monsters: monstersWithImages.length > 0 ? monstersWithImages : prev.content.monsters
          }
        };
      });

      setRpgState(prev => ({
        ...prev,
        mode: 'exploration',
        defeatedMonsters: 0,
        mapTheme: theme.name,
        mapImage: mapImageUrl,
        battleLog: [`Chào mừng bạn đến với ${theme.name}!`]
      }));

    } catch (error) {
      console.error("Error generating new map:", error);
      setRpgState(prev => ({ ...prev, mode: 'exploration', defeatedMonsters: 0 }));
    }
  };

  const handleBattleAnswer = (isCorrect: boolean) => {
    if (!rpgState.currentMonster || !rpgState.character) return;

    if (isCorrect) {
      const damage = rpgState.character.attack + Math.floor(Math.random() * 5);
      const newMonsterHp = Math.max(0, rpgState.currentMonster.currentHp - damage);
      
      if (newMonsterHp === 0) {
        // Victory
        const expGain = 20;
        const goldGain = 10;
        const newExp = rpgState.character.exp + expGain;
        const levelUp = newExp >= 100;
        const newDefeatedCount = rpgState.defeatedMonsters + 1;

        setRpgState(prev => ({
          ...prev,
          character: prev.character ? {
            ...prev.character,
            exp: levelUp ? newExp - 100 : newExp,
            level: levelUp ? prev.character.level + 1 : prev.character.level,
            maxHp: levelUp ? prev.character.maxHp + 20 : prev.character.maxHp,
            hp: levelUp ? prev.character.maxHp + 20 : prev.character.hp,
            attack: levelUp ? prev.character.attack + 5 : prev.character.attack,
            gold: prev.character.gold + goldGain
          } : null,
          defeatedMonsters: newDefeatedCount,
          mode: 'exploration',
          currentMonster: null,
          battleLog: []
        }));

        if (newDefeatedCount >= 5) {
          generateNewMap();
        } else {
          alert(`Chiến thắng! Bạn nhận được ${expGain} XP và ${goldGain} Vàng.${levelUp ? ' CHÚC MỪNG! BẠN ĐÃ TĂNG CẤP!' : ''}`);
        }
      } else {
        setRpgState(prev => ({
          ...prev,
          currentMonster: prev.currentMonster ? { ...prev.currentMonster, currentHp: newMonsterHp } : null,
          battleLog: [...prev.battleLog, `Bạn tấn công gây ${damage} sát thương!`]
        }));
      }
    } else {
      const monsterDamage = rpgState.currentMonster.attack;
      const newPlayerHp = Math.max(0, rpgState.character.hp - monsterDamage);

      if (newPlayerHp === 0) {
        setRpgState(prev => ({
          ...prev,
          character: prev.character ? { ...prev.character, hp: 0 } : null,
          mode: 'gameOver',
          currentMonster: null,
          battleLog: []
        }));
      } else {
        setRpgState(prev => ({
          ...prev,
          character: prev.character ? { ...prev.character, hp: newPlayerHp } : null,
          battleLog: [...prev.battleLog, `Quái vật tấn công! Bạn mất ${monsterDamage} HP.`]
        }));
      }
    }
  };

    if (rpgState.mode === 'gameOver') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-32 h-32 bg-red-100 rounded-full flex items-center justify-center"
          >
            <Skull className="w-16 h-16 text-red-600" />
          </motion.div>
          <div className="space-y-2">
            <h2 className="text-6xl font-black text-red-600">TRÒ CHƠI KẾT THÚC</h2>
            <p className="text-neutral-500 text-xl">Bạn đã chiến đấu dũng cảm, nhưng quái vật quá mạnh...</p>
          </div>
          <button
            onClick={() => {
              setRpgState(prev => ({
                ...prev,
                character: prev.character ? { ...prev.character, hp: prev.character.maxHp } : null,
                mode: 'exploration',
                position: { x: 0, y: 0 }
              }));
            }}
            className="px-12 py-4 bg-red-600 text-white rounded-2xl font-black text-xl hover:bg-red-700 transition-all shadow-xl"
          >
            Hồi sinh tại Làng
          </button>
        </div>
      );
    }

    if (rpgState.mode === 'newMap') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 border-4 border-indigo-600 border-t-transparent rounded-full"
          />
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-indigo-600">Đang khai phá vùng đất mới...</h2>
            <p className="text-neutral-500">Hệ thống đang chọn bản đồ phù hợp với hành trình của bạn.</p>
          </div>
        </div>
      );
    }

    if (rpgState.mode === 'selection') {
      return (
        <div className="space-y-8 py-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-black text-neutral-900">Chọn Anh Hùng</h2>
            <p className="text-neutral-500">Mỗi anh hùng có sức mạnh và kỹ năng riêng biệt.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { type: 'Warrior', icon: Shield, color: 'bg-blue-500', desc: 'Giáp dày, HP cao, cận chiến.' },
              { type: 'Archer', icon: Sword, color: 'bg-green-500', desc: 'Linh hoạt, tấn công xa, chính xác.' },
              { type: 'Mage', icon: Zap, color: 'bg-purple-500', desc: 'Tấn công phép mạnh, HP thấp.' }
            ].map((hero) => (
              <motion.button
                key={hero.type}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelectCharacter(hero.type as any)}
                className="bg-white p-8 rounded-[2.5rem] border-2 border-neutral-100 shadow-xl hover:border-indigo-500 transition-all text-center space-y-4"
              >
                <div className={`w-20 h-20 ${hero.color} rounded-3xl flex items-center justify-center mx-auto shadow-lg`}>
                  <hero.icon className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-black text-neutral-800">{hero.type === 'Warrior' ? 'Chiến binh' : hero.type === 'Archer' ? 'Cung thủ' : 'Pháp sư'}</h3>
                <p className="text-sm text-neutral-500">{hero.desc}</p>
              </motion.button>
            ))}
          </div>
        </div>
      );
    }

    if (rpgState.mode === 'battle' && rpgState.currentMonster) {
      const question = game.content.questions[Math.floor(Math.random() * game.content.questions.length)];
      return (
        <div className="max-w-4xl mx-auto space-y-8 relative">
          {/* Battle Background */}
          <div className="absolute inset-0 -z-10 opacity-10 blur-xl">
            {rpgState.mapImage && <img src={rpgState.mapImage} className="w-full h-full object-cover rounded-[3rem]" referrerPolicy="no-referrer" />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Player Stats */}
            <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-neutral-200 shadow-lg space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-black text-lg">{rpgState.character?.type} (Lv.{rpgState.character?.level})</h4>
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <Heart className="w-4 h-4 text-red-500" /> {rpgState.character?.hp}/{rpgState.character?.maxHp}
                  </div>
                </div>
              </div>
              <div className="w-full bg-neutral-100 h-3 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(rpgState.character!.hp / rpgState.character!.maxHp) * 100}%` }}
                  className="bg-red-500 h-full"
                />
              </div>
            </div>

            {/* Monster Stats */}
            <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-neutral-200 shadow-lg space-y-4">
              <div className="flex items-center gap-4 justify-end text-right">
                <div>
                  <h4 className="font-black text-lg text-red-600">{rpgState.currentMonster.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-neutral-500 justify-end">
                    {rpgState.currentMonster.currentHp}/{rpgState.currentMonster.hp} <Skull className="w-4 h-4 text-neutral-400" />
                  </div>
                </div>
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center overflow-hidden">
                  {rpgState.currentMonster.image && rpgState.currentMonster.image.startsWith('http') ? (
                    <img src={rpgState.currentMonster.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Zap className="w-6 h-6 text-red-600" />
                  )}
                </div>
              </div>
              <div className="w-full bg-neutral-100 h-3 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(rpgState.currentMonster.currentHp / rpgState.currentMonster.hp) * 100}%` }}
                  className="bg-red-600 h-full ml-auto"
                />
              </div>
            </div>
          </div>

          {/* Monster Visual */}
          <div className="flex justify-center py-4">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-48 h-48 relative"
            >
              {rpgState.currentMonster.image && rpgState.currentMonster.image.startsWith('http') ? (
                <img src={rpgState.currentMonster.image} className="w-full h-full object-contain drop-shadow-2xl" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-red-100 rounded-full flex items-center justify-center">
                  <Skull className="w-24 h-24 text-red-600" />
                </div>
              )}
            </motion.div>
          </div>

          {/* Battle Question */}
          <div className="bg-indigo-900 p-8 rounded-[3rem] text-white shadow-2xl space-y-8">
            <div className="text-center space-y-4">
              <span className="px-4 py-1 bg-indigo-800 rounded-full text-xs font-bold uppercase tracking-widest">Lượt của bạn</span>
              <h3 className="text-2xl font-bold leading-relaxed">{question.text}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {question.options.map((option: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleBattleAnswer(idx === question.answerIndex)}
                  className="p-6 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl transition-all text-left font-bold text-lg flex items-center gap-4"
                >
                  <span className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-sm">{String.fromCharCode(65 + idx)}</span>
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Battle Log */}
          <div className="bg-neutral-900 p-4 rounded-2xl text-xs font-mono text-emerald-400 h-24 overflow-y-auto">
            {rpgState.battleLog.map((log, i) => (
              <div key={i}>{`> ${log}`}</div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-neutral-400 uppercase">Cấp độ {rpgState.character?.level}</p>
                <p className="font-black text-neutral-800">{rpgState.character?.type}</p>
              </div>
            </div>
            <div className="h-10 w-px bg-neutral-100" />
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              <div className="w-32 bg-neutral-100 h-2 rounded-full overflow-hidden">
                <div className="bg-red-500 h-full" style={{ width: `${(rpgState.character!.hp / rpgState.character!.maxHp) * 100}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500" />
              <span className="font-bold">{rpgState.character?.gold}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Backpack className="w-5 h-5 text-neutral-400" />
            <span className="text-sm font-bold text-neutral-600">{rpgState.inventory.healthPotions} Bình máu</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-neutral-100 p-8 rounded-[3rem] aspect-square relative overflow-hidden border-4 border-white shadow-inner">
            {/* Background Image */}
            {rpgState.mapImage && (
              <img src={rpgState.mapImage} className="absolute inset-0 w-full h-full object-cover opacity-30" referrerPolicy="no-referrer" />
            )}
            
            {/* Simple Grid Map */}
            <div className="grid grid-cols-5 grid-rows-5 h-full w-full gap-2 relative z-10">
              {Array.from({ length: 25 }).map((_, i) => {
                const x = i % 5;
                const y = Math.floor(i / 5);
                const isPlayer = rpgState.position.x === x && rpgState.position.y === y;
                return (
                  <div key={i} className="bg-white/40 backdrop-blur-sm rounded-xl flex items-center justify-center relative border border-white/20">
                    {isPlayer && (
                      <motion.div 
                        layoutId="player"
                        className="w-10 h-10 bg-indigo-600 rounded-xl shadow-lg flex items-center justify-center z-10"
                      >
                        <User className="w-6 h-6 text-white" />
                      </motion.div>
                    )}
                    {Math.random() < 0.1 && !isPlayer && <Skull className="w-4 h-4 text-neutral-400/50" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
              <h4 className="font-black text-neutral-800 flex items-center gap-2">
                <Compass className="w-5 h-5 text-indigo-500" /> {rpgState.mapTheme}
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div />
                <button onClick={() => handleMove(0, -1)} className="p-4 bg-neutral-50 hover:bg-neutral-100 rounded-2xl flex items-center justify-center transition-all">
                  <ArrowUp className="w-6 h-6" />
                </button>
                <div />
                <button onClick={() => handleMove(-1, 0)} className="p-4 bg-neutral-50 hover:bg-neutral-100 rounded-2xl flex items-center justify-center transition-all">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <button onClick={() => handleMove(0, 1)} className="p-4 bg-neutral-50 hover:bg-neutral-100 rounded-2xl flex items-center justify-center transition-all">
                  <ArrowDown className="w-6 h-6" />
                </button>
                <button onClick={() => handleMove(1, 0)} className="p-4 bg-neutral-50 hover:bg-neutral-100 rounded-2xl flex items-center justify-center transition-all">
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl space-y-4">
              <h4 className="font-black flex items-center gap-2">
                <Trophy className="w-5 h-5" /> Nhiệm vụ
              </h4>
              <p className="text-sm text-indigo-100">Tiêu diệt 5 quái vật để mở khóa khu vực mới.</p>
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Tiến trình</span>
                <span>{rpgState.defeatedMonsters}/5</span>
              </div>
              <div className="w-full bg-indigo-800 h-2 rounded-full overflow-hidden">
                <div className="bg-white h-full" style={{ width: `${(rpgState.defeatedMonsters / 5) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMaze = () => {
    if (!game || game.type !== 'maze') return null;
    const { playerPos, maze, size, currentQuestionIdx, showQuestion, finished, visited } = gameState;
    const questions = game.content.questions;

    const move = (dr: number, dc: number, dir: string) => {
      if (finished || showQuestion) return;
      
      const nr = playerPos.r + dr;
      const nc = playerPos.c + dc;

      if (nr < 0 || nr >= size || nc < 0 || nr >= size) return;
      
      // Check walls
      const currentCell = maze[playerPos.r][playerPos.c];
      if (currentCell.walls[dir]) return;

      // Check if this cell has a question (every intersection or every 3 steps)
      const isIntersection = Object.values(maze[nr][nc].walls).filter(w => !w).length > 2;
      const shouldAsk = isIntersection || (visited.length % 3 === 0);

      if (shouldAsk && currentQuestionIdx < questions.length) {
        setGameState({ ...gameState, showQuestion: true, pendingPos: { r: nr, c: nc } });
      } else {
        const nextVisited = [...visited, { r: nr, c: nc }];
        const isEnd = nr === size - 1 && nc === size - 1;
        setGameState({ 
          ...gameState, 
          playerPos: { r: nr, c: nc }, 
          visited: nextVisited,
          finished: isEnd
        });
      }
    };

    const handleAnswer = (idx: number) => {
      const question = questions[currentQuestionIdx];
      if (idx === question.answerIndex) {
        const nr = gameState.pendingPos.r;
        const nc = gameState.pendingPos.c;
        const nextVisited = [...visited, { r: nr, c: nc }];
        const isEnd = nr === size - 1 && nc === size - 1;
        setGameState({ 
          ...gameState, 
          playerPos: { r: nr, c: nc }, 
          visited: nextVisited,
          showQuestion: false,
          currentQuestionIdx: (currentQuestionIdx + 1) % questions.length,
          finished: isEnd
        });
      } else {
        setGameState({ ...gameState, showQuestion: false, error: 'Sai rồi! Hãy thử lại.' });
        setTimeout(() => setGameState(prev => ({ ...prev, error: null })), 2000);
      }
    };

    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Maze Board */}
          <div className="bg-white p-4 rounded-[2.5rem] shadow-xl border border-neutral-200">
            <div 
              className="grid gap-0 aspect-square bg-neutral-100 rounded-2xl overflow-hidden border-2 border-neutral-200"
              style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
            >
              {maze.map((row: any, r: number) => row.map((cell: any, c: number) => (
                <div 
                  key={`${r}-${c}`}
                  className={`relative border-neutral-300 ${cell.walls.top ? 'border-t-4 border-t-neutral-800' : ''} ${cell.walls.right ? 'border-r-4 border-r-neutral-800' : ''} ${cell.walls.bottom ? 'border-b-4 border-b-neutral-800' : ''} ${cell.walls.left ? 'border-l-4 border-l-neutral-800' : ''}`}
                >
                  {/* Visited Path */}
                  {visited.some((v: any) => v.r === r && v.c === c) && (
                    <div className="absolute inset-0 bg-indigo-100/50" />
                  )}
                  
                  {/* Start & End */}
                  {r === 0 && c === 0 && <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-indigo-600">BẮT ĐẦU</div>}
                  {r === size - 1 && c === size - 1 && <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-emerald-600"><Flag className="w-4 h-4" /></div>}
                  
                  {/* Player */}
                  {playerPos.r === r && playerPos.c === c && (
                    <motion.div 
                      layoutId="player"
                      className="absolute inset-2 bg-indigo-600 rounded-full shadow-lg z-10 flex items-center justify-center"
                    >
                      <User className="w-3 h-3 text-white" />
                    </motion.div>
                  )}
                </div>
              )))}
            </div>

            {/* Controls */}
            <div className="mt-6 grid grid-cols-3 gap-2 max-w-[180px] mx-auto">
              <div />
              <button onClick={() => move(-1, 0, 'top')} className="p-4 bg-neutral-100 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all flex justify-center"><ArrowUp /></button>
              <div />
              <button onClick={() => move(0, -1, 'left')} className="p-4 bg-neutral-100 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all flex justify-center"><ArrowLeft /></button>
              <button onClick={() => move(1, 0, 'bottom')} className="p-4 bg-neutral-100 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all flex justify-center"><ArrowDown /></button>
              <button onClick={() => move(0, 1, 'right')} className="p-4 bg-neutral-100 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all flex justify-center"><ArrowRight /></button>
            </div>
          </div>

          {/* Question Area */}
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {showQuestion ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white p-8 rounded-[2rem] border border-indigo-100 shadow-xl shadow-indigo-50 space-y-6"
                >
                  <div className="flex items-center gap-3 text-indigo-600">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <Lock className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold">Cửa ải thử thách</h4>
                  </div>
                  
                  <p className="text-lg font-bold text-neutral-800">{questions[currentQuestionIdx].text}</p>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {questions[currentQuestionIdx].options.map((opt: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => handleAnswer(i)}
                        className="w-full p-4 text-left bg-neutral-50 hover:bg-indigo-50 border border-neutral-200 hover:border-indigo-200 rounded-2xl transition-all font-medium"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : finished ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-50 p-8 rounded-[2rem] border border-emerald-100 text-center space-y-6"
                >
                  <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-emerald-900">CHIẾN THẮNG!</h3>
                    <p className="text-emerald-700">Bạn đã vượt qua mê cung thành công.</p>
                  </div>
                  <button 
                    onClick={() => setGameState({ ...gameState, playerPos: { r: 0, c: 0 }, visited: [{ r: 0, c: 0 }], finished: false, currentQuestionIdx: 0 })}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100"
                  >
                    Chơi lại
                  </button>
                </motion.div>
              ) : (
                <div className="bg-white p-8 rounded-[2rem] border border-neutral-200 shadow-sm text-center space-y-4">
                  <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto">
                    <Compass className="w-8 h-8 text-neutral-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-neutral-800">Đang thám hiểm...</h4>
                    <p className="text-sm text-neutral-500">Sử dụng các phím mũi tên để di chuyển trong mê cung.</p>
                  </div>
                  {gameState.error && (
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-red-500 font-bold text-sm"
                    >
                      {gameState.error}
                    </motion.p>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={onBack}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Gamepad2 className="w-6 h-6 text-indigo-600" />
                Trình Tạo Trò Chơi AI
                <div className="group relative">
                  <HelpCircle className="w-4 h-4 text-neutral-400 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-neutral-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 font-normal">
                    Sử dụng AI để thiết kế các trò chơi giáo dục tương tác như trắc nghiệm, giải đố, vòng quay, và nhập vai.
                  </div>
                </div>
              </h2>
            </div>

      {!game ? (
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: AI Generator */}
            <div className="lg:col-span-7 space-y-6">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {!isManualWheel && !isManualPuzzle && !isManualMaze && !isManualRPG ? (
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200 space-y-6">
                    <div className="text-center space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <h3 className="text-xl font-bold">Bạn muốn chơi gì hôm nay?</h3>
                        <div className="group relative">
                          <HelpCircle className="w-4 h-4 text-neutral-400 cursor-help" />
                          <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-neutral-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 font-normal">
                            Nhập mô tả về trò chơi bạn muốn tạo. AI sẽ tự động thiết kế nội dung, câu hỏi và cơ chế chơi phù hợp.
                          </div>
                        </div>
                      </div>
                      <p className="text-neutral-500">Mô tả ý tưởng trò chơi của bạn, AI sẽ tạo ra một trò chơi hoàn chỉnh.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        <textarea
                          placeholder="Ví dụ: Một trò chơi trắc nghiệm về lịch sử Việt Nam, hoặc một cuộc phiêu lưu trong rừng rậm..."
                          rows={4}
                          className="w-full px-6 py-4 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                        />
                        <button
                          onClick={startListening}
                          className={`absolute bottom-4 right-4 p-3 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}
                        >
                          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                      </div>

                      {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          onClick={handleGenerate}
                          disabled={isGenerating}
                          className="sm:col-span-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Đang thiết kế...
                            </>
                          ) : (
                            <>
                              <Play className="w-5 h-5" />
                              Tạo bằng AI
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setIsManualWheel(true)}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-amber-100 transition-all flex items-center justify-center gap-2 relative group"
                        >
                          <RefreshCcw className="w-5 h-5" />
                          Vòng Quay
                          <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <div className="bg-neutral-900 text-white text-[10px] p-2 rounded-lg w-48 font-normal shadow-xl">
                              Tạo vòng quay may mắn để chọn ngẫu nhiên học sinh và thử thách.
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => setIsManualPuzzle(true)}
                          className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-violet-100 transition-all flex items-center justify-center gap-2 relative group"
                        >
                          <Grid3X3 className="w-5 h-5" />
                          Mở Mảnh Ghép
                          <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <div className="bg-neutral-900 text-white text-[10px] p-2 rounded-lg w-48 font-normal shadow-xl">
                              Tạo trò chơi lật mảnh ghép để khám phá bức hình bí ẩn đằng sau các câu hỏi.
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => setIsManualMaze(true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2 relative group"
                        >
                          <MapIcon className="w-5 h-5" />
                          Mê Cung
                          <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <div className="bg-neutral-900 text-white text-[10px] p-2 rounded-lg w-48 font-normal shadow-xl">
                              Trò chơi mê cung đòi hỏi người chơi phải trả lời đúng các câu hỏi để tìm đường thoát.
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => setIsManualRPG(true)}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-2 relative group"
                        >
                          <Sword className="w-5 h-5" />
                          RPG Hành Trình
                          <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <div className="bg-neutral-900 text-white text-[10px] p-2 rounded-lg w-48 font-normal shadow-xl">
                              Trò chơi nhập vai phiêu lưu, chiến đấu với quái vật bằng cách trả lời các câu hỏi kiến thức.
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-4 border-t border-neutral-100">
                      <div className="text-center space-y-1">
                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mx-auto">
                          <Play className="w-5 h-5 text-indigo-600" />
                        </div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Phiêu lưu</p>
                      </div>
                      <div className="text-center space-y-1">
                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mx-auto">
                          <HelpCircle className="w-5 h-5 text-indigo-600" />
                        </div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Trắc nghiệm</p>
                      </div>
                      <div className="text-center space-y-1">
                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mx-auto">
                          <Lightbulb className="w-5 h-5 text-indigo-600" />
                        </div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Giải đố</p>
                      </div>
                      <div className="text-center space-y-1">
                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mx-auto">
                          <RefreshCcw className="w-5 h-5 text-indigo-600" />
                        </div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Vòng quay</p>
                      </div>
                      <div className="text-center space-y-1">
                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mx-auto">
                          <Grid3X3 className="w-5 h-5 text-indigo-600" />
                        </div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Mảnh ghép</p>
                      </div>
                      <div className="text-center space-y-1">
                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mx-auto">
                          <MapIcon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Mê cung</p>
                      </div>
                    </div>
                  </div>
                ) : isManualWheel ? (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={onBack}
                  className="px-4 py-2 bg-white border border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 transition-all flex items-center gap-2 text-sm font-bold shadow-sm"
                >
                  <Home className="w-4 h-4" /> Trang chủ
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Students Import */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-xl">
                      <Users className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold">Danh sách học sinh</h3>
                      <div className="group relative">
                        <HelpCircle className="w-4 h-4 text-neutral-400 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-neutral-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 font-normal">
                          Tải lên file Excel chứa danh sách tên học sinh (tối đa 60 người) để sử dụng trong vòng quay may mắn.
                        </div>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setIsManualWheel(false)} className="p-1 hover:bg-neutral-100 rounded-full">
                    <X className="w-5 h-5 text-neutral-400" />
                  </button>
                </div>
                
                <div 
                  onClick={() => studentInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-400 transition-colors bg-neutral-50"
                >
                  <Upload className="w-8 h-8 text-neutral-300" />
                  <p className="text-sm font-medium text-neutral-600">Tải lên file Excel</p>
                  <input 
                    type="file" 
                    ref={studentInputRef} 
                    className="hidden" 
                    accept=".xlsx, .xls" 
                    onChange={handleStudentFileUpload}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-bold text-neutral-600">Hoặc nhập tên thủ công (mỗi dòng một tên):</p>
                  <textarea 
                    className="w-full h-32 px-4 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                    placeholder="Nguyễn Văn A&#10;Trần Thị B..."
                    value={manualStudentsText}
                    onChange={(e) => handleManualStudentsChange(e.target.value)}
                  />
                </div>

                {manualStudents.length > 0 && (
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <p className="text-sm font-bold text-indigo-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Đã nhập {manualStudents.length} học sinh
                    </p>
                  </div>
                )}
              </div>

              {/* Wheel Preview */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4 flex flex-col items-center justify-center">
                <div className="flex items-center gap-3 w-full">
                  <div className="bg-indigo-100 p-2 rounded-xl">
                    <RefreshCcw className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-bold">Xem trước vòng quay</h3>
                </div>
                
                {manualStudents.length > 0 ? (
                  <div className="scale-75 origin-center">
                    <WheelComponent 
                      students={manualStudents} 
                      rotation={0} 
                      customImage={wheelImage || undefined} 
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 rounded-full border-4 border-dashed border-neutral-100 flex items-center justify-center text-neutral-300 text-center p-4">
                    <p className="text-xs">Nhập danh sách học sinh để xem trước vòng quay</p>
                  </div>
                )}
              </div>

              {/* Wheel Image Import */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-violet-100 p-2 rounded-xl">
                    <ImageIcon className="w-5 h-5 text-violet-600" />
                  </div>
                  <h3 className="text-lg font-bold">Hình ảnh vòng quay (Tùy chọn)</h3>
                </div>
                
                <div 
                  onClick={() => wheelImageInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-400 transition-colors bg-neutral-50 relative overflow-hidden group"
                >
                  {wheelImage ? (
                    <img src={wheelImage} className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" alt="Wheel" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-neutral-300" />
                  )}
                  <p className="text-sm font-medium text-neutral-600 relative z-10">{wheelImage ? 'Thay đổi ảnh vòng quay' : 'Tải lên ảnh vòng quay'}</p>
                  <input 
                    type="file" 
                    ref={wheelImageInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleWheelImageUpload}
                  />
                </div>
              </div>

              {/* Questions Import */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-xl">
                    <FileText className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-bold">Danh sách câu hỏi</h3>
                </div>

                <textarea 
                  className="w-full h-32 px-4 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                  placeholder="Câu 1: ...?&#10;A. ... (*)&#10;B. ..."
                  onChange={(e) => setManualQuestions(parseQuestions(e.target.value))}
                />
                
                {manualQuestions.length > 0 && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <p className="text-sm font-bold text-amber-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Đã nhập {manualQuestions.length} câu hỏi
                    </p>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 flex flex-col items-center gap-4">
                {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                <button
                  onClick={handleManualWheelStart}
                  className="w-full max-w-md bg-amber-500 hover:bg-amber-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-amber-100 transition-all flex items-center justify-center gap-2 text-xl"
                >
                  <Play className="w-6 h-6" /> BẮT ĐẦU CHƠI
                </button>
              </div>
            </div>
          </div>
          ) : isManualPuzzle ? (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={onBack}
                  className="px-4 py-2 bg-white border border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 transition-all flex items-center gap-2 text-sm font-bold shadow-sm"
                >
                  <Home className="w-4 h-4" /> Trang chủ
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Image Import */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-violet-100 p-2 rounded-xl">
                      <ImageIcon className="w-5 h-5 text-violet-600" />
                    </div>
                    <h3 className="text-lg font-bold">Ảnh nền bí ẩn</h3>
                  </div>
                  <button onClick={() => setIsManualPuzzle(false)} className="p-1 hover:bg-neutral-100 rounded-full">
                    <X className="w-5 h-5 text-neutral-400" />
                  </button>
                </div>
                
                <div 
                  onClick={() => imageInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-violet-400 transition-colors bg-neutral-50 aspect-video relative overflow-hidden"
                >
                  {puzzleImage ? (
                    <img src={puzzleImage} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                  ) : (
                    <Upload className="w-8 h-8 text-neutral-300" />
                  )}
                  <p className="text-sm font-medium text-neutral-600 relative z-10">
                    {puzzleImage ? 'Thay đổi ảnh' : 'Tải lên ảnh nền'}
                  </p>
                  <input 
                    type="file" 
                    ref={imageInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageUpload}
                  />
                </div>
              </div>

              {/* Questions Import */}
              <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-xl">
                    <FileText className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-bold">Danh sách câu hỏi</h3>
                </div>

                <textarea 
                  className="w-full h-32 px-4 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                  placeholder="Câu 1: ...?&#10;A. ... (*)&#10;B. ..."
                  onChange={(e) => setPuzzleQuestions(parseQuestions(e.target.value))}
                />
                
                {puzzleQuestions.length > 0 && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <p className="text-sm font-bold text-amber-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> {puzzleQuestions.length} mảnh ghép tương ứng
                    </p>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 flex flex-col items-center gap-4">
                {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                <button
                  onClick={handleManualPuzzleStart}
                  className="w-full max-w-md bg-violet-600 hover:bg-violet-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-violet-100 transition-all flex items-center justify-center gap-2 text-xl"
                >
                  <Play className="w-6 h-6" /> BẮT ĐẦU CHƠI
                </button>
              </div>
            </div>
          </div>
          ) : isManualMaze ? (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={onBack}
                  className="px-4 py-2 bg-white border border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 transition-all flex items-center gap-2 text-sm font-bold shadow-sm"
                >
                  <Home className="w-4 h-4" /> Trang chủ
                </button>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-200 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                      <MapIcon className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-neutral-800">Tạo Mê Cung Thủ Công</h3>
                      <p className="text-sm text-neutral-500">Nhập danh sách câu hỏi thử thách tại mỗi ngã rẽ.</p>
                    </div>
                  </div>
                  <button onClick={() => setIsManualMaze(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-neutral-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-xl">
                      <FileText className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-bold">Danh sách câu hỏi</h3>
                  </div>

                  <textarea 
                    className="w-full h-48 px-4 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono"
                    placeholder="Câu 1: ...?&#10;A. ... (*)&#10;B. ...&#10;C. ...&#10;D. ..."
                    onChange={(e) => setMazeQuestions(parseQuestions(e.target.value))}
                  />
                  
                  {mazeQuestions.length > 0 && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <p className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Đã nhập {mazeQuestions.length} câu hỏi
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-4 pt-4">
                    {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                    <button
                      onClick={handleManualMazeStart}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2 text-xl"
                    >
                      <Play className="w-6 h-6" /> BẮT ĐẦU CHƠI
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : isManualRPG ? (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={onBack}
                  className="px-4 py-2 bg-white border border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 transition-all flex items-center gap-2 text-sm font-bold shadow-sm"
                >
                  <Home className="w-4 h-4" /> Trang chủ
                </button>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-200 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                      <Sword className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-neutral-800">Tạo RPG Hành Trình</h3>
                      <p className="text-sm text-neutral-500">Nhập danh sách câu hỏi để anh hùng chiến đấu.</p>
                    </div>
                  </div>
                  <button onClick={() => setIsManualRPG(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-neutral-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-xl">
                      <FileText className="w-5 h-5 text-red-600" />
                    </div>
                    <h3 className="text-lg font-bold">Ngân hàng câu hỏi</h3>
                  </div>

                  <textarea 
                    className="w-full h-48 px-4 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-red-500 outline-none text-sm font-mono"
                    placeholder="Câu 1: ...?&#10;A. ... (*)&#10;B. ...&#10;C. ...&#10;D. ..."
                    onChange={(e) => setRpgQuestions(parseQuestions(e.target.value))}
                  />
                  
                  {rpgQuestions.length > 0 && (
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <p className="text-sm font-bold text-red-700 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Đã nhập {rpgQuestions.length} câu hỏi
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-4 pt-4">
                    {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                    <button
                      onClick={handleManualRPGStart}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-2 text-xl"
                    >
                      <Play className="w-6 h-6" /> BẮT ĐẦU HÀNH TRÌNH
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      </div>

            {/* Right Column: Saved Games */}
            <div className="lg:col-span-5 space-y-6">
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200 h-full flex flex-col"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-amber-500" />
                    Trò chơi đã tạo
                  </h3>
                  <button 
                    onClick={fetchSavedGames}
                    className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                    title="Làm mới"
                  >
                    <RefreshCcw className={`w-4 h-4 text-neutral-400 ${isLoadingSaved ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {!auth.currentUser ? (
                  <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center p-8">
                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center shadow-inner">
                      <Lock className="w-10 h-10 text-amber-400" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-bold text-neutral-800">Đăng nhập để lưu trò chơi</h4>
                      <p className="text-sm text-neutral-500 max-w-xs mx-auto leading-relaxed">
                        Bạn cần đăng nhập bằng Google để có thể lưu và chơi lại các trò chơi đã tạo.
                      </p>
                    </div>
                  </div>
                ) : isLoadingSaved ? (
                  <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-neutral-400">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm">Đang tải danh sách...</p>
                  </div>
                ) : savedGames.length > 0 ? (
                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {savedGames.map((saved) => (
                      <button
                        key={saved.id}
                        onClick={() => handleSelectSavedGame(saved)}
                        className="w-full p-4 text-left bg-neutral-50 hover:bg-indigo-50 border border-neutral-100 hover:border-indigo-200 rounded-2xl transition-all group relative overflow-hidden"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            {saved.gameData.type === 'adventure' && <Compass className="w-6 h-6 text-indigo-600" />}
                            {saved.gameData.type === 'quiz' && <HelpCircle className="w-6 h-6 text-violet-600" />}
                            {saved.gameData.type === 'logic' && <Lightbulb className="w-6 h-6 text-amber-600" />}
                            {saved.gameData.type === 'wheel' && <RefreshCcw className="w-6 h-6 text-orange-600" />}
                            {saved.gameData.type === 'puzzle' && <Grid3X3 className="w-6 h-6 text-emerald-600" />}
                            {saved.gameData.type === 'maze' && <MapIcon className="w-6 h-6 text-cyan-600" />}
                            {saved.gameData.type === 'rpg' && <Sword className="w-6 h-6 text-red-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-neutral-800 truncate">{saved.gameData.title}</h4>
                            <p className="text-xs text-neutral-500 line-clamp-2 mt-1">{saved.gameData.description}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 bg-neutral-200/50 px-2 py-0.5 rounded">
                                {saved.gameData.type}
                              </span>
                              <span className="text-[10px] text-neutral-400">
                                {saved.createdAt?.toDate ? saved.createdAt.toDate().toLocaleDateString('vi-VN') : 'Vừa xong'}
                              </span>
                            </div>
                          </div>
                          <div className="self-center">
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="w-4 h-4 text-indigo-600 fill-current" />
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-neutral-400 text-center px-6">
                    <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center">
                      <Gamepad2 className="w-8 h-8 opacity-20" />
                    </div>
                    <div>
                      <p className="font-bold text-neutral-600">Chưa có trò chơi nào</p>
                      <p className="text-xs mt-1">Hãy mô tả ý tưởng bên trái để AI tạo trò chơi đầu tiên cho bạn!</p>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-3xl mx-auto space-y-8"
        >
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setGame(null)}
              className="px-4 py-2 bg-white border border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 transition-all flex items-center gap-2 text-sm font-bold shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
            </button>
            <button 
              onClick={onBack}
              className="px-4 py-2 bg-white border border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 transition-all flex items-center gap-2 text-sm font-bold shadow-sm"
            >
              <Home className="w-4 h-4" /> Trang chủ
            </button>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-3xl font-black tracking-tight text-neutral-900">{game.title}</h3>
            <p className="text-neutral-500">{game.description}</p>
          </div>

          <div className="min-h-[400px]">
            {game.type === 'adventure' && renderAdventure()}
            {game.type === 'quiz' && renderQuiz()}
            {game.type === 'logic' && renderLogic()}
            {game.type === 'wheel' && renderWheel()}
            {game.type === 'puzzle' && renderPuzzle()}
            {game.type === 'maze' && renderMaze()}
            {game.type === 'rpg' && renderRPG()}
          </div>

          <div className="flex justify-center pt-8">
            <button 
              onClick={() => setGame(null)}
              className="text-neutral-400 hover:text-neutral-600 text-sm font-medium flex items-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" /> Tạo trò chơi khác
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
