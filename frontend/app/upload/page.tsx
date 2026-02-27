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
    Check
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

const LOADING_STEPS = [
    "Uploading Document...",
    "Scanning with OCR (Telugu/English)...",
    "AI Analyzing Context...",
    "Extracting Key Entities...",
    "Finalizing Report..."
];

interface FileUploadItem {
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number; // step index in LOADING_STEPS
    result?: { fir_number?: string; severity?: string; id?: number };
    error?: string;
}

export default function UploadPage() {
    const router = useRouter();
    const [files, setFiles] = useState<FileUploadItem[]>([]);
    const [uploading, setUploading] = useState(false);
    const [singleMode, setSingleMode] = useState(true);

    // Single file legacy state
    const [singleFile, setSingleFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [data, setData] = useState<any | null>(null);
    const [progressStep, setProgressStep] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (uploading && singleMode) {
            interval = setInterval(() => {
                setProgressStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
            }, 2500);
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
            setMessage('FIR processed successfully!');
        } catch (error: unknown) {
            console.error(error);
            setStatus('error');
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                setMessage('Cannot connect to backend server. Make sure the backend is running.');
            } else if (error instanceof Error) {
                setMessage(error.message);
            } else {
                setMessage('Failed to process FIR. Please try again.');
            }
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

            // Simulate progress steps
            const progressInterval = setInterval(() => {
                setFiles(prev => {
                    const updated = [...prev];
                    if (updated[i] && updated[i].status === 'uploading' && updated[i].progress < LOADING_STEPS.length - 1) {
                        updated[i].progress++;
                    }
                    return updated;
                });
            }, 2000);

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

    const successCount = files.filter(f => f.status === 'success').length;
    const errorCount = files.filter(f => f.status === 'error').length;
    const allDone = files.length > 0 && files.every(f => f.status === 'success' || f.status === 'error');

    return (
        <div className="max-w-3xl mx-auto py-10">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-4">
                    <Shield className="text-indigo-400 w-8 h-8" />
                </div>
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
                    Upload FIR Documents
                </h1>
                <p className="text-slate-400 mt-2 max-w-lg mx-auto">
                    Upload single or multiple FIR PDFs. Our AI extracts details, analyzes severity, and maps location automatically.
                </p>
            </div>
            
            <div className="bg-slate-900/50 backdrop-blur-xl p-1 rounded-3xl border border-slate-800 shadow-2xl">
                <div className="bg-slate-950/50 rounded-[22px] p-8 md:p-12 border border-slate-800/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none -z-10" />

                    {/* Single Mode — No files selected yet or single file flow */}
                    {singleMode && !data && status !== 'success' && (
                        <>
                            <div className="relative group">
                                <input 
                                    type="file" 
                                    accept="application/pdf"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
                                    id="file-upload"
                                    disabled={uploading}
                                    multiple
                                />
                                <div className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all duration-300 ${
                                    singleFile ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-900'
                                }`}>
                                    <div className={`p-4 rounded-full mb-4 transition-transform group-hover:scale-110 ${
                                        singleFile ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'
                                    }`}>
                                        <UploadCloud size={32} />
                                    </div>
                                    {singleFile ? (
                                        <div className="text-center">
                                            <p className="text-lg font-medium text-white mb-1">{singleFile.name}</p>
                                            <p className="text-sm text-slate-500">{(singleFile.size / 1024 / 1024).toFixed(2)} MB • PDF Ready</p>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <p className="text-lg font-medium text-slate-200 mb-1">Click to upload or drag and drop</p>
                                            <p className="text-sm text-slate-500">Select one PDF for single upload, or multiple PDFs for bulk processing</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8 flex justify-center">
                                <button
                                    onClick={handleSingleUpload}
                                    disabled={!singleFile || uploading}
                                    className={`px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all transform hover:scale-105 active:scale-95 shadow-lg ${
                                        !singleFile || uploading 
                                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25'
                                    }`}
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            <span>{LOADING_STEPS[progressStep]}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Analyze Document</span>
                                            <ArrowRight size={20} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}

                    {/* Bulk Mode — Multiple files selected */}
                    {!singleMode && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-lg font-semibold text-white">
                                    {allDone ? 'Upload Complete' : `${files.length} files selected`}
                                </h2>
                                {!uploading && !allDone && (
                                    <button
                                        onClick={() => { setSingleMode(true); setFiles([]); }}
                                        className="text-sm text-slate-400 hover:text-slate-200"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>

                            {/* Summary bar (shown after all done) */}
                            {allDone && (
                                <div className="flex gap-3 mb-4">
                                    <div className="flex-1 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                                        <p className="text-2xl font-bold text-emerald-400">{successCount}</p>
                                        <p className="text-xs text-emerald-300">Succeeded</p>
                                    </div>
                                    {errorCount > 0 && (
                                        <div className="flex-1 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                                            <p className="text-2xl font-bold text-red-400">{errorCount}</p>
                                            <p className="text-xs text-red-300">Failed</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* File list */}
                            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                {files.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                            item.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' :
                                            item.status === 'error' ? 'bg-red-500/5 border-red-500/20' :
                                            item.status === 'uploading' ? 'bg-indigo-500/5 border-indigo-500/20' :
                                            'bg-slate-800/50 border-slate-700/50'
                                        }`}
                                    >
                                        {/* Status Icon */}
                                        <div className="flex-shrink-0">
                                            {item.status === 'success' && <CheckCircle size={18} className="text-emerald-500" />}
                                            {item.status === 'error' && <AlertCircle size={18} className="text-red-500" />}
                                            {item.status === 'uploading' && <Loader2 size={18} className="text-indigo-400 animate-spin" />}
                                            {item.status === 'pending' && <FileText size={18} className="text-slate-500" />}
                                        </div>

                                        {/* File Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-200 truncate">{item.file.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {item.status === 'uploading' && LOADING_STEPS[item.progress]}
                                                {item.status === 'success' && `FIR ${item.result?.fir_number || '—'} • ${item.result?.severity || 'Processed'}`}
                                                {item.status === 'error' && (item.error || 'Processing failed')}
                                                {item.status === 'pending' && `${(item.file.size / 1024 / 1024).toFixed(2)} MB`}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        {item.status === 'success' && item.result?.id && (
                                            <button 
                                                onClick={() => router.push(`/accidents/${item.result?.id}`)}
                                                className="px-2 py-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
                                            >
                                                View
                                            </button>
                                        )}
                                        {item.status === 'pending' && !uploading && (
                                            <button onClick={() => removeFile(idx)} className="text-slate-600 hover:text-slate-400">
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Upload button */}
                            {!allDone && (
                                <div className="mt-6 flex justify-center">
                                    <button
                                        onClick={handleBulkUpload}
                                        disabled={uploading || files.length === 0}
                                        className={`px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all shadow-lg ${
                                            uploading ? 'bg-slate-800 text-slate-400 cursor-not-allowed' :
                                            'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25 hover:scale-105 active:scale-95'
                                        }`}
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 size={20} className="animate-spin" />
                                                Processing {files.filter(f => f.status === 'success' || f.status === 'error').length + 1} of {files.length}...
                                            </>
                                        ) : (
                                            <>
                                                <UploadCloud size={20} />
                                                Upload All ({files.length} files)
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* After completion */}
                            {allDone && (
                                <div className="mt-4 flex justify-center gap-3">
                                    <button 
                                        onClick={() => { setFiles([]); setSingleMode(true); }}
                                        className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                                    >
                                        Upload More
                                    </button>
                                    <button 
                                        onClick={() => router.push('/accidents')}
                                        className="px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                                    >
                                        <Check size={16} /> View All Accidents
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Single upload success */}
                    {singleMode && status === 'success' && data && (
                        <div className="text-center py-6">
                            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle size={40} className="text-emerald-500" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Analysis Complete!</h2>
                            <p className="text-slate-400 mb-8">
                                FIR <span className="text-white font-mono">{data.fir_number}</span> has been successfully processed.
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-lg mx-auto mb-8">
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Severity</p>
                                    <p className={`font-semibold ${data.severity === 'Fatal' ? 'text-red-400' : 'text-yellow-400'}`}>
                                        {data.severity}
                                    </p>
                                </div>
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Location</p>
                                    <p className="font-semibold text-white truncate">{data.location?.city || 'Unknown'}</p>
                                </div>
                            </div>

                            <div className="flex justify-center gap-4">
                                <button 
                                    onClick={() => {
                                        setSingleFile(null);
                                        setData(null);
                                        setStatus('idle');
                                    }}
                                    className="px-6 py-3 rounded-xl font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                                >
                                    Upload Another
                                </button>
                                <button 
                                    onClick={() => router.push(`/accidents/${data.id}`)}
                                    className="px-6 py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-105 flex items-center gap-2"
                                >
                                    View Full Analysis <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {singleMode && status === 'error' && (
                        <div className="mt-8 p-6 bg-red-500/10 border border-red-500/20 rounded-xl flex flex-col items-center text-center">
                            <AlertCircle size={32} className="text-red-400 mb-2" />
                            <h3 className="text-lg font-semibold text-red-400">Processing Failed</h3>
                            <p className="text-red-300/80 mt-1 mb-4">{message}</p>
                            <button 
                                onClick={() => setStatus('idle')}
                                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-sm transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
