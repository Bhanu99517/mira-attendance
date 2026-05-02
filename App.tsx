
import React, { useState, useEffect, createContext, useContext, useMemo, useCallback, useRef } from 'react';
import {
  BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, NavLink
} from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Icons, navLinks } from './constants';
import { Role, Branch, User, Page, AttendanceRecord, Application, PPTContent, QuizContent, LessonPlanContent, LLMOutput } from './types';
import { login as apiLogin, getFaculty, getDashboardStats, getStudentByPin, markAttendance, getAttendanceForUser, sendEmail, cogniCraftService, sendLoginOtp, verifyLoginOtp } from './services';
import { SplashScreen, PermissionsPrompt, Modal, StatCard, ActionCard } from './components';
import ManageUsersPage from './components/ManageUsersPage';
import ReportsPage from './components/ReportsPage';
import ApplicationsPage from './components/ApplicationsPage';
import AttendanceLogPage from './components/AttendanceLogPage';
import SBTETResultsPage from './components/SBTETResultsPage';
import SyllabusPage from './components/SyllabusPage';
import TimetablesPage from './components/TimetablesPage';
import FeedbackPage from './components/FeedbackPage';
import SettingsPage from './components/SettingsPage';
import LandingPage from './components/LandingPage';
import NotebookLLMPage from './components/NotebookLLMPage';
import PrivacyPolicyPage from './components/PrivacyPolicyPage';
import ManageCollegesPage from './components/ManageCollegesPage';


// --- CONTEXTS ---
type Theme = 'light' | 'dark';
interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  facultyList: User[];
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  dashboardStats: { presentToday: number; absentToday: number; attendancePercentage: number; };
  refreshDashboardStats: () => Promise<void>;
  isAiAvailable: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within an AppProvider");
  return context;
};

