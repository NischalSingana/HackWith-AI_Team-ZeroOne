"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
    FileText, 
    Search, 
    MapPin, 
    Calendar, 
    AlertTriangle, 
    ChevronRight,
    Users,
    Car,
    Filter,
    ArrowUpDown,
    X
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
                if (data.success) {
                    setAccidents(data.data);
                }
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

        // Severity filter
        if (severityFilter !== 'All') {
            result = result.filter(acc => acc.severity === severityFilter);
        }

        // Date range filter
        if (dateFrom) {
            result = result.filter(acc => acc.incident_date && new Date(acc.incident_date) >= new Date(dateFrom));
        }
        if (dateTo) {
            result = result.filter(acc => acc.incident_date && new Date(acc.incident_date) <= new Date(dateTo + 'T23:59:59'));
        }

        // Sort
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

    const clearFilters = () => {
        setSeverityFilter('All');
        setDateFrom('');
        setDateTo('');
    };

    const getSeverityColor = (severity: string) => {
        switch(severity) {
            case 'Fatal': return 'text-red-400 bg-red-500/10 border-red-500/20';
            case 'Grievous': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'Simple': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
        }
    };

    const getCauseColor = (cause: string) => {
        if (!cause) return 'bg-slate-500/10 text-slate-400';
        const l = cause.toLowerCase();
        if (l.includes('speed') || l.includes('rash')) return 'bg-red-500/10 text-red-300';
        if (l.includes('drunk') || l.includes('alcohol')) return 'bg-purple-500/10 text-purple-300';
        if (l.includes('negligence') || l.includes('careless')) return 'bg-amber-500/10 text-amber-300';
        return 'bg-indigo-500/10 text-indigo-300';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        Accident Registry
                    </h1>
                    <p className="text-slate-400 mt-1">
                        {filteredAccidents.length} of {accidents.length} records
                        {hasActiveFilters && <span className="text-indigo-400 ml-1">• Filtered</span>}
                    </p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search FIR #, cause, location..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm text-slate-200 placeholder-slate-500"
                        />
                    </div>
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2.5 rounded-xl border transition-all ${
                            showFilters || hasActiveFilters 
                                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                    >
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-xl border border-slate-800 animate-in slide-in-from-top-2">
                    <div className="flex flex-wrap items-end gap-4">
                        {/* Severity Filter */}
                        <div>
                            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1.5 block">Severity</label>
                            <select 
                                value={severityFilter}
                                onChange={(e) => setSeverityFilter(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                            >
                                <option value="All">All Severities</option>
                                <option value="Fatal">Fatal</option>
                                <option value="Grievous">Grievous</option>
                                <option value="Simple">Simple</option>
                                <option value="Non-Injury">Non-Injury</option>
                            </select>
                        </div>

                        {/* Date From */}
                        <div>
                            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1.5 block">From Date</label>
                            <input 
                                type="date" 
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1.5 block">To Date</label>
                            <input 
                                type="date" 
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        {/* Sort By */}
                        <div>
                            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1.5 block">Sort By</label>
                            <div className="flex items-center gap-1">
                                <ArrowUpDown size={14} className="text-slate-500" />
                                <select 
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                                    className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="oldest">Oldest First</option>
                                    <option value="severity">Severity</option>
                                </select>
                            </div>
                        </div>

                        {/* Clear */}
                        {hasActiveFilters && (
                            <button 
                                onClick={clearFilters}
                                className="flex items-center gap-1 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <X size={14} /> Clear Filters
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                 <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500">Loading registry...</p>
                 </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {filteredAccidents.length > 0 ? (
                        filteredAccidents.map((accident) => (
                            <Link 
                                href={`/accidents/${accident.id}`} 
                                key={accident.id}
                                className="group block"
                            >
                                <div className="glass p-5 rounded-xl border border-slate-700 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5">
                                    <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
                                        
                                        {/* Left: Basic Info */}
                                        <div className="flex items-start gap-3">
                                            <div className="p-2.5 bg-slate-800 rounded-lg group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                                                        FIR {accident.fir_number}
                                                    </h3>
                                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getSeverityColor(accident.severity)}`}>
                                                        {accident.severity}
                                                    </span>
                                                    {accident.cause && (
                                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${getCauseColor(accident.cause)}`}>
                                                            {accident.cause.length > 30 ? accident.cause.substring(0, 30) + '...' : accident.cause}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-slate-400">
                                                    <div className="flex items-center gap-1">
                                                        <MapPin size={12} className="text-slate-500" />
                                                        <span>{accident.address || accident.city || 'Unknown Location'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Calendar size={12} className="text-slate-500" />
                                                        <span>{accident.incident_date ? new Date(accident.incident_date).toLocaleDateString() : 'Date Unknown'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Stats & Arrow */}
                                        <div className="flex items-center gap-5 md:pl-4 md:border-l border-slate-700/50">
                                            <div className="flex flex-col items-center">
                                                <div className="flex items-center gap-1 text-slate-300">
                                                    <Users size={14} />
                                                    <span className="font-semibold text-sm">{accident.victim_count || 0}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-500">Victims</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="flex items-center gap-1 text-slate-300">
                                                    <Car size={14} />
                                                    <span className="font-semibold text-sm">{accident.vehicle_count || 0}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-500">Vehicles</span>
                                            </div>
                                            
                                            <div className="hidden md:block pl-3">
                                                <ChevronRight className="text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" size={18} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <div className="text-center py-20 bg-slate-800/30 rounded-xl border border-slate-700/50">
                            <AlertTriangle className="mx-auto text-slate-600 mb-3" size={32} />
                            <h3 className="text-lg font-semibold text-slate-300">No records found</h3>
                            <p className="text-slate-500">Try adjusting your search or filter criteria</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
