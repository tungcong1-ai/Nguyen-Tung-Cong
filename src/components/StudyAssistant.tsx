import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  FileText, 
  Network, 
  CheckSquare, 
  ChevronLeft, 
  Loader2, 
  Download, 
  Copy, 
  Check,
  HelpCircle,
  AlertCircle,
  History,
  Trash2,
  Clock,
  Lock,
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as d3 from 'd3';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { summarizeText, generateMindMap, generateMCQs, MindMapNode, MCQ, testGeminiConnection } from '../services/geminiService';
import { db, auth, handleFirestoreError } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';

// Set worker source for PDF.js using a more robust method for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface Props {
  onBack: () => void;
}

export const StudyAssistant: React.FC<Props> = ({ onBack }) => {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'mindmap' | 'mcq'>('summary');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [copied, setCopied] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [aiStatus, setAiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleWordUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      setInputText(result.value);
    } catch (error) {
      console.error('Error parsing Word file:', error);
      alert('Không thể đọc tệp Word. Vui lòng kiểm tra lại định dạng.');
    } finally {
      setIsExtracting(false);
      if (wordInputRef.current) wordInputRef.current.value = '';
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      setInputText(fullText);
    } catch (error) {
      console.error('Error parsing PDF file:', error);
      alert('Không thể đọc tệp PDF. Vui lòng kiểm tra lại định dạng.');
    } finally {
      setIsExtracting(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleProcess = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    try {
      let result: any = null;
      if (activeTab === 'summary') {
        result = await summarizeText(inputText);
        setSummary(result);
      } else if (activeTab === 'mindmap') {
        result = await generateMindMap(inputText);
        setMindMapData(result);
      } else if (activeTab === 'mcq') {
        result = await generateMCQs(inputText);
        setMcqs(result);
        setUserAnswers({});
        setShowResults(false);
      }

      // Save to Firestore
      if (auth.currentUser && result) {
        const path = `users/${auth.currentUser.uid}/study_materials`;
        try {
          await addDoc(collection(db, path), {
            userId: auth.currentUser.uid,
            type: activeTab,
            inputText: inputText.substring(0, 500), // Store snippet
            result: result,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, 'write' as any, path);
        }
      }
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra khi xử lý. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportSummary = () => {
    if (!summary) return;
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tom-tat-bai-hoc.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMCQs = () => {
    if (mcqs.length === 0) return;
    let content = "CÂU HỎI TRẮC NGHIỆM\n\n";
    mcqs.forEach((q, i) => {
      content += `Câu ${i + 1}: ${q.question}\n`;
      q.options.forEach((opt, j) => {
        const isCorrect = j === q.answerIndex;
        content += `${String.fromCharCode(65 + j)}. ${opt}${isCorrect ? ' (*)' : ''}\n`;
      });
      content += `Đáp án: ${String.fromCharCode(65 + q.answerIndex)}\n`;
      content += `Giải thích: ${q.explanation}\n\n`;
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cau-hoi-trac-nghiem.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMCQsAsMindMap = () => {
    if (mcqs.length === 0) return;
    
    // Convert MCQs to MindMapNode structure
    const mcqMindMap: MindMapNode = {
      id: 'root',
      text: 'Câu hỏi trắc nghiệm',
      children: mcqs.map((q, i) => ({
        id: `q-${i}`,
        text: `Câu ${i + 1}: ${q.question.substring(0, 50)}${q.question.length > 50 ? '...' : ''}`,
        children: q.options.map((opt, j) => ({
          id: `q-${i}-o-${j}`,
          text: `${String.fromCharCode(65 + j)}. ${opt}${j === q.answerIndex ? ' (*)' : ''}`
        }))
      }))
    };

    // Create a temporary SVG for rendering
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    document.body.appendChild(tempDiv);
    
    const tempSvg = d3.select(tempDiv).append('svg')
      .attr('width', 1600)
      .attr('height', 900);

    const width = 1600;
    const height = 900;
    const margin = { top: 60, right: 300, bottom: 60, left: 200 };

    const g = tempSvg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const tree = d3.tree<MindMapNode>().size([height - margin.top - margin.bottom, width - margin.left - margin.right]);
    const root = d3.hierarchy(mcqMindMap);
    tree(root);

    // Links
    g.selectAll(".link")
      .data(root.links())
      .enter().append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", 2)
      .attr("d", d3.linkHorizontal<any, any>()
        .x(d => d.y)
        .y(d => d.x));

    // Nodes
    const node = g.selectAll(".node")
      .data(root.descendants())
      .enter().append("g")
      .attr("class", d => "node" + (d.children ? " node--internal" : " node--leaf"))
      .attr("transform", d => `translate(${d.y},${d.x})`);

    node.append("circle")
      .attr("r", 8)
      .attr("fill", d => d.depth === 0 ? "#4f46e5" : d.depth === 1 ? "#6366f1" : "#818cf8")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    node.append("text")
      .attr("dy", ".35em")
      .attr("x", d => d.children ? -12 : 12)
      .attr("text-anchor", d => d.children ? "end" : "start")
      .text(d => d.data.text)
      .style("font-size", "12px")
      .style("font-weight", d => d.depth === 0 ? "bold" : "500")
      .style("fill", "#1f2937")
      .style("font-family", "Inter, sans-serif");

    // Export as PNG
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(tempSvg.node() as SVGElement);
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const img = new Image();
    
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      canvas.width = 1200;
      canvas.height = 800;
      if (context) {
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'so-do-cau-hoi.png';
        a.click();
      }
      URL.revokeObjectURL(url);
      document.body.removeChild(tempDiv);
    };
    img.src = url;
  };

  const exportMindMap = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const img = new Image();
    
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      canvas.width = 1600;
      canvas.height = 900;
      if (context) {
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'so-do-tu-duy.png';
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  useEffect(() => {
    const checkConnection = async () => {
      const isOnline = await testGeminiConnection();
      setAiStatus(isOnline ? 'online' : 'offline');
    };
    checkConnection();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const path = `users/${auth.currentUser.uid}/study_materials`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistory(docs);
    }, (err) => {
      handleFirestoreError(err, 'get' as any, path);
    });

    return () => unsubscribe();
  }, []);

  const loadFromHistory = (item: any) => {
    setInputText(item.inputText);
    setActiveTab(item.type);
    if (item.type === 'summary') {
      setSummary(item.result);
      setMindMapData(null);
      setMcqs([]);
    } else if (item.type === 'mindmap') {
      setMindMapData(item.result);
      setSummary('');
      setMcqs([]);
    } else if (item.type === 'mcq') {
      setMcqs(item.result);
      setSummary('');
      setMindMapData(null);
      setUserAnswers({});
      setShowResults(false);
    }
    setShowHistory(false);
  };

  const deleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/study_materials/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (err) {
      handleFirestoreError(err, 'delete' as any, path);
    }
  };

  useEffect(() => {
    if (activeTab === 'mindmap' && mindMapData && svgRef.current) {
      renderMindMap();
    }
  }, [mindMapData, activeTab]);

  const renderMindMap = () => {
    if (!mindMapData || !svgRef.current) return;

    const width = 1600;
    const height = 900;
    const margin = { top: 60, right: 300, bottom: 60, left: 150 };

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Create a container for all elements to allow zooming
    const container = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom);

    svg.attr("viewBox", `0 0 ${width} ${height}`)
       .attr("preserveAspectRatio", "xMidYMid meet")
       .style("cursor", "grab");

    const g = container.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Use a local copy of hierarchy to manage collapse state
    const root = d3.hierarchy(mindMapData) as d3.HierarchyNode<MindMapNode> & { x0?: number; y0?: number; _children?: d3.HierarchyNode<MindMapNode>[] };
    root.x0 = height / 2;
    root.y0 = 0;

    const tree = d3.tree<MindMapNode>().size([height - margin.top - margin.bottom, width - margin.left - margin.right]);

    function update(source: any) {
      const nodes = root.descendants();
      const links = root.links();

      tree(root);

      // Update nodes
      const node = g.selectAll<SVGGElement, any>("g.node")
        .data(nodes, (d: any) => d.data.text + d.depth);

      const nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${source.y0 || 0},${source.x0 || 0})`)
        .on("click", (event, d: any) => {
          if (d.children) {
            d._children = d.children;
            d.children = null;
          } else {
            d.children = d._children;
            d._children = null;
          }
          update(d);
        })
        .style("cursor", d => (d.children || d._children) ? "pointer" : "default");

      nodeEnter.append("circle")
        .attr("r", 10)
        .attr("fill", d => d.depth === 0 ? "#4f46e5" : d._children ? "#818cf8" : "#fff")
        .attr("stroke", d => d.depth === 0 ? "#4f46e5" : "#6366f1")
        .attr("stroke-width", 2);

      nodeEnter.append("text")
        .attr("dy", ".35em")
        .attr("x", d => (d.children || d._children) ? -15 : 15)
        .attr("text-anchor", d => (d.children || d._children) ? "end" : "start")
        .text(d => d.data.text)
        .style("font-size", "14px")
        .style("font-weight", d => d.depth === 0 ? "bold" : "500")
        .style("fill", "#1f2937")
        .style("font-family", "Inter, sans-serif")
        .style("pointer-events", "none");

      const nodeUpdate = nodeEnter.merge(node);

      nodeUpdate.transition()
        .duration(500)
        .attr("transform", d => `translate(${d.y},${d.x})`);

      nodeUpdate.select("circle")
        .attr("fill", d => d.depth === 0 ? "#4f46e5" : d._children ? "#818cf8" : "#fff");

      const nodeExit = node.exit().transition()
        .duration(500)
        .attr("transform", d => `translate(${source.y},${source.x})`)
        .remove();

      // Update links
      const link = g.selectAll<SVGPathElement, any>("path.link")
        .data(links, (d: any) => d.target.data.text + d.target.depth);

      const linkEnter = link.enter().insert("path", "g")
        .attr("class", "link")
        .attr("fill", "none")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 2)
        .attr("d", d => {
          const o = { x: source.x0 || 0, y: source.y0 || 0 };
          return d3.linkHorizontal<any, any>()
            .x(d => d.y)
            .y(d => d.x)({ source: o, target: o });
        });

      const linkUpdate = linkEnter.merge(link);

      linkUpdate.transition()
        .duration(500)
        .attr("d", d3.linkHorizontal<any, any>()
          .x(d => d.y)
          .y(d => d.x));

      link.exit().transition()
        .duration(500)
        .attr("d", d => {
          const o = { x: source.x, y: source.y };
          return d3.linkHorizontal<any, any>()
            .x(d => d.y)
            .y(d => d.x)({ source: o, target: o });
        })
        .remove();

      nodes.forEach((d: any) => {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }

    update(root);

    // Initial zoom to fit
    svg.transition().duration(750).call(
      zoom.transform,
      d3.zoomIdentity.translate(0, 0).scale(1)
    );

    // Expose zoom functions to window for UI buttons
    (window as any).zoomIn = () => svg.transition().call(zoom.scaleBy, 1.3);
    (window as any).zoomOut = () => svg.transition().call(zoom.scaleBy, 0.7);
    (window as any).resetZoom = () => svg.transition().call(zoom.transform, d3.zoomIdentity);
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors font-medium"
          >
            <ChevronLeft className="w-5 h-5" />
            Quay lại
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Trợ Lý Học Tập AI</h1>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  aiStatus === 'online' ? 'bg-green-500' : 
                  aiStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  AI {aiStatus === 'online' ? 'Sẵn sàng' : aiStatus === 'offline' ? 'Ngoại tuyến' : 'Đang kiểm tra...'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-xl transition-all flex items-center gap-2 font-bold text-sm ${
                showHistory ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              <History className="w-5 h-5" />
              Lịch sử
            </button>
            <div className="w-20" /> {/* Spacer */}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar History */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, x: -20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 320 }}
              exit={{ opacity: 0, x: -20, width: 0 }}
              className="hidden lg:block overflow-hidden"
            >
              <div className="w-80 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-neutral-900 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Đã tạo gần đây
                  </h3>
                </div>
                <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar">
                  {!auth.currentUser ? (
                    <div className="py-12 text-center space-y-4 px-4 bg-white rounded-2xl border border-dashed border-neutral-200">
                      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                        <Lock className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-neutral-800">Đăng nhập để lưu</h4>
                        <p className="text-[10px] text-neutral-500 leading-relaxed">
                          Đăng nhập để xem lại các tài liệu đã tạo.
                        </p>
                      </div>
                    </div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-neutral-200">
                      <p className="text-xs text-neutral-400 font-medium">Chưa có lịch sử</p>
                    </div>
                  ) : (
                    history.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => loadFromHistory(item)}
                        className="bg-white p-4 rounded-2xl border border-neutral-200 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group relative"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              {item.type === 'summary' && <FileText className="w-3 h-3 text-blue-500" />}
                              {item.type === 'mindmap' && <Network className="w-3 h-3 text-indigo-500" />}
                              {item.type === 'mcq' && <CheckSquare className="w-3 h-3 text-emerald-500" />}
                              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                {item.type === 'summary' ? 'Tóm tắt' : item.type === 'mindmap' ? 'Sơ đồ' : 'Trắc nghiệm'}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-neutral-800 line-clamp-2">
                              {item.inputText}
                            </p>
                            <p className="text-[10px] text-neutral-400">
                              {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString('vi-VN') : 'Đang lưu...'}
                            </p>
                          </div>
                          <button
                            onClick={(e) => deleteHistoryItem(e, item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-neutral-400 hover:text-red-500 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 space-y-8 max-w-5xl mx-auto">
          {/* Mobile History Toggle */}
          <div className="lg:hidden">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="w-full py-3 bg-white border border-neutral-200 rounded-2xl flex items-center justify-center gap-2 font-bold text-neutral-600"
            >
              <History className="w-5 h-5" />
              {showHistory ? 'Ẩn lịch sử' : 'Xem lịch sử'}
            </button>
            
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-3 overflow-hidden"
                >
                  {history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className="bg-white p-4 rounded-2xl border border-neutral-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          item.type === 'summary' ? 'bg-blue-50 text-blue-600' :
                          item.type === 'mindmap' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {item.type === 'summary' && <FileText className="w-4 h-4" />}
                          {item.type === 'mindmap' && <Network className="w-4 h-4" />}
                          {item.type === 'mcq' && <CheckSquare className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-800 line-clamp-1">{item.inputText}</p>
                          <p className="text-[10px] text-neutral-400">
                            {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString('vi-VN') : 'Đang lưu...'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteHistoryItem(e, item.id)}
                        className="p-2 text-neutral-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        {/* Input Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-neutral-900">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-lg">Văn bản cần xử lý</h2>
            </div>
            <div className="flex gap-2">
              <input 
                type="file" 
                ref={wordInputRef} 
                onChange={handleWordUpload} 
                accept=".docx" 
                className="hidden" 
              />
              <input 
                type="file" 
                ref={pdfInputRef} 
                onChange={handlePdfUpload} 
                accept=".pdf" 
                className="hidden" 
              />
              <button 
                onClick={() => wordInputRef.current?.click()}
                disabled={isExtracting}
                className="text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
              >
                {isExtracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                Word
              </button>
              <button 
                onClick={() => pdfInputRef.current?.click()}
                disabled={isExtracting}
                className="text-xs font-bold px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5"
              >
                {isExtracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                PDF
              </button>
            </div>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Dán nội dung tài liệu hoặc bài học của bạn vào đây..."
            className="w-full h-48 p-4 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none text-neutral-700"
          />
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'summary' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              <FileText className="w-5 h-5" /> Tóm tắt
            </button>
            <button
              onClick={() => setActiveTab('mindmap')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'mindmap' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              <Network className="w-5 h-5" /> Sơ đồ tư duy
            </button>
            <button
              onClick={() => setActiveTab('mcq')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'mcq' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              <CheckSquare className="w-5 h-5" /> Câu hỏi trắc nghiệm
            </button>
          </div>
          <button
            onClick={handleProcess}
            disabled={loading || !inputText.trim()}
            className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              'Bắt đầu phân tích'
            )}
          </button>
        </motion.div>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {activeTab === 'summary' && summary && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <h3 className="text-xl font-bold">Bản tóm tắt</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={exportSummary}
                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-500 flex items-center gap-2 text-sm font-bold"
                    title="Xuất file văn bản"
                  >
                    <Download className="w-5 h-5" />
                    Xuất TXT
                  </button>
                  <button 
                    onClick={() => copyToClipboard(summary)}
                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-500"
                  >
                    {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="prose prose-neutral max-w-none text-neutral-700 leading-relaxed whitespace-pre-wrap">
                {summary}
              </div>
            </motion.div>
          )}

          {activeTab === 'mindmap' && mindMapData && (
            <motion.div
              key="mindmap"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-8 space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Network className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-xl font-bold">Sơ đồ tư duy</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-neutral-100 rounded-xl p-1 mr-4">
                    <button 
                      onClick={() => (window as any).zoomIn?.()}
                      className="p-2 hover:bg-white rounded-lg transition-all text-neutral-600"
                      title="Phóng to"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => (window as any).zoomOut?.()}
                      className="p-2 hover:bg-white rounded-lg transition-all text-neutral-600"
                      title="Thu nhỏ"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => (window as any).resetZoom?.()}
                      className="p-2 hover:bg-white rounded-lg transition-all text-neutral-600"
                      title="Đặt lại"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    onClick={exportMindMap}
                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-500 flex items-center gap-2 text-sm font-bold"
                  >
                    <Download className="w-5 h-5" />
                    Xuất Ảnh
                  </button>
                </div>
              </div>
              <div className="w-full aspect-video bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden">
                <svg ref={svgRef} className="w-full h-full" />
              </div>
              <p className="text-sm text-neutral-400 text-center italic">
                * Sơ đồ được tạo tự động dựa trên cấu trúc nội dung của bạn.
              </p>
            </motion.div>
          )}

          {activeTab === 'mcq' && mcqs.length > 0 && (
            <motion.div
              key="mcq"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-6 h-6 text-emerald-600" />
                    <h3 className="text-xl font-bold">Câu hỏi trắc nghiệm</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={exportMCQsAsMindMap}
                      className="p-2 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-500 flex items-center gap-2 text-sm font-bold"
                      title="Xuất sơ đồ câu hỏi (Ảnh)"
                    >
                      <Network className="w-5 h-5" />
                      Sơ đồ Ảnh
                    </button>
                    <button 
                      onClick={exportMCQs}
                      className="p-2 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-500 flex items-center gap-2 text-sm font-bold"
                    >
                      <Download className="w-5 h-5" />
                      Xuất TXT
                    </button>
                  </div>
                </div>
                
                <div className="space-y-12">
                  {mcqs.map((q, qIdx) => (
                    <div key={qIdx} className="space-y-4">
                      <div className="flex gap-4">
                        <span className="flex-shrink-0 w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center font-bold text-neutral-500">
                          {qIdx + 1}
                        </span>
                        <p className="text-lg font-bold text-neutral-800 pt-1">{q.question}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-12">
                        {q.options.map((opt, oIdx) => {
                          const isSelected = userAnswers[qIdx] === oIdx;
                          const isCorrect = oIdx === q.answerIndex;
                          let bgColor = 'bg-white border-neutral-200 hover:border-emerald-200 hover:bg-emerald-50';
                          
                          if (showResults) {
                            if (isCorrect) bgColor = 'bg-emerald-100 border-emerald-500 text-emerald-900';
                            else if (isSelected) bgColor = 'bg-red-100 border-red-500 text-red-900';
                            else bgColor = 'bg-white border-neutral-100 opacity-50';
                          } else if (isSelected) {
                            bgColor = 'bg-emerald-600 border-emerald-600 text-white';
                          }

                          return (
                            <button
                              key={oIdx}
                              disabled={showResults}
                              onClick={() => setUserAnswers(prev => ({ ...prev, [qIdx]: oIdx }))}
                              className={`p-4 rounded-2xl border-2 text-left transition-all font-medium ${bgColor}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      {showResults && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="ml-12 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3"
                        >
                          <HelpCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                          <p className="text-sm text-blue-800">
                            <span className="font-bold">Giải thích:</span> {q.explanation}
                          </p>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>

                {!showResults ? (
                  <button
                    onClick={() => setShowResults(true)}
                    disabled={Object.keys(userAnswers).length < mcqs.length}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    Kiểm tra kết quả
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="p-6 bg-neutral-900 text-white rounded-3xl text-center space-y-2">
                      <p className="text-neutral-400 font-bold uppercase tracking-wider text-xs">Kết quả của bạn</p>
                      <h4 className="text-4xl font-black">
                        {mcqs.filter((q, idx) => userAnswers[idx] === q.answerIndex).length} / {mcqs.length}
                      </h4>
                    </div>
                    <button
                      onClick={() => {
                        setShowResults(false);
                        setUserAnswers({});
                      }}
                      className="w-full py-4 border-2 border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-50 transition-all"
                    >
                      Làm lại bài tập
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!loading && !summary && !mindMapData && mcqs.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 space-y-4"
          >
            <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mx-auto">
              <BookOpen className="w-10 h-10 text-neutral-300" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-neutral-400">Chưa có dữ liệu phân tích</h3>
              <p className="text-neutral-400 max-w-xs mx-auto">Hãy dán văn bản của bạn vào ô phía trên và chọn một chức năng để bắt đầu.</p>
            </div>
          </motion.div>
        )}
      </div>
      </div>
    </div>
  );
};
