"use client";

import { motion } from "framer-motion";
import { DotGlobeHero } from "@/components/ui/globe-hero";
import { ArrowRight, LogIn, Sparkles, UserPlus, LayoutDashboard } from "lucide-react";
import { loadAuth } from "@/api";
import { BrandLogo } from "@/components/ui/BrandLogo";

export interface DotGlobeHeroDemoProps {
  onLogin?: () => void;
  onSignUp?: () => void;
}

export default function DotGlobeHeroDemo({ onLogin, onSignUp }: DotGlobeHeroDemoProps) {
  const user = loadAuth()?.user;

  const handleLogin = () => {
    if (onLogin) onLogin();
    else window.location.hash = "#/login";
  };

  const handleSignUp = () => {
    if (onSignUp) onSignUp();
    else window.location.hash = "#/login";
  };

  return (
    <DotGlobeHero
      rotationSpeed={0.0035}
      className="bg-gradient-to-b from-[#030712] via-[#09090b] to-[#050508] relative overflow-hidden text-zinc-100"
    >
      {/* Dark mode atmospheric glows without flickering or loading animations */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(219,75,22,0.18),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-[#030712]/70" />
      <div className="absolute top-1/4 left-1/4 w-[32rem] h-[32rem] bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Floating Nav Bar */}
      <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-6 sm:px-12 py-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <BrandLogo className="w-7 h-7" />
          <span className="text-lg font-bold tracking-tight text-white">BrandGuard</span>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <a
              href="#/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg backdrop-blur-md transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Open Dashboard ({user.role})
            </a>
          ) : (
            <button
              onClick={handleLogin}
              className="text-xs font-semibold uppercase tracking-wider text-zinc-300 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </header>
      
      <div className="relative z-10 text-center space-y-10 max-w-5xl mx-auto px-6 py-20 mt-8">
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Static Top Pill Badge without loading or ping animations */}
          <div className="relative inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-2xl">
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span className="relative z-10 text-xs font-semibold text-orange-400 tracking-wider uppercase">
              BrandGuard · Autonomous Brand Governance
            </span>
          </div>
          
          {/* Main Hero Headline */}
          <div className="space-y-4">
            <h1 
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.92] select-none text-white"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              <span className="block font-light text-zinc-400 mb-2 text-3xl sm:text-5xl md:text-6xl">
                Protect & Align
              </span>
              <span className="block relative">
                <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 bg-clip-text text-transparent font-black relative z-10">
                  Global Brand Integrity
                </span>
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 bg-clip-text text-transparent font-black blur-2xl opacity-35 scale-105 pointer-events-none" 
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  Global Brand Integrity
                </div>
                <div className="absolute -bottom-3 left-0 h-1.5 w-full bg-gradient-to-r from-orange-500 via-amber-500 to-transparent rounded-full shadow-[0_0_15px_rgba(249,115,22,0.6)]" />
              </span>
            </h1>
          </div>
          
          {/* Subtitle */}
          <div className="max-w-3xl mx-auto space-y-3 pt-4">
            <p 
              className="text-lg sm:text-xl md:text-2xl text-zinc-300 leading-relaxed font-normal" 
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              Real-time multi-channel copy review with our{" "}
              <span className="text-white font-medium bg-white/[0.08] px-2.5 py-1 rounded-md border border-white/15">
                governed LLM + deterministic rule engine
              </span>
            </p>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl mx-auto">
              Verify claims, eliminate prohibited vocabulary, enforce accessibility guidelines, and eliminate SLA breaches across every market.
            </p>
          </div>
        </motion.div>

        {/* Bottom Action Buttons: Login and Sign up */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2">
          {/* Login Button */}
          <button
            type="button"
            onClick={handleLogin}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-3.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl font-semibold text-base shadow-[0_0_30px_rgba(219,75,22,0.35)] border border-orange-400/30 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer w-full sm:w-auto"
          >
            <LogIn className="w-5 h-5 transition-transform group-hover:scale-110" />
            <span className="tracking-wide">Log in</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          
          {/* Sign up / Demo Access Button */}
          <button
            type="button"
            onClick={handleSignUp}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-3.5 border border-white/15 hover:border-orange-500/50 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-100 rounded-xl font-semibold text-base transition-all duration-300 backdrop-blur-xl shadow-lg hover:scale-105 active:scale-95 cursor-pointer w-full sm:w-auto"
          >
            <UserPlus className="w-5 h-5 text-orange-400 transition-transform group-hover:scale-110" />
            <span className="tracking-wide">Sign up / Demo Access</span>
          </button>
        </div>

        <div className="text-xs text-zinc-500 pt-6">
          Advisory AI findings · Human-in-the-loop approvals · Full cryptographic audit trail
        </div>
      </div>
    </DotGlobeHero>
  );
}

export { DotGlobeHeroDemo };
