"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const NODE_COUNT = 40;
    const CONNECTION_DIST = 180;

    const nodes = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 2.5 + 1.5,
      pulse: Math.random() * Math.PI * 2,
    }));

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      const time = Date.now() * 0.001;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.25;
            ctx!.beginPath();
            ctx!.moveTo(nodes[i].x, nodes[i].y);
            ctx!.lineTo(nodes[j].x, nodes[j].y);
            ctx!.strokeStyle = `rgba(99, 182, 255, ${alpha})`;
            ctx!.lineWidth = 0.8;
            ctx!.stroke();
          }
        }
      }

      for (const n of nodes) {
        const pulseScale = 1 + Math.sin(time * 1.5 + n.pulse) * 0.3;
        const glowR = n.r * pulseScale;
        const grad = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR * 4);
        grad.addColorStop(0, "rgba(99, 182, 255, 0.3)");
        grad.addColorStop(1, "rgba(99, 182, 255, 0)");
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, glowR * 4, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, glowR, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(160, 210, 255, ${0.6 + pulseScale * 0.2})`;
        ctx!.fill();
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }
      animRef.current = requestAnimationFrame(draw);
    }
    draw();

    const handleResize = () => {
      width = canvas!.width = window.innerWidth;
      height = canvas!.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{
        background: "linear-gradient(160deg, #0a0e1a 0%, #0d1529 40%, #111d35 100%)",
      }}
    />
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error("Login error:", error.message);
      setLoading(false);
    }
  };

  const m = mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-[0.97]";

  return (
    <>
      <NetworkCanvas />
      <div className="fixed inset-0 flex items-center justify-center z-10">
        <div
          className={`w-[420px] max-w-[92vw] p-12 rounded-3xl border border-blue-400/10 transition-all duration-700 ease-out ${m}`}
          style={{
            background: "rgba(13, 18, 36, 0.75)",
            backdropFilter: "blur(40px) saturate(1.4)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 120px rgba(99,182,255,0.06)",
          }}
        >
          <div className="text-center mb-10">
            <div
              className={`w-14 h-14 mx-auto mb-5 rounded-2xl flex items-center justify-center transition-all duration-500 delay-200 ${mounted ? "opacity-100 scale-100" : "opacity-0 scale-50"}`}
              style={{
                background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
                boxShadow: "0 8px 32px rgba(37,99,235,0.35)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="3"/>
                <circle cx="5" cy="19" r="3"/>
                <circle cx="19" cy="19" r="3"/>
                <line x1="12" y1="8" x2="5" y2="16"/>
                <line x1="12" y1="8" x2="19" y2="16"/>
                <line x1="5" y1="19" x2="19" y2="19"/>
              </svg>
            </div>
            <h1
              className={`text-3xl font-light text-blue-50 tracking-tight mb-2 transition-all duration-500 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Shift<span className="text-blue-400">Connect</span>
            </h1>
            <p
              className={`text-sm text-blue-200/50 tracking-wide transition-all duration-500 delay-[400ms] ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
            >
              チームをつなぐ、シフトを変える
            </p>
          </div>

          <div
            className={`h-px bg-gradient-to-r from-transparent via-blue-400/15 to-transparent mb-8 transition-opacity duration-500 delay-[450ms] ${mounted ? "opacity-100" : "opacity-0"}`}
          />

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl border border-white/10 text-blue-100 text-[15px] font-medium tracking-wide cursor-pointer transition-all duration-500 delay-[500ms] hover:border-blue-400/30 hover:bg-white/[0.07] hover:shadow-[0_4px_24px_rgba(99,182,255,0.12)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/15 border-t-blue-400 rounded-full animate-spin" />
            ) : (
              <>
                <GoogleIcon />
                Googleアカウントでログイン
              </>
            )}
          </button>

          <p
            className={`text-center mt-7 text-xs text-blue-200/30 tracking-wide transition-opacity duration-500 delay-[600ms] ${mounted ? "opacity-100" : "opacity-0"}`}
          >
            ログインすることで
            <a href="#" className="text-blue-400/50 hover:text-blue-400/80 transition-colors"> 利用規約</a> と
            <a href="#" className="text-blue-400/50 hover:text-blue-400/80 transition-colors"> プライバシーポリシー</a> に同意します
          </p>
        </div>
      </div>
    </>
  );
}
