"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    UploadCloud, 
    CheckCircle, 
    AlertCircle, 
    Loader2, 
    ArrowRight,
    Shield,
    X,
    FileText,
    Check,
    Lock,
    Cpu,
    Zap,
    Activity,
    Database,
    Fingerprint
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

const LOADING_STEPS = [
    "Securely Uploading Artifact...",
    "Initializing OCR Neural Scan...",
    "Llama-3 Semantic Interpretation...",
    "Extracting Jurisdictional Entities...",
    "Committing to Evidence Ledger..."
];

interface FileUploadItem {
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number;
    result?: { fir_number?: string; severity?: string; id?: number };
    error?: string;
}

interface ProcessedAccident {
    id: number;
    fir_number: string;
    severity: string;
    location?: { city?: string };
}

export default function UploadPage() {
    const router = useRouter();
    const [files, setFiles] = useState<FileUploadItem[]>([]);
    const [uploading, setUploading] = useState(false);
    const [singleMode, setSingleMode] = useState(true);

    const [singleFile, setSingleFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [data, setData] = useState<ProcessedAccident | null>(null);
    const [progressStep, setProgressStep] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (uploading && singleMode) {
            interval = setInterval(() => {
                setProgressStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
            }, 3000);
        } else {
            setProgressStep(0);
        }
        return () => clearInterval(interval);
    }, [uploading, singleMode]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            if (selectedFiles.length === 1) {
                setSingleMode(true);
                setSingleFile(selectedFiles[0]);
                setStatus('idle');
                setMessage('');
                setData(null);
            } else {
                setSingleMode(false);
                setFiles(selectedFiles.map(f => ({ file: f, status: 'pending', progress: 0 })));
            }
        }
    };

    const handleSingleUpload = async () => {
        if (!singleFile) return;
        setUploading(true);
        setStatus('idle');
        setMessage('');
        setData(null);

        const formData = new FormData();
        formData.append('file', singleFile);

        try {
            const res = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || result.details || 'Upload failed');
            setData({ ...result.data, id: result.accident_id });
            setStatus('success');
            setMessage('Case record committed successfully.');
        } catch (error: unknown) {
            console.error(error);
            setStatus('error');
            setMessage(error instanceof Error ? error.message : 'Critical ingestion failure');
        } finally {
            setUploading(false);
        }
    };

    const handleBulkUpload = async () => {
        setUploading(true);
        const items = [...files];

        for (let i = 0; i < items.length; i++) {
            items[i].status = 'uploading';
            setFiles([...items]);

            const formData = new FormData();
            formData.append('file', items[i].file);

            const progressInterval = setInterval(() => {
                setFiles(prev => {
                    const updated = [...prev];
                    if (updated[i] && updated[i].status === 'uploading' && updated[i].progress < LOADING_STEPS.length - 1) {
                        updated[i].progress++;
                    }
                    return updated;
                });
            }, 2500);

            try {
                const res = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
                const result = await res.json();
                clearInterval(progressInterval);
                if (!res.ok) throw new Error(result.error || 'Upload failed');

                items[i].status = 'success';
                items[i].result = { 
                    fir_number: result.data?.fir_number, 
                    severity: result.data?.severity,
                    id: result.accident_id 
                };
                items[i].progress = LOADING_STEPS.length - 1;
            } catch (err) {
                clearInterval(progressInterval);
                items[i].status = 'error';
                items[i].error = err instanceof Error ? err.message : 'Failed';
            }
            setFiles([...items]);
        }
        setUploading(false);
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const allDone = files.length > 0 && files.every(f => f.status === 'success' || f.status === 'error');

    return (
        <div className="max-w-4xl mx-auto py-12 px-4 space-y-12">
            {/* Mission Critical Header */}
            <div className="text-center space-y-4">
                <div className="relative inline-block">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" />
                    <div className="relative p-5 bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl">
                        <Lock size={40} className="text-indigo-400" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">
                        Evidence <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Ingestion</span>
                    </h1>
                    <p className="text-slate-500 font-mono text-xs uppercase tracking-[0.3em] font-bold">Secure Digital Registry • Version 4.0</p>
                </div>
                <p className="max-w-xl mx-auto text-slate-400 text-sm font-medium leading-relaxed">
                    Automated extraction portal for First Information Reports. Advanced OCR and Llama-3 neural processing ensure zero-loss entity relationship mapping.
                </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                <div className="group relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-[3rem] blur opacity-25 group-hover:opacity-100 transition duration-1000" />
                    <div className="relative bg-slate-950 border border-slate-800 rounded-[2.5rem] p-4 shadow-2xl overflow-hidden min-h-[500px] flex flex-col justify-center">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none -z-10" />
                        
                        {/* Status Diagnostics (Single Mode Progress) */}
                        {uploading && singleMode && (
                            <div className="absolute top-8 left-8 right-8 z-20 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                    <span>System Diagnostic In Progress</span>
                                    <span>{Math.round(((progressStep + 1) / LOADING_STEPS.length) * 100)}%</span>
                                </div>
                                <div className="h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                    <div 
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
                                        style={{ width: `${((progressStep + 1) / LOADING_STEPS.length) * 100}%` }}
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <Loader2 size={12} className="text-indigo-500 animate-spin" />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{LOADING_STEPS[progressStep]}</span>
                                </div>
                            </div>
                        )}

                        {/* Drop Zone */}
                        {singleMode && !data && status !== 'success' && (
                            <div className="p-8 space-y-8">
                                <div className="relative group/zone">
                                    <input 
                                        type="file" 
                                        accept="application/pdf"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
                                        id="file-upload"
                                        disabled={uploading}
                                        multiple
                                    />
                                    <div className={`border-2 border-dashed rounded-[2rem] p-16 flex flex-col items-center justify-center transition-all duration-500 ${
                                        singleFile 
                                            ? 'border-indigo-500/50 bg-indigo-500/5 backdrop-blur-sm' 
                                            : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                                    }`}>
                                        <div className={`relative p-6 rounded-full mb-6 transition-all duration-500 ${
                                            singleFile ? 'bg-indigo-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.4)] scale-110' : 'bg-slate-900 text-slate-600 border border-slate-800'
                                        }`}>
                                            {singleFile ? <Check size={32} /> : <UploadCloud size={32} className="group-hover/zone:scale-110 transition-transform" />}
                                        </div>
                                        {singleFile ? (
                                            <div className="text-center space-y-2">
                                                <p className="text-xl font-bold text-white tracking-tight">{singleFile.name}</p>
                                                <div className="flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    <span>PDF Artifact</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                                                    <span>{(singleFile.size / 1024 / 1024).toFixed(2)} MB</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center space-y-3">
                                                <p className="text-lg font-bold text-slate-300">Synchronize Evidence File</p>
                                                <p className="text-xs text-slate-500 font-medium max-w-[240px] leading-relaxed mx-auto uppercase tracking-tighter">PDF Format Protocol Required for Intelligence Extraction</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-center">
                                    <button
                                        onClick={handleSingleUpload}
                                        disabled={!singleFile || uploading}
                                        className={`group/btn relative px-10 py-5 rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-xs transition-all shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ${
                                            !singleFile || uploading 
                                                ? 'bg-slate-900 text-slate-600 border border-slate-800' 
                                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/30'
                                        }`}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/0 via-indigo-400/20 to-indigo-400/0 -translate-x-full group-hover/btn:animate-[shimmer_2s_infinite]" />
                                        <div className="relative flex items-center gap-3">
                                            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                            {uploading ? "Analyzing Matrix" : "Trigger Neural Ingestion"}
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Bulk Processing Grid */}
                        {!singleMode && (
                            <div className="p-8 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Queue Dashboard</h2>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{files.length} Manifest Artifacts Identified</p>
                                    </div>
                                    {!uploading && !allDone && (
                                        <button onClick={() => { setSingleMode(true); setFiles([]); }} className="p-2 hover:bg-slate-900 rounded-lg text-slate-500 transition-colors">
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {files.map((item, idx) => (
                                        <div key={idx} className={`p-5 rounded-2xl border transition-all duration-300 flex items-center gap-4 ${
                                            item.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5' :
                                            item.status === 'error' ? 'bg-red-500/5 border-red-500/20 shadow-lg shadow-red-500/5' :
                                            'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                                        }`}>
                                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                                                {item.status === 'success' ? <CheckCircle className="text-emerald-500" size={18} /> :
                                                 item.status === 'error' ? <AlertCircle className="text-red-500" size={18} /> :
                                                 item.status === 'uploading' ? <Loader2 className="text-indigo-500 animate-spin" size={18} /> :
                                                 <FileText className="text-slate-600" size={18} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-200 truncate pr-2 uppercase tracking-tight">{item.file.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${
                                                        item.status === 'success' ? 'text-emerald-500' :
                                                        item.status === 'error' ? 'text-red-500' :
                                                        'text-slate-500'
                                                    }`}>
                                                        {item.status === 'uploading' ? LOADING_STEPS[item.progress].split('...')[0] : item.status}
                                                    </span>
                                                </div>
                                            </div>
                                            {item.status === 'pending' && !uploading && (
                                                <button onClick={() => removeFile(idx)} className="text-slate-700 hover:text-red-500 transition-colors">
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {!allDone && (
                                    <button
                                        onClick={handleBulkUpload}
                                        disabled={uploading || files.length === 0}
                                        className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] transition-all flex items-center justify-center gap-3 overflow-hidden ${
                                            uploading ? 'bg-slate-900 text-slate-600 border border-slate-800' :
                                            'bg-white text-black hover:bg-indigo-50 shadow-2xl hover:scale-[1.02] active:scale-95'
                                        }`}
                                    >
                                        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                                        {uploading ? `Processing Sequence [${files.filter(f => f.status === 'success' || f.status === 'error').length + 1}/${files.length}]` : "Execute Multi-Artifact Ingestion"}
                                    </button>
                                )}

                                {allDone && (
                                    <div className="pt-4 flex flex-col sm:flex-row gap-3">
                                        <button onClick={() => { setFiles([]); setSingleMode(true); }} className="flex-1 py-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Upload New Sequence</button>
                                        <button onClick={() => router.push('/accidents')} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all">Verify Registry</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Success State (Final Analysis Report Style) */}
                        {singleMode && status === 'success' && data && (
                            <div className="p-10 text-center animate-in zoom-in-95 fade-in duration-500 space-y-8">
                                <div className="relative inline-block">
                                    <div className="absolute inset-0 bg-emerald-500/20 blur-3xl animate-pulse" />
                                    <div className="relative w-24 h-24 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl flex items-center justify-center text-emerald-500 shadow-2xl">
                                        <Fingerprint size={48} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Matrix Parsed</h2>
                                    <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">Case Authenticated: {data.fir_number}</p>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                                    <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl text-left space-y-1">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Severity</p>
                                        <p className={`font-black uppercase tracking-tight text-lg ${data.severity === 'Fatal' ? 'text-red-400' : 'text-amber-400'}`}>{data.severity}</p>
                                    </div>
                                    <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl text-left space-y-1">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Spatial Entity</p>
                                        <p className="font-black text-white uppercase tracking-tight text-lg truncate">{data.location?.city || 'Vijayawada'}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row justify-center gap-4">
                                    <button onClick={() => { setSingleFile(null); setData(null); setStatus('idle'); }} className="px-8 py-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all">Discard & New</button>
                                    <button onClick={() => router.push(`/accidents/${data.id}`)} className="px-8 py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-emerald-500/20 flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all">
                                        Open Case Intelligence Report <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Error HUD */}
                        {singleMode && status === 'error' && (
                            <div className="p-10 flex flex-col items-center text-center space-y-6">
                                <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-xl shadow-red-500/5">
                                    <AlertCircle size={40} />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Buffer Corruption</h3>
                                    <p className="text-red-400/80 font-medium text-sm max-w-[280px]">{message}</p>
                                </div>
                                <button onClick={() => setStatus('idle')} className="px-8 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Re-initialize Segment</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Secure Protocol Sidebar Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 bg-slate-900/40 border border-slate-800/50 rounded-3xl flex items-center gap-4 group">
                        <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 group-hover:scale-110 transition-transform">
                            <Shield size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Integrity</p>
                            <p className="text-xs font-bold text-slate-300">OCR Vector Verification</p>
                        </div>
                    </div>
                    <div className="p-6 bg-slate-900/40 border border-slate-800/50 rounded-3xl flex items-center gap-4 group">
                        <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400 group-hover:scale-110 transition-transform">
                            <Cpu size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Compute</p>
                            <p className="text-xs font-bold text-slate-300">Llama-3 Neural Core</p>
                        </div>
                    </div>
                    <div className="p-6 bg-slate-900/40 border border-slate-800/50 rounded-3xl flex items-center gap-4 group">
                        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 group-hover:scale-110 transition-transform">
                            <Activity size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Validation</p>
                            <p className="text-xs font-bold text-slate-300">Real-time Entity Extraction</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
