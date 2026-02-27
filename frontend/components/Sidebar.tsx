"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  BarChart2, 
  Map, 
  UploadCloud, 
  FileText, 
  ShieldAlert, 
  Menu,
  X,
  TrendingUp,
  Home,
  MapPin,
  LogOut,
  Share2
} from "lucide-react";
import { useState, useEffect } from "react";
import Cookies from "js-cookie";

const NAV_ITEMS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Dashboard", href: "/dashboard", icon: BarChart2 },
  { label: "Strategic Insights", href: "/insights", icon: ShieldAlert },
  { label: "Trends", href: "/trends", icon: TrendingUp },
  { label: "Jurisdiction Wise", href: "/jurisdictions", icon: Map },
  { label: "Area Analysis", href: "/area-analysis", icon: MapPin },
  { label: "Accidents", href: "/accidents", icon: FileText },
  { label: "Hotspots Map", href: "/hotspots", icon: Map },
  { label: "Graph Explorer", href: "/graph-explorer", icon: Share2 },
  { label: "Upload FIR", href: "/upload", icon: UploadCloud },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      setUsername(localStorage.getItem('username'));
    });
  }, []);

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        className="fixed top-4 left-4 z-50 p-2 bg-slate-800 text-white rounded-md lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Container */}
      <aside 
        className={`fixed top-0 left-0 z-40 h-screen w-64 bg-slate-950 border-r border-slate-800 transition-transform transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full px-4 py-8">
          {/* Logo */}
          <div className="mb-10 px-2 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldAlert className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">CrimeGraph AI</h1>
              <span className="text-xs text-slate-500 font-medium">Intelligent Mapping System</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25" 
                      : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  }`}
                  onClick={() => setIsOpen(false)} // Close on mobile click
                >
                  <Icon 
                    size={20} 
                    className={`transition-colors ${isActive ? "text-white" : "text-slate-500 group-hover:text-indigo-400"}`} 
                  />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer / User Info + Logout */}
          <div className="mt-auto space-y-3">
            {username && (
              <div className="px-4 py-3 bg-slate-900/50 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-sm font-bold text-white uppercase flex-shrink-0">
                    {username.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{username}</p>
                    <p className="text-[10px] text-slate-500">Authenticated</p>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={() => {
                Cookies.remove('auth_token');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('username');
                window.location.href = '/';
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-900/30 hover:text-red-300 transition-all duration-200 group"
            >
              <LogOut size={20} className="text-slate-500 group-hover:text-red-400 transition-colors" />
              <span className="font-medium text-sm">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
