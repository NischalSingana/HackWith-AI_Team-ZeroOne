"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function ClientLayoutHandler({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Show sidebar on all pages except the landing page
  const isAuthenticated = pathname !== '/';
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setIsMounted(true), 0);
    return () => clearTimeout(timeout);
  }, []);

  // Prevent layout shift during SSR hydration mismatch
  if (!isMounted) {
     return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <>
      {isAuthenticated && <Sidebar />}
      <main className={`${isAuthenticated ? 'ml-0 lg:ml-72' : 'ml-0'} min-h-screen bg-slate-950 px-6 lg:px-12 py-8 lg:py-12 relative transition-all duration-300`}>
        {/* Subtle global gradient glow */}
        <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none -z-10 translate-x-[-50%] translate-y-[-50%]" />
        
        <div className={isAuthenticated ? "max-w-[1400px] mx-auto" : "w-full min-h-screen flex flex-col"}>
          <div className={isAuthenticated ? "" : "flex-grow flex flex-col"}>
             {children}
          </div>
          
          <footer className="mt-12 py-6 text-center text-slate-500 text-sm border-t border-slate-800">
            <p>
              Developed by{' '}
              <a 
                href="#" 
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Team ZeroOne
              </a>
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
