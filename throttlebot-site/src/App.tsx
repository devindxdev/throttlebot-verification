// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Car, 
  Cpu, 
  BarChart3, 
  Terminal, 
  Users, 
  CheckCircle2, 
  ArrowRight, 
  Menu, 
  X, 
  Gavel, 
  Database,
  Gauge,
  Activity,
  Zap,
  Radio,
  Scan,
  Crosshair,
  Github,
  Tags,
  LayoutGrid,
  Server,
  ImageOff
} from 'lucide-react';

import garageCard from './assets/garage-card-view.png';
import garageTags from './assets/garage-tag-view.png';
import rejectImg from './assets/auto-deny.png';
import approveImg from './assets/auto-approval.png';
import logoPng from './assets/logo.png';

const SCREENSHOTS = {
  garage: garageCard,
  garageTags: garageTags,
  reject: rejectImg,
  approve: approveImg,
};

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeGarageTab, setActiveGarageTab] = useState('card'); // 'card' or 'tags'
  const topBrands = [
    { name: 'Ford', count: 392 },
    { name: 'Chevrolet', count: 333 },
    { name: 'BMW', count: 280 },
    { name: 'Toyota', count: 275 },
    { name: 'Honda', count: 225 },
    { name: 'Mercedes-Benz', count: 145 },
    { name: 'Nissan', count: 142 },
  ];
  
  // Stats State
  const [stats, setStats] = useState({
    users: 222045,
    verifiedVehicles: 5388,
    totalVerifications: 6454,
    guilds: 100
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch Stats from API with Error Handling
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('https://throttlebot-verify.herokuapp.com/status', {
             method: 'GET',
             headers: {
                 'Accept': 'application/json'
             }
        });
        
        if (!response.ok) {
             throw new Error(`Status code: ${response.status}`);
        }

        const data = await response.json();
        if (data && data.status === 'ok') {
          setStats({
            users: data.users || 0,
            verifiedVehicles: data.verifiedVehicles || 0,
            totalVerifications: data.totalVerifications || 0,
            guilds: data.guilds || 0
          });
        }
      } catch (error) {
        console.warn("Live telemetry unavailable (likely CORS). Using cached stats.");
      }
    };
    
    fetchStats();
    // Poll every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-600 selection:text-white overflow-x-hidden relative">
      
      {/* Global Background Noise Texture */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

      {/* Navigation */}
      <nav 
        className={`fixed top-0 w-full z-50 transition-all duration-300 border-b ${
          isScrolled || mobileMenuOpen ? 'bg-black/90 backdrop-blur-xl border-white/10 py-4' : 'bg-transparent border-transparent py-6'
        }`}
      >
        <div className="container mx-auto px-6 flex justify-between items-center relative">
          {/* Nav Background Glow */}
          {isScrolled && <div className="absolute inset-0 bg-gradient-to-r from-red-600/5 via-transparent to-red-600/5 pointer-events-none"></div>}

          <div className="flex items-center gap-4 cursor-pointer z-20" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 relative flex items-center justify-center bg-white/5 rounded-lg border border-white/10 p-1 group overflow-hidden">
               <div className="absolute inset-0 bg-red-600/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
               <img 
                 src={logoPng} 
                 alt="ThrottleBot Logo" 
                 className="w-full h-full object-contain relative z-10"
                 onError={(e) => {
                   (e.target as HTMLImageElement).style.display = 'none';
                 }}
               />
               <Car className="w-5 h-5 text-red-500 absolute hidden first:block z-10" /> 
            </div>
            <span className="font-bold text-xl tracking-tight flex flex-col leading-none">
              <span>THROTTLE<span className="text-red-600">BOT</span></span>
              <span className="text-[9px] text-neutral-500 font-mono tracking-widest uppercase">Verification System</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {[
              { label: 'Garage', target: 'garage' },
              { label: 'Features', target: 'features' },
              { label: 'Commands', target: 'commands' },
              { label: 'Stats', target: 'telemetry' },
            ].map((item) => (
              <button 
                key={item.label}
                onClick={() => scrollToSection(item.target)} 
                className="px-6 py-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors uppercase tracking-widest relative group"
              >
                <span className="relative z-10">{item.label}</span>
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-red-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
              </button>
            ))}
            <div className="w-px h-8 bg-white/10 mx-4"></div>
            
            <a 
              href="https://github.com/devindxdev/throttlebot-verification" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-md transition-all mr-2 group"
              title="View on GitHub"
            >
              <Github className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </a>

            <a
              href="https://discord.com/api/oauth2/authorize?client_id=851411747641884712&permissions=157035129920&scope=bot%20applications.commands"
              className="bg-white text-black hover:bg-neutral-200 px-6 py-2.5 skew-x-[-12deg] text-sm font-bold transition-all flex items-center gap-2 group shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] active:scale-95"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="skew-x-[12deg] flex items-center gap-2">
                DEPLOY <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </a>
          </div>

          <button className="md:hidden text-white z-20 p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Improved Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-0 left-0 w-full h-screen bg-[#050505]/95 backdrop-blur-xl z-10 pt-24 px-6 animate-fade-in-down">
             <div className="flex flex-col gap-6 text-center">
            {[
              { label: 'Garage', target: 'garage' },
              { label: 'Features', target: 'features' },
              { label: 'Commands', target: 'commands' },
              { label: 'Stats', target: 'telemetry' },
            ].map((item) => (
                  <button 
                    key={item.label}
                    onClick={() => {
                        scrollToSection(item.target);
                        setMobileMenuOpen(false);
                    }} 
                    className="text-xl font-bold text-white py-4 border-b border-white/10 active:text-red-500 transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
                <button className="bg-red-600 text-white py-4 rounded-lg font-bold text-lg mt-4 shadow-lg shadow-red-900/20 active:scale-95 transition-transform">
                  Add to Discord
                </button>
                <div className="flex justify-center mt-8">
                    <a
                      href="https://github.com/devindxdev/throttlebot-verification"
                      className="text-neutral-500 hover:text-white"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View on GitHub"
                    >
                      <Github size={24} />
                    </a>
                </div>
             </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-12 md:pt-48 md:pb-32 overflow-hidden border-b border-white/5">
        
        {/* Complex Background Geometry */}
        <div className="absolute inset-0 pointer-events-none">
           {/* Perspective Grid Floor */}
           <div className="absolute bottom-0 left-[-50%] right-[-50%] h-[60vh] bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [transform:perspective(1000px)_rotateX(70deg)] origin-bottom"></div>
           {/* Mobile-optimized glows */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[1000px] h-[300px] md:h-[600px] bg-red-600/10 md:bg-red-600/5 blur-[80px] md:blur-[150px] rounded-full mix-blend-screen"></div>
        </div>

        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
            
            {/* HUD Status Bar */}
            <div className="flex items-center gap-0 mb-8 md:mb-12 border border-white/10 bg-black/50 backdrop-blur-md rounded-full overflow-hidden scale-90 md:scale-100">
               <div className="px-4 py-2 border-r border-white/10 flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                  <span className="text-[10px] font-mono text-emerald-500 font-bold uppercase tracking-wide">System Online</span>
               </div>
               <div className="px-4 py-2 border-r border-white/10 flex items-center gap-2 hidden sm:flex">
                  <Activity className="w-3 h-3 text-neutral-500" />
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Ping: 14ms</span>
               </div>
               <div className="px-4 py-2 flex items-center gap-2 bg-white/5">
                  <span className="text-[10px] font-mono text-white font-bold uppercase">v2.4.0</span>
               </div>
            </div>
            
            {/* Main Headline */}
            <div className="relative mb-6 md:mb-8">
              <h1 className="text-5xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.95] md:leading-[0.9] text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40">
                PRECISION <br />
                <span className="text-white">VERIFICATION.</span>
              </h1>
              {/* Decorative HUD Lines (Hidden on mobile) */}
              <div className="absolute -left-8 top-0 w-1 h-20 bg-red-600 hidden lg:block"></div>
              <div className="absolute -right-8 bottom-0 w-1 h-20 bg-red-600 hidden lg:block"></div>
            </div>
            
            <p className="text-base md:text-xl text-neutral-400 mb-8 md:mb-12 max-w-2xl font-light leading-relaxed border-l-2 border-red-600/50 pl-10 md:pl-10 text-left md:text-center">
              The automated standard for automotive communities. <br className="hidden md:block" />
              <span className="text-white font-medium">AI-assisted verification</span>, persistent user garages, and fleet analytics.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 w-full sm:w-auto z-20">
              <button className="w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 bg-red-600 hover:bg-red-500 text-white skew-x-0 md:skew-x-[-12deg] rounded md:rounded-none font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-[0_10px_40px_-10px_rgba(220,38,38,0.5)] active:scale-95">
                <span className="md:skew-x-[12deg] flex items-center gap-2">
                   INITIATE SETUP <ArrowRight className="w-4 h-4" />
                </span>
              </button>
              <button
                onClick={() => scrollToSection('garage')}
                className="w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 bg-transparent hover:bg-white/5 text-white border border-white/20 skew-x-0 md:skew-x-[-12deg] rounded md:rounded-none font-bold text-sm transition-all group active:scale-95 text-center"
              >
                <span className="md:skew-x-[12deg] flex items-center justify-center">
                  VIEW GARAGE
                </span>
              </button>
            </div>
          </div>

          {/* Hero Visual - Real Screenshot Wrapper */}
          <div className="mt-16 md:mt-32 relative max-w-5xl mx-auto group">
             {/* Floating Glass Cards - Hidden on Mobile */}
             <div className="absolute -left-16 top-1/4 z-20 animate-float hidden lg:block">
                <GlassCard icon={<Cpu className="text-red-500" />} label="AI DECISION" value="APPROVED" sub="98% MATCH" />
             </div>
             <div className="absolute -right-16 top-3/4 z-20 animate-float-delayed hidden lg:block">
                 <GlassCard icon={<Database className="text-blue-500" />} label="ENTRY CREATED" value="#4821" sub="DATABASE UPDATED" />
             </div>

             {/* Screenshot Container */}
             <div className="relative rounded-lg md:rounded-xl overflow-hidden shadow-2xl shadow-red-900/20 border border-white/10 bg-[#1E1F22] ring-1 ring-white/5 transform transition-transform duration-700 hover:scale-[1.01]">
                {/* Mock Discord Title Bar */}
                <div className="h-6 md:h-8 bg-[#202225] flex items-center px-3 md:px-4 gap-2 border-b border-black/20">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#ED4245]"></div>
                        <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#FAA61A]"></div>
                        <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#3BA55C]"></div>
                    </div>
                    <div className="ml-2 md:ml-4 text-[10px] md:text-xs font-bold text-neutral-500 truncate">ThrottleBot.exe — Discord Verification</div>
                </div>
                
                {/* Image #4: Auto-Approve (Hero) */}
                <SmartImage 
                    src={SCREENSHOTS.approve} 
                    alt="ThrottleBot Auto-Approval Interface" 
                    className="w-full h-auto opacity-100 md:opacity-90 group-hover:opacity-100 transition-opacity"
                />
                
                {/* Overlay Gradient for seamless bottom blend */}
                <div className="absolute bottom-0 left-0 w-full h-12 md:h-32 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none"></div>
             </div>
          </div>
        </div>
      </section>

      {/* Scrolling Marquee / Separator */}
      <div className="w-full border-y border-white/10 bg-black/50 backdrop-blur-sm overflow-hidden py-3">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...Array(10)].map((_, i) => (
             <span key={i} className="mx-4 md:mx-8 text-[10px] md:text-xs font-mono font-bold text-neutral-600 uppercase tracking-[0.2em] flex items-center gap-4">
                <span>Verification</span>
                <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                <span>Garage</span>
                <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                <span>Analytics</span>
                <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                <span>Security</span>
                <span className="w-1 h-1 bg-red-600 rounded-full"></span>
             </span>
          ))}
        </div>
      </div>

      {/* NEW: Live Network Stats Section */}
      <section id="telemetry" className="py-16 md:py-20 bg-gradient-to-b from-[#080808] to-black border-b border-white/5 relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-sm md:text-lg font-mono font-bold text-red-500 uppercase tracking-widest flex items-center justify-center gap-2 mb-2">
              <Activity className="animate-pulse" size={16} /> Live Network Telemetry
            </h2>
            <p className="text-neutral-500 text-xs md:text-sm">Real-time verification metrics across the network</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <StatBox 
              label="TOTAL USERS" 
              value={formatNumber(stats.users)} 
              icon={<Users className="text-white" size={20} />} 
              sub="Unique IDs"
            />
            <StatBox 
              label="VERIFIED RIDES" 
              value={formatNumber(stats.verifiedVehicles)} 
              icon={<Car className="text-red-500" size={20} />} 
              sub="In Garage"
            />
            <StatBox 
              label="TOTAL VERIFICATIONS" 
              value={formatNumber(stats.totalVerifications)} 
              icon={<ShieldCheck className="text-white" size={20} />} 
              sub="Processed"
            />
            <StatBox 
              label="ACTIVE SERVERS" 
              value={formatNumber(stats.guilds)} 
              icon={<Server className="text-red-500" size={20} />} 
              sub="Guilds"
            />
          </div>

          {/* Vehicle stats under telemetry */}
          <div className="mt-10 bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 md:p-8">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
              <div>
                <p className="text-red-400 uppercase text-xs font-bold tracking-[0.3em] mb-2">Vehicle Stats</p>
                <h3 className="text-xl font-bold text-white">Top verified brands</h3>
              </div>
              <div className="text-[11px] font-mono text-neutral-500">Live from verification data</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topBrands.map((b, i) => (
                <div
                  key={b.name}
                  className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3 hover:border-red-500/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-red-600/15 text-red-300 font-bold text-xs flex items-center justify-center border border-red-600/30">
                      {i + 1}
                    </span>
                    <span className="font-semibold text-white">{b.name}</span>
                  </div>
                  <span className="font-mono text-sm text-neutral-300">{b.count.toLocaleString()} vehicles</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* NEW: Digital Garage Showcase */}
      <section id="garage" className="py-20 md:py-32 bg-[#080808] relative border-b border-white/5">
         <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-8">
                <div className="max-w-xl">
                    <div className="flex items-center gap-2 mb-4 text-red-500 font-mono text-xs uppercase tracking-widest">
                        <Database size={14} /> User Persistence
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight leading-none">
                        THE DIGITAL <br />
                        <span className="text-neutral-600">GARAGE.</span>
                    </h2>
                    <p className="text-neutral-400 leading-relaxed text-sm md:text-base">
                        Every approved vehicle is permanently indexed in a per-user garage. Users can tag their builds, search globally, and showcase their fleet.
                    </p>
                </div>

                {/* Tab Toggles - Mobile Stack / Desktop Row */}
                <div className="flex flex-col sm:flex-row w-full sm:w-auto p-1 bg-white/5 rounded-lg border border-white/10 gap-1">
                    <button 
                        onClick={() => setActiveGarageTab('card')}
                        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-md text-xs font-bold transition-all ${activeGarageTab === 'card' ? 'bg-red-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white'}`}
                    >
                        <LayoutGrid size={16} /> CARD VIEW
                    </button>
                    <button 
                        onClick={() => setActiveGarageTab('tags')}
                        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-md text-xs font-bold transition-all ${activeGarageTab === 'tags' ? 'bg-red-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white'}`}
                    >
                        <Tags size={16} /> TAGS VIEW
                    </button>
                </div>
            </div>

            {/* Garage Screenshots Area */}
            <div className="relative bg-[#000] rounded-xl border border-white/10 overflow-hidden shadow-2xl min-h-[300px] md:min-h-[600px] flex items-center justify-center">
                 {/* Background Grid */}
                 <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:2rem_2rem]"></div>

                 {/* Active Image */}
                 <div className="relative z-10 p-4 md:p-8 w-full max-w-4xl transition-all duration-500">
                    <SmartImage 
                        src={activeGarageTab === 'card' ? SCREENSHOTS.garage : SCREENSHOTS.garageTags} 
                        alt="ThrottleBot Garage Interface" 
                        className="w-full h-auto rounded-lg shadow-2xl border border-white/5"
                    />
                 </div>
            </div>
         </div>
      </section>

      {/* NEW: AI Rejection/Safety Section */}
      <section className="py-20 md:py-24 bg-black relative overflow-hidden">
         <div className="absolute right-0 top-0 w-1/2 h-full bg-red-900/5 blur-3xl pointer-events-none"></div>
         
         <div className="container mx-auto px-6 relative z-10">
             <div className="flex flex-col lg:grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                 {/* Left: Content */}
                 <div>
                     <div className="flex items-center gap-2 mb-4 text-red-500 font-mono text-xs uppercase tracking-widest">
                        <ShieldCheck size={14} /> Automated Guardrails
                     </div>
                     <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        SMART REJECTION <br />
                        <span className="text-neutral-500">LOGIC.</span>
                     </h2>
                     <p className="text-neutral-400 mb-8 leading-relaxed text-sm md:text-base">
                        ThrottleBot doesn't just approve; it protects. The AI analyzes image quality, detects non-vehicle photos, and enforces server-specific guidelines automatically.
                     </p>
                     
                     <div className="space-y-4">
                         <div className="flex items-start gap-4 p-4 rounded bg-white/5 border border-white/5">
                             <Scan className="text-red-500 mt-1 flex-shrink-0" size={20} />
                             <div>
                                 <h4 className="font-bold text-white text-sm">Visual Analysis</h4>
                                 <p className="text-xs text-neutral-500 mt-1">Rejects blurry images, night shots, or photos taken from screens.</p>
                             </div>
                         </div>
                         <div className="flex items-start gap-4 p-4 rounded bg-white/5 border border-white/5">
                             <Gavel className="text-red-500 mt-1 flex-shrink-0" size={20} />
                             <div>
                                 <h4 className="font-bold text-white text-sm">Instant Feedback</h4>
                                 <p className="text-xs text-neutral-500 mt-1">Users receive immediate, actionable reasons for rejection, reducing staff tickets.</p>
                             </div>
                         </div>
                     </div>
                 </div>

                 {/* Right: Reject Screenshot */}
                 <div className="relative group">
                     <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-transparent opacity-20 blur rounded-xl"></div>
                     <div className="relative bg-[#1E1F22] p-2 rounded-xl border border-white/10 shadow-2xl">
                         <div className="flex items-center gap-2 mb-2 px-2 opacity-50">
                             <div className="w-2 h-2 rounded-full bg-red-500"></div>
                             <span className="text-[10px] text-neutral-400">Automated Reply</span>
                         </div>
                         <SmartImage 
                            src={SCREENSHOTS.reject} 
                            alt="ThrottleBot Rejection Interface" 
                            className="w-full h-auto rounded border border-white/5"
                         />
                     </div>
                 </div>
             </div>
         </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 md:py-32 bg-[#050505] relative border-t border-white/5">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 md:mb-20 gap-8">
             <div className="max-w-xl">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 tracking-tight flex items-center gap-3">
                  <span className="w-8 h-1 bg-red-600"></span>
                  FULL LIFECYCLE MANAGEMENT
                </h2>
                <p className="text-neutral-400 font-light leading-relaxed text-sm md:text-base">
                  From initial submission to showroom display, ThrottleBot provides a seamless, automated workflow for vehicle verification utilizing advanced computer vision.
                </p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <FeatureCard 
              icon={<Scan className="w-8 h-8 text-red-500" />}
              title="AI Vision Triage"
              description="Computer vision analysis automatically validates vehicle models and flags high-value submissions."
            />
            <FeatureCard 
              icon={<Database className="w-8 h-8 text-white" />}
              title="Digital Garage"
              description="Persistent user profiles with global search. Build a searchable database of your community's vehicles."
            />
            <FeatureCard 
              icon={<ShieldCheck className="w-8 h-8 text-neutral-400" />}
              title="Staff Override"
              description="Granular permission overrides, audit logs, and ban enforcement for secure community management."
            />
            <FeatureCard 
              icon={<BarChart3 className="w-8 h-8 text-red-500" />}
              title="Deep Analytics"
              description="Visualize brand trends, acceptance rates, and growth metrics with integrated charting."
            />
            <FeatureCard 
              icon={<CheckCircle2 className="w-8 h-8 text-white" />}
              title="Auto-Validation"
              description="Pre-flight checks for file types, duplicates, and naming conventions before human review."
            />
            <FeatureCard 
              icon={<Users className="w-8 h-8 text-neutral-400" />}
              title="Appeal System"
              description="Integrated modal workflows for denials and appeals, keeping staff DMs clear of noise."
            />
          </div>
        </div>
      </section>

      {/* Interface/Commands Section */}
      <section id="commands" className="py-20 md:py-32 bg-black relative border-t border-white/5 overflow-x-hidden">
        {/* Background Graphic */}
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-neutral-900 to-transparent opacity-50 pointer-events-none"></div>
        <div className="absolute top-10 right-10 w-64 h-64 border border-white/5 rounded-full border-dashed animate-spin-slow opacity-20 pointer-events-none"></div>

        <div className="container mx-auto px-6 relative z-10">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
             <div>
                <div className="flex items-center gap-2 mb-6 text-red-500 font-mono text-xs uppercase tracking-widest">
                   <Terminal size={14} /> Slash Commands
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 tracking-tight leading-none">
                  BUILT FOR <br />
                  <span className="text-neutral-600">VELOCITY.</span>
                </h2>
                <div className="space-y-0 border-l border-white/10 ml-3">
                  <CommandItem cmd="/verify" text="Initiate vehicle submission workflow" />
                  <CommandItem cmd="/garage" text="Access user vehicle repository" />
                  <CommandItem cmd="/search" text="Query global vehicle database" />
                  <CommandItem cmd="/stats" text="Generate visual telemetry reports" />
                  <CommandItem cmd="/manage" text="Modify existing vehicle records" />
                </div>
             </div>

             {/* Minimalist Terminal */}
             <div className="relative">
                 {/* Decorative Corner Markers */}
                 <div className="absolute -top-2 -left-2 w-4 h-4 border-t border-l border-red-600"></div>
                 <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b border-r border-red-600"></div>

                 <div className="bg-[#050505] border border-white/10 rounded-sm p-1 shadow-2xl">
                     <div className="bg-black/50 border border-white/5 rounded-sm p-6 md:p-8 font-mono text-xs md:text-sm relative overflow-hidden overflow-x-auto">
                         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-transparent opacity-50"></div>
                         
                         <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-4 min-w-[300px]">
                             <div className="flex gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-neutral-700"></div>
                                <div className="w-2 h-2 rounded-full bg-neutral-700"></div>
                             </div>
                             <span className="text-neutral-500 ml-2">terminal — -zsh</span>
                         </div>
                         
                         <div className="space-y-6 min-w-[300px]">
                             <div className="flex gap-3">
                                 <span className="text-red-500 font-bold">➜</span>
                                 <span className="text-white">throttlebot stats --view=brands</span>
                             </div>
                             
                             <div className="pl-6 pt-2">
                                 <div className="mb-6 text-[10px] text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 border border-neutral-600 border-t-transparent rounded-full animate-spin"></span>
                                    Compiling Telemetry...
                                 </div>
                                 
                                 {/* ASCII-style modern chart */}
                                 <div className="space-y-4">
                                     <div className="group cursor-default">
                                         <div className="flex justify-between text-xs text-neutral-400 mb-2 font-mono">
                                            <span>BMW_M_SERIES</span>
                                            <span>42%</span>
                                         </div>
                                         <div className="h-4 bg-neutral-900 w-full relative overflow-hidden border border-white/5">
                                             <div className="absolute top-0 left-0 h-full w-[42%] bg-red-900/50 group-hover:bg-red-600 transition-colors duration-300"></div>
                                             {/* Grid Lines in bar */}
                                             <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20"></div>
                                         </div>
                                     </div>

                                     <div className="group cursor-default">
                                         <div className="flex justify-between text-xs text-neutral-400 mb-2 font-mono">
                                            <span>TOYOTA_GR</span>
                                            <span>38%</span>
                                         </div>
                                         <div className="h-4 bg-neutral-900 w-full relative overflow-hidden border border-white/5">
                                             <div className="absolute top-0 left-0 h-full w-[38%] bg-white/20 group-hover:bg-white/40 transition-colors duration-300"></div>
                                         </div>
                                     </div>

                                     <div className="group cursor-default">
                                         <div className="flex justify-between text-xs text-neutral-400 mb-2 font-mono">
                                            <span>PORSCHE_GT</span>
                                            <span>24%</span>
                                         </div>
                                         <div className="h-4 bg-neutral-900 w-full relative overflow-hidden border border-white/5">
                                             <div className="absolute top-0 left-0 h-full w-[24%] bg-white/10 group-hover:bg-white/30 transition-colors duration-300"></div>
                                         </div>
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
             </div>
          </div>
        </div>
      </section>

      {/* User Segments / Blueprint Section */}
      <section id="stats" className="py-20 md:py-32 bg-[#080808] border-t border-white/5 relative overflow-hidden">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-50 pointer-events-none"></div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
             <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">Role Architecture</h2>
             <div className="w-20 h-1 bg-red-600 mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <RoleColumn 
                icon={<Car className="w-5 h-5" />}
                title="MEMBERS"
                subtitle="End User"
                points={["Submit vehicle credentials", "Manage digital garage", "View server leaderboard"]}
             />
             <RoleColumn 
                icon={<ShieldCheck className="w-5 h-5" />}
                title="MODERATORS"
                subtitle="Staff Access"
                points={["Process verification queue", "Override AI decisions", "View audit logs"]}
                highlight
             />
             <RoleColumn 
                icon={<Gauge className="w-5 h-5" />}
                title="ADMINS"
                subtitle="Root Access"
                points={["Configure channel routes", "Access brand analytics", "Manage role associations"]}
             />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-white/10 pt-20 pb-10">
        <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16 border-b border-white/5 pb-16">
                <div className="col-span-1 md:col-span-2">
                    <div className="flex items-center gap-3 mb-6 opacity-90">
                        <div className="w-8 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                            <img src={logoPng} alt="ThrottleBot logo" className="w-5 h-5 object-contain" />
                        </div>
                        <span className="font-bold text-lg text-white tracking-tight">ThrottleBot</span>
                    </div>
                    <p className="text-neutral-500 text-sm leading-relaxed max-w-sm mb-6">
                        The definitive discord verification solution for automotive enthusiasts. Secure, automated, and built for speed.
                    </p>
                    {/* Social Link */}
                    <div className="flex gap-4">
                        <a href="https://github.com/devindxdev/throttlebot-verification" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-white transition-colors">
                            <Github className="w-5 h-5" />
                        </a>
                        <a href="https://discord.gg/Nh4A6HDZT4" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127.14 96.36" className="w-5 h-5 fill-current">
                                <path d="M107.7 8.07A105.15 105.15 0 0 0 81.08 0a72.06 72.06 0 0 0-3.36 6.91 97.68 97.68 0 0 0-29 0A72.37 72.37 0 0 0 45.36 0 105.89 105.89 0 0 0 18.64 8.09C2.66 32.65-1.6 56.6.54 80.21A105.73 105.73 0 0 0 32.3 96.36 77.7 77.7 0 0 0 39.6 86.7a68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 55.16 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 7.31 9.64A105.25 105.25 0 0 0 126.6 80.23c2.5-26.13-4.25-49.91-18.9-72.16ZM42.5 65.69c-5.48 0-9.93-5-9.93-11.14S37 43.4 42.5 43.4s9.98 5 9.93 11.15S48 65.69 42.5 65.69Zm42.14 0c-5.48 0-9.93-5-9.93-11.14S79.16 43.4 84.64 43.4s10 5 9.94 11.15-4.45 11.14-9.94 11.14Z" />
                            </svg>
                        </a>
                    </div>
                </div>
                
                <div>
                   <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-6">Product</h4>
                   <ul className="space-y-4 text-sm text-neutral-500">
                      <li><a href="#" className="hover:text-red-500 transition-colors">Features</a></li>
                      <li><a href="#" className="hover:text-red-500 transition-colors">Security</a></li>
                      <li><a href="#" className="hover:text-red-500 transition-colors">Integration</a></li>
                      <li><a href="#" className="hover:text-red-500 transition-colors">Changelog</a></li>
                   </ul>
                </div>

                <div>
                   <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-6">Legal</h4>
                   <ul className="space-y-4 text-sm text-neutral-500">
                      <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                      <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                      <li><a href="#" className="hover:text-white transition-colors">Data Processing</a></li>
                   </ul>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-neutral-600 font-mono text-center md:text-left">
                <div>&copy; 2024 THROTTLEBOT. ALL SYSTEMS NOMINAL.</div>
                <div className="flex items-center justify-center md:justify-end gap-2">
                   <div className="w-2 h-2 bg-emerald-900 rounded-full border border-emerald-500/50"></div>
                   <span>OPERATIONAL</span>
                </div>
            </div>
        </div>
      </footer>
    </div>
  );
};

// --- Components ---

const SmartImage = ({ src, alt, className }) => {
    const [error, setError] = useState(false);

    if (error) {
        return (
            <div className={`flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-lg ${className}`} style={{ minHeight: '200px' }}>
                <ImageOff className="w-10 h-10 text-neutral-600 mb-2" />
                <span className="text-xs text-neutral-500 font-mono">IMAGE SIGNAL LOST</span>
            </div>
        );
    }

    return (
        <img 
            src={src} 
            alt={alt} 
            className={className} 
            onError={() => setError(true)}
            referrerPolicy="no-referrer"
        />
    );
};

const GlassCard = ({ icon, label, value, sub }) => (
    <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-lg shadow-2xl flex items-center gap-4 min-w-[200px] ring-1 ring-white/5">
        <div className="p-3 bg-white/5 rounded-md border border-white/5">
            {icon}
        </div>
        <div>
            <div className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest mb-0.5">{label}</div>
            <div className="text-lg font-bold text-white leading-none mb-0.5">{value}</div>
            <div className="text-[9px] text-red-500 font-mono uppercase">{sub}</div>
        </div>
    </div>
);

const StatBox = ({ label, value, icon, sub }) => (
  <div className="p-4 md:p-6 bg-[#0F0F0F] border border-white/5 rounded-lg group hover:border-red-600/30 transition-all duration-300 relative overflow-hidden">
     <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        {icon}
     </div>
     <div className="flex items-center gap-3 mb-2 md:mb-4">
        <div className="p-2 bg-white/5 rounded-md text-neutral-400 group-hover:text-red-500 transition-colors">
           {icon}
        </div>
        <div className="text-[8px] md:text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{label}</div>
     </div>
     <div className="text-2xl md:text-3xl font-bold text-white font-mono tracking-tighter mb-1">{value}</div>
     <div className="text-[10px] md:text-xs text-neutral-600 font-mono">{sub}</div>
     
     <div className="absolute bottom-0 left-0 w-full h-[2px] bg-red-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
  </div>
);

const FeatureCard = ({ icon, title, description }) => (
  <div className="bg-[#0A0A0A] p-6 md:p-8 border border-white/5 hover:border-red-600/30 transition-all duration-500 group relative overflow-hidden">
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Crosshair size={40} />
    </div>
    <div className="mb-4 md:mb-6 opacity-80 group-hover:opacity-100 transition-opacity group-hover:scale-110 duration-500 origin-left">
        {icon}
    </div>
    <h3 className="text-lg font-bold text-white mb-2 md:mb-3 uppercase tracking-tight">{title}</h3>
    <p className="text-sm text-neutral-500 leading-relaxed font-light">{description}</p>
    
    <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-red-600 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
  </div>
);

const CommandItem = ({ cmd, text }) => (
    <div className="flex items-center gap-4 md:gap-6 py-4 md:py-5 border-b border-white/5 pl-2 md:pl-4 group hover:bg-white/[0.02] transition-colors relative overflow-hidden">
        <div className="absolute left-0 top-0 h-full w-[2px] bg-red-600 -translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
        <div className="font-mono text-[10px] md:text-xs font-bold text-red-500 bg-red-500/10 px-2 md:px-3 py-1.5 rounded border border-red-500/20">
            {cmd}
        </div>
        <span className="text-xs md:text-sm text-neutral-400 group-hover:text-white transition-colors truncate">{text}</span>
    </div>
);

const RoleColumn = ({ icon, title, subtitle, points, highlight }) => (
    <div className={`p-6 md:p-8 border ${highlight ? 'border-red-600/30 bg-red-900/[0.02]' : 'border-white/5 bg-[#0A0A0A]'} relative group transition-all hover:border-white/20`}>
        {highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-red-600 text-[9px] font-bold text-white uppercase tracking-widest rounded-full shadow-lg shadow-red-900/50">Recommended</div>}
        
        <div className="flex items-center gap-4 mb-6 md:mb-8">
            <div className={`p-3 rounded-md ${highlight ? 'bg-red-600/10 text-red-500' : 'bg-white/5 text-neutral-400'}`}>
                {icon}
            </div>
            <div>
               <h3 className="font-bold text-lg md:text-xl text-white tracking-tight">{title}</h3>
               <p className="text-[10px] md:text-xs text-neutral-500 uppercase font-mono tracking-widest">{subtitle}</p>
            </div>
        </div>
        <ul className="space-y-3 md:space-y-4 relative">
            {/* Connecting line */}
            <div className="absolute left-[5px] top-2 bottom-2 w-[1px] bg-white/10"></div>
            
            {points.map((point, i) => (
                <li key={i} className="flex items-start gap-4 text-xs md:text-sm text-neutral-400 relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0A0A0A] border border-white/20 mt-0.5 md:mt-1.5 z-10 group-hover:border-red-500 transition-colors flex-shrink-0"></div>
                    {point}
                </li>
            ))}
        </ul>
    </div>
);

export default LandingPage;