// --- APP PROVIDER ---
const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      console.error("Failed to parse saved user", e);
      return null;
    }
  });
  const [facultyList, setFacultyList] = useState<User[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({ presentToday: 0, absentToday: 0, attendancePercentage: 0 });

  const isAiAvailable = cogniCraftService.getClientStatus().isInitialized;

  const refreshDashboardStats = useCallback(async () => {
    const stats = await getDashboardStats();
    setDashboardStats(stats);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
      getFaculty().then(setFacultyList);
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      if (user.pin !== 'bhanu99517') {
        refreshDashboardStats();
      }
    }
  }, [user, refreshDashboardStats]);

  const toggleTheme = () => setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const value = useMemo(() => ({
    theme, toggleTheme, user, setUser, logout, facultyList, isSidebarOpen, setSidebarOpen, dashboardStats, refreshDashboardStats, isAiAvailable
  }), [theme, user, facultyList, isSidebarOpen, dashboardStats, refreshDashboardStats, isAiAvailable]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// --- LAYOUT COMPONENTS ---
const Sidebar: React.FC = () => {
    const { isSidebarOpen, setSidebarOpen, user, isAiAvailable } = useAppContext();
    const navigate = useNavigate();

    const isBhanuAdmin = user?.pin === 'bhanu99517';

  if (isBhanuAdmin) return null;

  return (
      <>
          <aside className={`fixed top-0 left-0 z-40 w-64 h-screen bg-white dark:bg-slate-900 flex flex-col transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:animate-slide-in-from-left`}>
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10">
                    <div className="flex items-center cursor-pointer" onClick={() => navigate('/dashboard')}>
                        <Icons.logo className="h-8 w-8 text-primary-500 animate-logo-breath" />
                        <span className="ml-3 text-xl font-bold tracking-tight text-slate-900 dark:text-white">Mira Attendance</span>
                    </div>
                     <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white">
                        <Icons.close className="h-6 w-6"/>
                    </button>
                </div>
                <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto sidebar-scroll">
                    {navLinks.map((section) => {
                        // Filter links based on user role and permissions
                        const filteredLinks = section.links.filter(link => {
                            // 1. ManageColleges is ONLY for SUPER_ADMIN
                            if (link.name === 'ManageColleges' && user?.role !== Role.SUPER_ADMIN) return false;

                            // 2. Restriction for bhanu99517: Only ManageUsers, ManageColleges and Reports
                            if (isBhanuAdmin) {
                                return link.name === 'ManageUsers' || link.name === 'ManageColleges' || link.name === 'Reports';
                            }

                            // 3. Staff restriction: No Academics
                            if (section.title === 'Academics' && user?.role === Role.STAFF) return false;

                            // 4. Student restrictions: Hide ManageUsers, ManageColleges
                            if (user?.role === Role.STUDENT) {
                                if (link.name === 'ManageUsers' || link.name === 'ManageColleges') return false;
                            }

                            return true;
                        });

                        if (filteredLinks.length === 0) return null;

                        return (
                            <div key={section.title}>
                                <h3 className="px-3 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">{section.title}</h3>
                                <div className="space-y-1">
                                    {filteredLinks.map((link) => {
                                        const isAiLink = link.name === 'CogniCraft AI';
                                        const isDisabled = isAiLink && !isAiAvailable;

                                        return (
                                            <NavLink
                                                key={link.name}
                                                to={isDisabled ? '#' : link.path}
                                                onClick={(e) => { 
                                                    if (isDisabled) { e.preventDefault(); return; }
                                                    setSidebarOpen(false); 
                                                }}
                                                title={isDisabled ? 'CogniCraft AI is not configured by the administrator' : ''}
                                                className={({ isActive }) => `w-full flex items-center px-3 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 group ${
                                                    isActive ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' 
                                                    : isDisabled ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-primary-600 dark:hover:text-primary-400'
                                                }`}
                                            >
                                                {({ isActive }) => (
                                                    <>
                                                        <link.icon className={`h-5 w-5 mr-3 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary-500'}`} />
                                                        <span>{link.name.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                    </>
                                                )}
                                            </NavLink>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>
            </aside>
             {isSidebarOpen && <div className="fixed inset-0 bg-black opacity-60 z-30 md:hidden" onClick={() => setSidebarOpen(false)}></div>}
        </>
    );
};

const Header: React.FC = () => {
  const { user, setSidebarOpen } = useAppContext();
  const navigate = useNavigate();

  const isBhanuAdmin = user?.pin === 'bhanu99517';

  return (
    <header className="sticky top-0 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-lg z-20 border-b border-slate-200 dark:border-slate-800 animate-fade-in-down">
        <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-[72px] py-2 gap-2">
                 {!isBhanuAdmin && (
                    <button onClick={() => setSidebarOpen(true)} className="md:hidden text-slate-500 dark:text-slate-400 shrink-0">
                        <Icons.menu className="h-6 w-6"/>
                    </button>
                 )}
                <div className={`flex-1 ${!isBhanuAdmin ? 'ml-2 sm:ml-4' : ''} md:ml-0 min-w-0`}>
                    <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white truncate">Welcome, {user?.name.split(' ')[0]}!</h1>
                    <p className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-1 sm:line-clamp-none">
                        {user?.pin === 'bhanu99517' 
                            ? 'System Administrator Access' 
                            : user?.role === Role.STUDENT 
                                ? 'Track your attendance and academic progress.' 
                                : "Let's manage attendance efficiently."}
                    </p>
                </div>

                <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
                    <button 
                        onClick={() => navigate('/settings')}
                        className="flex items-center space-x-2 hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded-xl transition-all active:scale-95 mb-2"
                    >
                        <img className="h-8 w-8 sm:h-11 sm:w-11 rounded-full object-cover ring-2 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900 ring-primary-500" src={user?.imageUrl || null} alt="User avatar" />
                        <div className="text-left hidden sm:block">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{user?.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role}</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    </header>
  );
};


// --- PAGES ---

const LoginPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { setUser } = useAppContext();
    const [activeTab, setActiveTab] = useState<'pin' | 'qr'>('pin');
    const [pin, setPin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [loginStep, setLoginStep] = useState<'credentials' | 'otp'>('credentials');
    const [otp, setOtp] = useState('');
    const [userForOtp, setUserForOtp] = useState<User | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await apiLogin(pin, password);
            if (result) {
                if ('otpRequired' in result && result.otpRequired) {
                    setUserForOtp(result.user);
                    await sendLoginOtp(result.user);
                    setLoginStep('otp');
                } else if ('id' in result) {
                    setUser(result);
                }
            } else {
                setError('Invalid PIN or Password. Please try again.');
            }
        } catch (err) {
            setError('An unexpected error occurred during login.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userForOtp) return;
        setError('');
        setLoading(true);
        try {
            const verifiedUser = await verifyLoginOtp(userForOtp.id, otp);
            if (verifiedUser) {
                setUser(verifiedUser);
            } else {
                setError('Invalid OTP. Please try again.');
            }
        } catch (err) {
            setError('An unexpected error occurred during OTP verification.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    
    const handleBackToLogin = () => {
        setLoginStep('credentials');
        setUserForOtp(null);
        setError('');
        setOtp('');
        setPin('');
        setPassword('');
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-gradient-to-br from-primary-700 via-accent-500 to-primary-900 opacity-40 animate-gradient-bg"></div>
             <div className="absolute bottom-0 left-0 w-full h-full bg-gradient-radial from-slate-900/10 to-slate-900"></div>
            <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-8 z-10 animate-fade-in-down">
                {loginStep === 'credentials' ? (
                    <>
                        <button onClick={onBack} className="text-slate-400 hover:text-white mb-6 flex items-center gap-2 text-sm font-semibold group">
                            <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Back to Home
                        </button>
                        <div className="text-center mb-8">
                            <Icons.logo className="h-16 w-16 mx-auto text-primary-500 animate-logo-breath" />
                            <h1 className="text-3xl font-bold tracking-tight mt-4">Mira Attendance</h1>
                            <p className="text-slate-400">Sign in to your account</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 bg-slate-900/50 p-1 rounded-lg mb-6">
                            <button onClick={() => setActiveTab('pin')} className={`py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'pin' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700'}`}>PIN & Password</button>
                            <button onClick={() => setActiveTab('qr')} className={`py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'qr' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700'}`}>QR Code</button>
                        </div>
                        
                        {activeTab === 'pin' ? (
                            <form onSubmit={handleLogin}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-300">PIN</label>
                                        <input type="text" value={pin} onChange={e => setPin(e.target.value)} placeholder="e.g., FAC-01" className="w-full mt-1 p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none transition-shadow" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-300">Password</label>
                                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none transition-shadow" />
                                    </div>
                                </div>
                                {error && <p className="text-red-400 text-sm mt-4 text-center animate-fade-in">{error}</p>}
                                <button type="submit" disabled={loading} className="w-full mt-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition-all shadow-lg hover:shadow-primary-600/50 transform hover:-translate-y-0.5 disabled:bg-primary-800 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
                                    {loading ? 'Signing In...' : 'Sign In'}
                                </button>
                            </form>
                        ) : (
                            <div className="text-center animate-fade-in">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=mira-desktop-login&bgcolor=22d3ee&color=0f172a&qzone=1" alt="QR Code" className="mx-auto rounded-lg" />
                                <p className="mt-4 text-slate-300">Scan this with the Mira mobile app to log in instantly.</p>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="animate-fade-in">
                        <h2 className="text-xl font-semibold text-center text-slate-200 mb-2">Email Verification</h2>
                        <p className="text-slate-400 text-center mb-6">An OTP has been sent to bhanu***@gmail.com. Please enter it below.</p>
                        <form onSubmit={handleOtpSubmit}>
                            <div>
                                <label className="text-sm font-medium text-slate-300">Enter OTP</label>
                                <input 
                                    type="text" 
                                    value={otp} 
                                    onChange={e => setOtp(e.target.value)} 
                                    maxLength={6}
                                    placeholder="______" 
                                    className="w-full mt-1 p-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none transition-shadow text-center text-2xl tracking-[0.5em]" 
                                />
                            </div>
                            {error && <p className="text-red-400 text-sm mt-4 text-center animate-fade-in">{error}</p>}
                            <button type="submit" disabled={loading} className="w-full mt-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition-all shadow-lg hover:shadow-primary-600/50 transform hover:-translate-y-0.5 disabled:bg-primary-800 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
                                {loading ? 'Verifying...' : 'Verify & Sign In'}
                            </button>
                        </form>
                        <button onClick={handleBackToLogin} className="w-full text-center mt-4 text-sm text-slate-400 hover:text-white transition-colors">
                            &larr; Back to login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const DashboardPage: React.FC = () => {
  const { dashboardStats, isAiAvailable, user } = useAppContext();
  const navigate = useNavigate();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Stat Cards - Only Active Students */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Present Today" value={dashboardStats.presentToday} icon={Icons.checkCircle} color="bg-green-500" />
        <StatCard title="Absent Today" value={dashboardStats.absentToday} icon={Icons.xCircle} color="bg-red-500" />
        <StatCard title="Active Attendance Rate" value={`${dashboardStats.attendancePercentage}%`} icon={Icons.reports} color="bg-primary-500" />
      </div>

      {/* Action Cards */}
      <div>
         <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <ActionCard title="Mark Attendance" description="Use facial recognition for active students." icon={Icons.attendance} onClick={() => navigate('/attendance-log')} />
            <ActionCard title="View Reports" description="Analyze attendance data and export." icon={Icons.reports} onClick={() => navigate('/reports')} />
            <ActionCard title="Manage Users" description="Add, edit, or remove system users." icon={Icons.users} onClick={() => navigate('/manage-users')} />
            
            {user?.role === Role.STAFF ? (
                <ActionCard title="Submit Feedback" description="Report issues or suggest improvements." icon={Icons.feedback} onClick={() => navigate('/feedback')} />
            ) : isAiAvailable ? (
                <ActionCard title="CogniCraft AI" description="AI tools for faculty and students." icon={Icons.cogniCraft} onClick={() => navigate('/ai-studio')} />
            ) : (
                <div className="group bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg text-left w-full cursor-not-allowed opacity-60" title="CogniCraft AI is not configured by the administrator">
                    <Icons.cogniCraft className="h-10 w-10 text-slate-400 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-500 dark:text-slate-400">CogniCraft AI</h3>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Service unavailable.</p>
                </div>
            )}
        </div>
      </div>
     

      {/* Notifications - Filtered for Active Updates */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Active Updates</h3>
        <ul className="space-y-4">
          <li className="flex items-start space-x-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full mt-1"><Icons.timetable className="h-5 w-5 text-blue-600 dark:text-blue-400"/></div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">New Timetable Released</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Updated schedule for 2nd and 3rd year ECE is now available.</p>
              <p className="text-[10px] text-slate-400 mt-1">2 hours ago</p>
            </div>
          </li>
          <li className="flex items-start space-x-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-full mt-1"><Icons.syllabus className="h-5 w-5 text-purple-600 dark:text-purple-400"/></div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Mid-Syllabus Review</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Faculty members are requested to update the progress tracker by Friday.</p>
              <p className="text-[10px] text-slate-400 mt-1">Yesterday</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
const AppContent: React.FC = () => {
  const { user, theme, toggleTheme, logout, refreshDashboardStats } = useAppContext();
  const [showSplash, setShowSplash] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
      if (!showSplash && user) {
          if (user.pin === 'bhanu99517' && location.pathname === '/') {
              navigate('/manage-colleges');
          } else if (location.pathname === '/' || location.pathname === '/login') {
              navigate('/dashboard');
          }
      }
  }, [user, showSplash, navigate, location.pathname]);

  if (showSplash) return <SplashScreen />;

  if (!user) {
    return (
        <Routes>
            <Route path="/" element={<LandingPage onLogin={() => navigate('/login')} onPrivacy={() => navigate('/privacy')} />} />
            <Route path="/login" element={<LoginPage onBack={() => navigate('/')} />} />
            <Route path="/privacy" element={
                <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
                    <nav className="sticky top-0 z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Icons.logo className="h-8 w-8 text-primary-500" />
                            <span className="text-xl font-black tracking-tighter bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent uppercase">Mira 4.0</span>
                        </div>
                        <button onClick={() => navigate('/')} className="text-sm font-bold text-primary-600 hover:underline">Back to Home</button>
                    </nav>
                    <div className="py-10">
                        <PrivacyPolicyPage />
                    </div>
                </div>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
  }

  const isBhanuAdmin = user?.pin === 'bhanu99517';

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-300">
      <Sidebar />
      <div className={`flex-1 ${isBhanuAdmin ? '' : 'md:ml-64'} min-h-screen flex flex-col`}>
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-7xl mx-auto animate-fade-in">
             <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/manage-users" element={<ManageUsersPage user={user} />} />
                <Route path="/manage-colleges" element={<ManageCollegesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/applications" element={<ApplicationsPage user={user} />} />
                <Route path="/attendance-log" element={<AttendanceLogPage user={user} refreshDashboardStats={refreshDashboardStats} />} />
                <Route path="/results" element={<SBTETResultsPage user={user} />} />
                <Route path="/syllabus" element={<SyllabusPage user={user} />} />
                <Route path="/timetables" element={<TimetablesPage user={user} />} />
                <Route path="/feedback" element={<FeedbackPage user={user} />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/settings" element={<SettingsPage user={user} theme={theme} toggleTheme={toggleTheme} logout={logout} />} />
                <Route path="/ai-studio" element={<NotebookLLMPage />} />
                <Route path="/" element={<Navigate to={user.pin === 'bhanu99517' ? "/manage-colleges" : user.role === Role.PRINCIPAL ? "/manage-users" : "/dashboard"} replace />} />
                <Route path="*" element={<Navigate to={isBhanuAdmin ? "/manage-colleges" : "/dashboard"} replace />} />
             </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
        <AppProvider>
            <AppContent />
        </AppProvider>
    </BrowserRouter>
  );
}
