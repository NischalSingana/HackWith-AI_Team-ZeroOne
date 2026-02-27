"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
    FileText, 
    Search, 
    MapPin, 
    AlertTriangle, 
    ChevronRight,
    Filter,
    Database,
    ShieldCheck,
    GripVertical,
    History,
    Activity
} from 'lucide-react';
import { API_BASE_URL } from "@/lib/api";

interface Accident {
    id: number;
    fir_number: string;
    incident_date: string;
    cause: string;
    severity: string;
    address: string;
    city: string;
    victim_count: number;
    vehicle_count: number;
    status: string;
}

type SortOption = 'newest' | 'oldest' | 'severity';

export default function AccidentsPage() {
    const [accidents, setAccidents] = useState<Accident[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [severityFilter, setSeverityFilter] = useState<string>('All');
    const [sortBy, setSortBy] = useState<SortOption>('newest');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE_URL}/accidents`)
            .then(res => res.json())
            .then(data => {
                if (data.success) setAccidents(data.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const filteredAccidents = useMemo(() => {
        let result = accidents.filter(acc => 
            acc.fir_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.cause?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.address?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (severityFilter !== 'All') result = result.filter(acc => acc.severity === severityFilter);
        if (dateFrom) result = result.filter(acc => acc.incident_date && new Date(acc.incident_date) >= new Date(dateFrom));
        if (dateTo) result = result.filter(acc => acc.incident_date && new Date(acc.incident_date) <= new Date(dateTo + 'T23:59:59'));

        result.sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.incident_date || b.id).getTime() - new Date(a.incident_date || a.id).getTime();
            if (sortBy === 'oldest') return new Date(a.incident_date || a.id).getTime() - new Date(b.incident_date || b.id).getTime();
            if (sortBy === 'severity') {
                const order: Record<string, number> = { 'Fatal': 0, 'Grievous': 1, 'Simple': 2, 'Non-Injury': 3, 'Unknown': 4 };
                return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
            }
            return 0;
        });
        return result;
    }, [accidents, searchTerm, severityFilter, sortBy, dateFrom, dateTo]);

    const hasActiveFilters = severityFilter !== 'All' || dateFrom || dateTo;

    return (
        <div className="space-y-8 pb-12">
            {/* Command Header */}
            <div className="relative group p-8 rounded-3xl overflow-hidden border border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Database size={120} className="text-indigo-500" />
                </div>
                
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 w-fit">
                            <ShieldCheck size={14} className="text-indigo-400" />
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Secure Evidence Registry</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight uppercase">
                            Incident <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Archive</span>
                        </h1>
                        <p className="text-slate-400 text-sm max-w-md font-medium leading-relaxed">
                            Encrypted repository of all road incident reports. Filter through neural-processed FIR data and audit criminal relationships.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                        <div className="relative w-full sm:w-80 group/search">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-indigo-400 transition-colors" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search FIR #, location, or cause..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm text-slate-200 placeholder-slate-600"
                            />
                        </div>
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl border font-bold text-sm transition-all ${
                                showFilters || hasActiveFilters 
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25' 
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                            }`}
                        >
                            <Filter size={18} />
                            Filters
                            {hasActiveFilters && <span className="w-2 h-2 bg-white rounded-full animate-pulse" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Tactical Filter Panel */}
            {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 glass rounded-2xl border border-slate-800 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Classification</label>
                        <select 
                            value={severityFilter}
                            onChange={(e) => setSeverityFilter(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none"
                        >
                            <option value="All">All Severity Levels</option>
                            <option value="Fatal">Fatal Cases</option>
                            <option value="Grievous">Grievous Injury</option>
                            <option value="Simple">Simple Injury</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">From Date</label>
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">To Date</label>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Sorting Matrix</label>
                        <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500"
                        >
                            <option value="newest">Incident: Newest First</option>
                            <option value="oldest">Incident: Oldest First</option>
                            <option value="severity">Priority: Severity High</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Incident Cards */}
            {loading ? (
                 <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="w-16 h-16 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-mono text-sm tracking-widest uppercase animate-pulse">Scanning Archive Database...</p>
                 </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredAccidents.length > 0 ? (
                        filteredAccidents.map((accident, idx) => (
                            <Link 
                                href={`/accidents/${accident.id}`} 
                                key={accident.id}
                                className="group block outline-none"
                            >
                                <div className="relative overflow-hidden glass p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(79,70,229,0.1)] hover:-translate-y-1">
                                    <div className="absolute top-0 right-0 w-1 h-full bg-indigo-500/0 group-hover:bg-indigo-500 transition-all" />
                                    
                                    <div className="flex flex-col lg:flex-row gap-6 justify-between lg:items-center">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-all">
                                                    <FileText size={24} />
                                                </div>
                                                <GripVertical size={16} className="text-slate-800" />
                                            </div>

                                            <div className="space-y-3 flex-1 min-w-0">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <h3 className="text-lg font-black text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight">
                                                        #{accident.fir_number}
                                                    </h3>
                                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                                                        accident.severity === 'Fatal' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                                                        accident.severity === 'Grievous' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                                                        'text-indigo-400 border-indigo-500/30 bg-indigo-500/10'
                                                    }`}>
                                                        {accident.severity}
                                                    </span>
                                                    {accident.cause && (
                                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                            <Activity size={12} className="text-slate-500" />
                                                            {accident.cause.length > 40 ? accident.cause.substring(0, 40) + '...' : accident.cause}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6">
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <MapPin size={14} className="text-indigo-500/60" />
                                                        <span className="truncate group-hover:text-slate-300 transition-colors">
                                                            {accident.address || accident.city || 'Coordinates Locked'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <History size={14} className="text-indigo-500/60" />
                                                        <span className="group-hover:text-slate-300 transition-colors">
                                                            {accident.incident_date ? new Date(accident.incident_date).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Timestamp Pending'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between lg:justify-end gap-10 pl-16 lg:pl-8 lg:border-l border-slate-800/50">
                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="text-center">
                                                    <p className="text-xs font-black text-white mb-0.5">{accident.victim_count || 0}</p>
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Casualties</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xs font-black text-white mb-0.5">{accident.vehicle_count || 0}</p>
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Vehicles</p>
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-full bg-slate-950 border border-slate-800 group-hover:border-indigo-500 group-hover:bg-indigo-500/10 transition-all">
                                                <ChevronRight className="text-slate-700 group-hover:text-indigo-400 transition-colors" size={20} />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Abstract Data Visualizer */}
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-800">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${
                                                accident.severity === 'Fatal' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                                                accident.severity === 'Grievous' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' :
                                                'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                                            }`} 
                                            style={{ width: `${Math.max(15, (idx + 1) * 7.5 % 100)}%` }} 
                                        />
                                    </div>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-32 rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/20 text-center space-y-4">
                            <div className="p-6 bg-slate-800/50 rounded-full text-slate-600">
                                <AlertTriangle size={48} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-300">Archive Retrieval Failure</h3>
                                <p className="text-slate-500 text-sm">No records matching your search signature were found in the registry.</p>
                            </div>
                            <button 
                                onClick={() => { setSearchTerm(''); setSeverityFilter('All'); }}
                                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all"
                            >
                                Reset Search Parameters
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
