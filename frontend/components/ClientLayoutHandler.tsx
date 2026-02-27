"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Cookies from "js-cookie";
import Sidebar from "@/components/Sidebar";

export default function ClientLayoutHandler({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Check authentication status whenever the pathname changes
    // This allows the sidebar to appear instantly after login without a hard refresh
    const checkAuth = () => {
      const token = Cookies.get("auth_token");
      
      // If we're on the public home page or login page, force hide the sidebar
      // even if they have an old token, to keep the UI clean (or just rely on token + route logic)
      if (pathname === '/' || pathname === '/login') {
          setIsAuthenticated(false);
      } else {
          setIsAuthenticated(!!token);
      }
    };

    checkAuth();
  }, [pathname]);

  // Prevent layout shift during SSR hydration mismatch
  if (!isMounted) {
     return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <>
      {isAuthenticated && <Sidebar />}
      <main className={`${isAuthenticated ? 'ml-0 lg:ml-64' : 'ml-0'} min-h-screen bg-slate-950 px-6 py-8 relative transition-all duration-300`}>
        {/* Subtle global gradient glow */}
        <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none -z-10 translate-x-[-50%] translate-y-[-50%]" />
        
        <div className={isAuthenticated ? "max-w-7xl mx-auto" : "w-full min-h-screen flex flex-col"}>
          <div className={isAuthenticated ? "" : "flex-grow flex flex-col"}>
             {children}
          </div>
          
          <footer className="mt-12 py-6 text-center text-slate-500 text-sm border-t border-slate-800">
            <p>
              Developed by{' '}
              <a 
                href="https://www.linkedin.com/in/singananischal/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Nischal Singana
              </a>
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
