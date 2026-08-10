import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, Save, LogOut, Plus, Trash2, Wifi, WifiOff } from 'lucide-react';
import { BirthdayPerson, Sender, PolaroidImage, Charge, CourtMember, defaultBirthdayPerson, defaultSenders, defaultPolaroids, defaultCharges, defaultCourtMembers } from '../types';
import { globalStateManager } from '../lib/globalStateManager';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function AdminPanel({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isConnected, setIsConnected] = useState(false);
  
  const [person, setPerson] = useState<BirthdayPerson>(defaultBirthdayPerson);
  const [senders, setSenders] = useState<Sender[]>(defaultSenders);
  const [theme, setTheme] = useState<'classic' | 'retro'>('classic');
  const [polaroids, setPolaroids] = useState<PolaroidImage[]>(defaultPolaroids);
  const [charges, setCharges] = useState<Charge[]>(defaultCharges);
  const [courtMembers, setCourtMembers] = useState<CourtMember[]>(defaultCourtMembers);

  useEffect(() => {
    if (localStorage.getItem('chaarYaarAdminAuth') === 'true') {
      setIsAuthenticated(true);
    }
    
    const savedPerson = localStorage.getItem('chaarYaarPerson');
    if (savedPerson) setPerson(JSON.parse(savedPerson));
    
    const savedSenders = localStorage.getItem('chaarYaarSenders');
    if (savedSenders) setSenders(JSON.parse(savedSenders));
    
    const savedTheme = localStorage.getItem('chaarYaarTheme');
    if (savedTheme === 'retro' || savedTheme === 'classic') {
      setTheme(savedTheme);
    }

    const savedPolaroids = localStorage.getItem('chaarYaarPolaroids');
    if (savedPolaroids) setPolaroids(JSON.parse(savedPolaroids));

    const savedCourt = localStorage.getItem('chaarYaarCourt');
    if (savedCourt) {
      try {
        const d = JSON.parse(savedCourt);
        if (d.charges?.length) setCharges(d.charges);
        if (d.members?.length) setCourtMembers(d.members);
      } catch (_) {}
    }
  }, [isOpen]);

  // Monitor real-time connection status
  useEffect(() => {
    const unsub = globalStateManager.onConnectionChange((connected) => {
      setIsConnected(connected);
    });
    return unsub;
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'mag85158' && password === 'magadmin') {
      setIsAuthenticated(true);
      setError('');
      localStorage.setItem('chaarYaarAdminAuth', 'true');
    } else {
      setError('System Access Denied. Invalid credentials.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    localStorage.removeItem('chaarYaarAdminAuth');
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    
    try {
      const config = { person, senders, theme, polaroids, court: { charges, members: courtMembers } };

      // 1. Save to localStorage immediately (instant local update)
      localStorage.setItem('chaarYaarPerson', JSON.stringify(person));
      localStorage.setItem('chaarYaarSenders', JSON.stringify(senders));
      localStorage.setItem('chaarYaarTheme', theme);
      localStorage.setItem('chaarYaarPolaroids', JSON.stringify(polaroids));
      localStorage.setItem('chaarYaarCourt', JSON.stringify({ charges, members: courtMembers }));

      // 2. Persist to Netlify DB via API function (survives page refresh for all users)
      // Wrapped in try/catch — endpoint is optional on static deployments (Supabase handles persistence)
      try {
        const res = await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...config, court: { charges, members: courtMembers } }),
        });
        if (!res.ok) console.debug('[AdminPanel] /api/config unavailable, using Supabase only.');
      } catch (_) { /* static deployment — expected */ }

      // 3. Broadcast + DB save via globalStateManager (handles Supabase realtime + DB)
      await globalStateManager.saveConfig(config);
      
      // 4. Dispatch custom events for backward compatibility
      window.dispatchEvent(new Event('friendsUpdated'));
      window.dispatchEvent(new Event('themeUpdated'));
      window.dispatchEvent(new Event('polaroidsUpdated'));
      
      setSaveStatus('saved');
      
      setTimeout(() => {
        setSaveStatus('idle');
        onClose();
      }, 1500);
    } catch (err) {
      // save failed - UI error state already set
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const updateSender = (id: string, field: keyof Sender, value: string) => {
    setSenders(senders.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const updatePolaroid = (id: string, field: keyof PolaroidImage, value: string) => {
    setPolaroids(polaroids.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addPolaroid = () => {
    const newId = `p${Date.now()}`;
    setPolaroids([...polaroids, { id: newId, url: '', caption: 'New Memory' }]);
  };

  const removePolaroid = (id: string) => {
    setPolaroids(polaroids.filter(p => p.id !== id));
  };

  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        updatePolaroid(id, 'url', dataUrl);
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 pointer-events-auto"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="w-full max-w-4xl glass-panel neon-border flex flex-col max-h-[90vh] rounded-3xl"
          >
            <div className="flex justify-between items-center p-5 border-b border-white/10 bg-slate-900/40 rounded-t-3xl">
              <h2 className="text-xl font-bold flex items-center gap-3 text-white tracking-wide">
                <Lock className="w-5 h-5 text-cyan-400" />
                Admin Protocol Terminal
              </h2>
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                  isConnected 
                    ? 'bg-green-500/20 text-green-300' 
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {isConnected ? (
                    <>
                      <Wifi className="w-3.5 h-3.5" />
                      <span>Live Sync</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5" />
                      <span>Offline Mode</span>
                    </>
                  )}
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                   <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto">
              {!isAuthenticated ? (
                <form onSubmit={handleLogin} className="space-y-5 max-w-sm mx-auto my-12 bg-slate-900/50 p-8 rounded-xl border border-slate-800">
                  <div className="text-center space-y-2 mb-6">
                    <Lock className="w-10 h-10 text-indigo-500/50 mx-auto" />
                    <p className="text-slate-400 text-sm">Please authenticate to continue</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-mono tracking-widest text-slate-400 uppercase">Username</label>
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      placeholder="Enter admin ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-mono tracking-widest text-slate-400 uppercase">Password</label>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                  {error && (
                    <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 p-3 rounded font-mono">
                      {error}
                    </div>
                  )}
                  <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-3 rounded-md transition-colors shadow-lg shadow-cyan-500/20 mt-6 !mt-8">
                    Authenticate
                  </button>
                </form>
              ) : (
                <div className="space-y-10">
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 drop-shadow flex-wrap gap-4">
                    <p className="text-cyan-100/80 text-sm font-medium">Configure deployed parameters. Changes sync instantly to all users globally.</p>
                    <div className="flex items-center gap-4">
                      <select 
                        value={theme}
                        onChange={(e) => setTheme(e.target.value as 'classic' | 'retro')}
                        className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="classic">Theme: Classic Cyan</option>
                        <option value="retro">Theme: Retro Green</option>
                      </select>
                      <button 
                        onClick={async () => {
                          await globalStateManager.resetIntro();
                          // Reload admin's own page so they also see the intro
                          window.location.reload();
                        }}
                        className="text-sm font-bold text-amber-400 hover:text-amber-300 flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2 rounded-lg transition-colors border border-amber-500/20"
                        title="Clear data to replay the intro/candle sequence"
                      >
                        <Trash2 className="w-4 h-4" /> Reset Intro
                      </button>
                      <button onClick={handleLogout} className="text-sm font-bold text-rose-400 hover:text-rose-300 flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 px-4 py-2 rounded-lg transition-colors border border-rose-500/20">
                        <LogOut className="w-4 h-4" /> Lock Terminal
                      </button>
                    </div>
                  </div>
                  
                  {/* Spotlight Person Configuration */}
                  <div className="space-y-5">
                    <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-fuchsia-500" />
                      Targeted Birthday Person
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/30 p-6 rounded-xl border border-slate-800/60">
                      <div className="space-y-2">
                        <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Name</label>
                        <input 
                          type="text"
                          value={person.name}
                          onChange={(e) => setPerson({...person, name: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Date Highlight</label>
                        <input 
                          type="text"
                          value={person.birthDate}
                          onChange={(e) => setPerson({...person, birthDate: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                          placeholder="e.g. March 14th"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Main Roast / Birthday Message</label>
                        <textarea 
                          value={person.roastMessage}
                          onChange={(e) => setPerson({...person, roastMessage: e.target.value})}
                          rows={3}
                          className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed"
                          placeholder="Type a funny roast message..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Senders Configuration */}
                  <div className="space-y-5">
                    <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      The Senders (Chaar Yaar)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {senders.map((sender) => (
                        <div key={sender.id} className="bg-slate-900/30 p-5 rounded-xl border border-slate-800/60 space-y-4">
                          <h4 className="font-semibold text-indigo-300/80 text-sm tracking-wide">
                            Sender #{sender.id}
                            {sender.special === 'CS' && <span className="ml-2 text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">CS</span>}
                          </h4>
                          <div className="space-y-2">
                            <label className="text-xs text-slate-500">Name</label>
                            <input 
                              type="text"
                              value={sender.name}
                              onChange={(e) => updateSender(sender.id, 'name', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-slate-500">Card Theme</label>
                            <select
                              value={sender.special}
                              onChange={(e) => updateSender(sender.id, 'special', e.target.value as 'CS' | 'None')}
                              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                            >
                              <option value="None">Normal Theme</option>
                              <option value="CS">Hacker Terminal Theme</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-slate-500">{sender.special === 'CS' ? 'Terminal Output Message' : 'Message'}</label>
                            <textarea 
                              value={sender.message}
                              onChange={(e) => updateSender(sender.id, 'message', e.target.value)}
                              rows={sender.special === 'CS' ? 3 : 2}
                              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Polaroids Configuration */}
                  <div className="space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-500" />
                        Memory Photos (Polaroids)
                      </h3>
                      <button 
                        onClick={addPolaroid}
                        className="flex items-center gap-1 text-xs bg-cyan-500/20 text-cyan-400 px-3 py-1.5 rounded hover:bg-cyan-500/30 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add Photo
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                      {polaroids.map((polaroid) => (
                        <div key={polaroid.id} className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/60 flex flex-col gap-3 relative group">
                          <button 
                            onClick={() => removePolaroid(polaroid.id)}
                            className="absolute top-2 right-2 p-1.5 bg-rose-500/20 text-rose-400 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/40"
                            title="Delete Photo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          
                          <div className="aspect-square w-full bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                            {polaroid.url ? (
                              <img src={polaroid.url} alt={polaroid.caption} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-slate-600 text-xs text-center px-4">No Image URL Provided</span>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-xs text-slate-500">Image URL</label>
                              <label className="text-xs text-indigo-400 cursor-pointer hover:text-indigo-300 font-medium">
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(polaroid.id, e)} />
                                Upload Photo 📤
                              </label>
                            </div>
                            <input 
                              type="text"
                              value={polaroid.url}
                              onChange={(e) => updatePolaroid(polaroid.id, 'url', e.target.value)}
                              placeholder="https://... OR tap Upload"
                              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-slate-500">Caption</label>
                            <input 
                              type="text"
                              value={polaroid.caption}
                              onChange={(e) => updatePolaroid(polaroid.id, 'caption', e.target.value)}
                              placeholder="Memories..."
                              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-slate-500">💬 Back Side Roast (flip pe dikhega)</label>
                            <textarea
                              value={polaroid.roastBack || ''}
                              onChange={(e) => updatePolaroid(polaroid.id, 'roastBack', e.target.value)}
                              placeholder="Yeh photo mein tu bilkul..."
                              rows={2}
                              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors leading-relaxed"
                            />
                          </div>
                        </div>
                      ))}
                      {polaroids.length === 0 && (
                        <div className="col-span-full py-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                          No photos added yet. Add a few to show the interactive polaroid pile!
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* ── Chaar Yaar Adalat Section ── */}
                  <div className="space-y-5 mt-2">
                    <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      Chaar Yaar Adalat
                    </h3>

                    {/* Charges */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-mono uppercase tracking-wider text-slate-400">📋 Ilzaam (Charges)</p>
                        <button
                          onClick={() => setCharges([...charges, { id: `c${Date.now()}`, year: new Date().getFullYear().toString(), crime: '', evidence: '', severity: 'Minor' as const }])}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-lg border border-yellow-600/30 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Naya Ilzaam
                        </button>
                      </div>
                      {charges.map((charge, idx) => (
                        <div key={charge.id} className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-slate-500">Ilzaam #{idx + 1}</span>
                            <button onClick={() => setCharges(charges.filter(c => c.id !== charge.id))} className="text-red-500 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono uppercase text-slate-500">Saal</label>
                              <input type="text" value={charge.year}
                                onChange={e => setCharges(charges.map(c => c.id === charge.id ? {...c, year: e.target.value} : c))}
                                placeholder="2022"
                                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-white text-xs focus:outline-none focus:border-yellow-500 transition-colors"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono uppercase text-slate-500">Severity</label>
                              <select value={charge.severity}
                                onChange={e => setCharges(charges.map(c => c.id === charge.id ? {...c, severity: e.target.value as Charge['severity']} : c))}
                                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-white text-xs focus:outline-none focus:border-yellow-500 transition-colors"
                              >
                                <option value="Minor">Minor</option>
                                <option value="Serious">Serious</option>
                                <option value="Heinous">Heinous</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono uppercase text-slate-500">Ilzaam (Crime)</label>
                            <input type="text" value={charge.crime}
                              onChange={e => setCharges(charges.map(c => c.id === charge.id ? {...c, crime: e.target.value} : c))}
                              placeholder="Pizza khake bill se bhaag gaya..."
                              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-white text-xs focus:outline-none focus:border-yellow-500 transition-colors"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono uppercase text-slate-500">Saboot (Evidence)</label>
                            <input type="text" value={charge.evidence}
                              onChange={e => setCharges(charges.map(c => c.id === charge.id ? {...c, evidence: e.target.value} : c))}
                              placeholder="3 gawah aur ek khali tub..."
                              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-white text-xs focus:outline-none focus:border-yellow-500 transition-colors"
                            />
                          </div>
                        </div>
                      ))}
                      {charges.length === 0 && (
                        <div className="text-center text-slate-600 text-xs font-mono py-4 border border-dashed border-slate-800 rounded-xl">
                          Koi ilzaam nahi — "Naya Ilzaam" button se add karo
                        </div>
                      )}
                    </div>

                    {/* Court Members */}
                    <div className="space-y-3">
                      <p className="text-xs font-mono uppercase tracking-wider text-slate-400">🏛️ Adalat ke Sadsya</p>
                      {courtMembers.map((member) => (
                        <div key={member.role} className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 space-y-3">
                          <span className="text-xs font-bold text-yellow-400 font-mono">{member.role}</span>
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono uppercase text-slate-500">Naam</label>
                              <input type="text" value={member.name}
                                onChange={e => setCourtMembers(courtMembers.map(m => m.role === member.role ? {...m, name: e.target.value} : m))}
                                placeholder="Adv. Ashish..."
                                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-white text-xs focus:outline-none focus:border-yellow-500 transition-colors"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono uppercase text-slate-500">Bayan (Statement)</label>
                              <textarea value={member.verdict}
                                onChange={e => setCourtMembers(courtMembers.map(m => m.role === member.role ? {...m, verdict: e.target.value} : m))}
                                placeholder="Mulzim clearly guilty hai milord..."
                                rows={2}
                                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-white text-xs focus:outline-none focus:border-yellow-500 transition-colors leading-relaxed"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex justify-end pt-6 border-t border-slate-800/80 sticky bottom-0 bg-[#0b1120] pb-2 z-10">
                    <button 
                      onClick={handleSave}
                      disabled={saveStatus !== 'idle'}
                      className={`flex items-center gap-2 px-8 py-3 rounded-lg transition-all font-semibold ${
                        saveStatus === 'idle' 
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(5,150,105,0.2)]' 
                          : saveStatus === 'saving'
                          ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.2)]'
                          : saveStatus === 'saved'
                          ? 'bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.2)]'
                          : 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.2)]'
                      }`}
                    >
                      <Save className="w-5 h-5" />
                      <span>
                        {saveStatus === 'idle' && 'Deploy Changes'}
                        {saveStatus === 'saving' && (
                          <span className="flex items-center gap-1">
                            Saving<span className="inline-flex gap-0.5">
                              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity }} className="inline-block">•</motion.span>
                              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }} className="inline-block">•</motion.span>
                              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }} className="inline-block">•</motion.span>
                            </span>
                          </span>
                        )}
                        {saveStatus === 'saved' && 'Saved! 🎉'}
                        {saveStatus === 'error' && 'Error'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
