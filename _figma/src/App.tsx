import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RouterProvider, createBrowserRouter, Outlet, useNavigate, useLocation, useParams, Navigate, useOutletContext } from 'react-router-dom';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, 
  isSameDay, getDay, addMonths, subMonths, parseISO, addWeeks, subWeeks, 
  addYears, subYears, startOfWeek, endOfWeek, isToday, startOfYear
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Keyboard, Calendar as CalendarIcon, X } from 'lucide-react';

// --- DATA MODEL ---
const TEAM = [
  { id: '1', name: 'Min', avatar: '🐰' },
  { id: '2', name: 'Huy', avatar: '🐱' },
  { id: '3', name: 'Trâm', avatar: '🐼' },
  { id: '4', name: 'Đạt', avatar: '🦊' },
  { id: '5', name: 'Ngọc', avatar: '🐨' },
  { id: '6', name: 'Khoa', avatar: '🐧' },
  { id: '7', name: 'Linh', avatar: '🐹' },
  { id: '8', name: 'Bảo', avatar: '🐻' },
];

function getHolidaysForYear(year: number) {
  return [
    { date: `${year}-04-30`, name: 'Giải phóng miền Nam' },
    { date: `${year}-05-01`, name: 'Quốc tế Lao động' },
    { date: `${year}-09-02`, name: 'Quốc khánh' },
  ];
}

const INITIAL_ENTRIES = [
  // Original week 4 data (April 27 - May 1)
  { id: 'e1', userId: '2', startDate: '2026-04-27', endDate: '2026-04-29', type: 'pto', status: 'approved', portion: 'full' },
  { id: 'e2', userId: '3', startDate: '2026-04-28', endDate: '2026-04-29', type: 'wfh', status: 'tentative', portion: 'full' },
  { id: 'e3', userId: '4', startDate: '2026-04-29', endDate: '2026-04-29', type: 'pto', status: 'tentative', portion: 'full' },
  { id: 'e4', userId: '5', startDate: '2026-04-28', endDate: '2026-04-29', type: 'pto', status: 'approved', portion: 'full' },
  { id: 'e5', userId: '6', startDate: '2026-04-27', endDate: '2026-04-27', type: 'wfh', status: 'approved', portion: 'full' },
  { id: 'e6', userId: '6', startDate: '2026-04-28', endDate: '2026-04-28', type: 'wfh', status: 'approved', portion: 'pm' },
  { id: 'e7', userId: '8', startDate: '2026-04-29', endDate: '2026-04-29', type: 'wfh', status: 'approved', portion: 'full' },
  
  // Seed data for the rest of April 2026
  { id: 'e8', userId: '1', startDate: '2026-04-02', endDate: '2026-04-03', type: 'wfh', status: 'approved', portion: 'full' },
  { id: 'e9', userId: '7', startDate: '2026-04-03', endDate: '2026-04-03', type: 'pto', status: 'approved', portion: 'full' },
  { id: 'e10', userId: '2', startDate: '2026-04-08', endDate: '2026-04-10', type: 'pto', status: 'approved', portion: 'full' },
  { id: 'e11', userId: '6', startDate: '2026-04-09', endDate: '2026-04-09', type: 'wfh', status: 'tentative', portion: 'full' },
  { id: 'e12', userId: '3', startDate: '2026-04-10', endDate: '2026-04-10', type: 'wfh', status: 'approved', portion: 'pm' },
  { id: 'e13', userId: '8', startDate: '2026-04-16', endDate: '2026-04-16', type: 'pto', status: 'tentative', portion: 'full' },
  { id: 'e14', userId: '5', startDate: '2026-04-13', endDate: '2026-04-14', type: 'wfh', status: 'approved', portion: 'full' },
  { id: 'e15', userId: '4', startDate: '2026-04-24', endDate: '2026-04-24', type: 'pto', status: 'approved', portion: 'full' },
  { id: 'e16', userId: '1', startDate: '2026-04-22', endDate: '2026-04-24', type: 'wfh', status: 'approved', portion: 'full' },

  // A forced over-capacity day on April 17 (Friday) - 5 members out
  { id: 'e17', userId: '1', startDate: '2026-04-17', endDate: '2026-04-17', type: 'pto', status: 'approved', portion: 'full' },
  { id: 'e18', userId: '2', startDate: '2026-04-17', endDate: '2026-04-17', type: 'pto', status: 'approved', portion: 'full' },
  { id: 'e19', userId: '3', startDate: '2026-04-17', endDate: '2026-04-17', type: 'wfh', status: 'approved', portion: 'full' },
  { id: 'e20', userId: '4', startDate: '2026-04-17', endDate: '2026-04-17', type: 'wfh', status: 'tentative', portion: 'full' },
  { id: 'e21', userId: '5', startDate: '2026-04-17', endDate: '2026-04-17', type: 'pto', status: 'approved', portion: 'full' },
];

// --- APP ROUTER ---
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to={`/month/${format(new Date(2026, 3, 1), 'yyyy-MM')}`} replace /> },
      { path: "month/:date", element: <ViewContainer type="month" /> },
      { path: "week/:date", element: <ViewContainer type="week" /> },
      { path: "year/:year", element: <ViewContainer type="year" /> },
      { path: "admin", element: <ViewContainer type="admin" /> },
      { path: "*", element: <Navigate to="/" replace /> }
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

// --- ROOT LAYOUT ---
function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [modalOpen, setModalOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [entries, setEntries] = useState(INITIAL_ENTRIES);

  const isMonth = location.pathname.startsWith('/month');
  const isWeek = location.pathname.startsWith('/week');
  const isYear = location.pathname.startsWith('/year');
  const isAdmin = location.pathname.startsWith('/admin');

  let currentView = 'month';
  if (isWeek) currentView = 'week';
  if (isYear) currentView = 'year';
  if (isAdmin) currentView = 'admin';

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in inputs
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === '?') {
        setShortcutsOpen(prev => !prev);
      } else if (e.key === '1') {
        const anchor = getAnchorDate(location.pathname);
        navigate(`/week/${format(anchor, 'yyyy-MM-dd')}`);
      } else if (e.key === '2') {
        const anchor = getAnchorDate(location.pathname);
        navigate(`/month/${format(anchor, 'yyyy-MM')}`);
      } else if (e.key === '3') {
        const anchor = getAnchorDate(location.pathname);
        navigate(`/year/${format(anchor, 'yyyy')}`);
      } else if (e.key.toLowerCase() === 't') {
        // Today
        const today = new Date();
        if (isWeek) navigate(`/week/${format(today, 'yyyy-MM-dd')}`);
        else if (isMonth) navigate(`/month/${format(today, 'yyyy-MM')}`);
        else if (isYear) navigate(`/year/${format(today, 'yyyy')}`);
      } else if (e.key === 'ArrowLeft') {
        handlePrevNext('prev');
      } else if (e.key === 'ArrowRight') {
        handlePrevNext('next');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [location.pathname]);

  const handlePrevNext = (dir: 'prev' | 'next') => {
    if (isAdmin) return;
    const dateStr = location.pathname.split('/')[2];
    let anchor = dateStr ? new Date(dateStr) : new Date(2026, 3, 1);
    
    if (isWeek) {
      anchor = dir === 'prev' ? subWeeks(anchor, 1) : addWeeks(anchor, 1);
      navigate(`/week/${format(anchor, 'yyyy-MM-dd')}`);
    } else if (isMonth) {
      anchor = dir === 'prev' ? subMonths(anchor, 1) : addMonths(anchor, 1);
      navigate(`/month/${format(anchor, 'yyyy-MM')}`);
    } else if (isYear) {
      const parsedYear = parseInt(dateStr, 10);
      const nextYear = dir === 'prev' ? parsedYear - 1 : parsedYear + 1;
      navigate(`/year/${nextYear}`);
    }
  };

  const anchorDate = getAnchorDate(location.pathname);

  // Swipe gestures
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    if (isLeftSwipe) handlePrevNext('next');
    if (isRightSwipe) handlePrevNext('prev');
  };

  return (
    <div className="flex h-screen w-full bg-bg text-ink overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-card shadow-soft p-6 flex flex-col gap-8 z-20 hidden md:flex">
        <div>
          <h1 className="font-display font-bold text-3xl text-ink tracking-tight flex items-center justify-between">
            Ai Nghỉ?
          </h1>
          <p className="text-ink-2 text-sm mt-1">Lịch vắng mặt team</p>
        </div>

        <div className="flex-1">
          <h3 className="text-xs font-bold text-ink-3 uppercase tracking-wider mb-4">Team (8)</h3>
          <div className="flex flex-col gap-3">
            {TEAM.map(member => (
              <div key={member.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center text-lg">{member.avatar}</div>
                <span className="font-medium">{member.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-bg rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-pto"></span> Nghỉ phép (PTO)</div>
          <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-wfh"></span> Làm ở nhà (WFH)</div>
          <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-holiday"></span> Ngày lễ</div>
          <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-alert"></span> Quá tải (&gt;50%)</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <TopBar 
          anchorDate={anchorDate} 
          currentView={currentView}
          onPrev={() => handlePrevNext('prev')}
          onNext={() => handlePrevNext('next')}
          onOpenModal={() => setModalOpen(true)}
          entries={entries}
          setEntries={setEntries}
        />
        
        <div className="flex-1 overflow-auto p-2 md:p-6 bg-bg relative">
          <Outlet context={{ entries, anchorDate, onOpenModal: () => setModalOpen(true) }} />
        </div>
      </main>

      {modalOpen && <NewEntryModal onClose={() => setModalOpen(false)} />}
      {shortcutsOpen && <ShortcutsPopover onClose={() => setShortcutsOpen(false)} />}
      
      <button 
        onClick={() => setShortcutsOpen(true)}
        className="fixed bottom-4 right-4 w-10 h-10 bg-card rounded-full shadow-soft flex items-center justify-center text-ink-2 hover:text-ink z-50 md:flex hidden border border-line"
      >
        <Keyboard size={18} />
      </button>
    </div>
  );
}

// --- UTILS ---
function getAnchorDate(pathname: string) {
  const parts = pathname.split('/');
  if (parts[1] === 'week' && parts[2]) return new Date(parts[2]);
  if (parts[1] === 'month' && parts[2]) {
    // Append -01 so it parses correctly in local timezone
    return new Date(`${parts[2]}-01T00:00:00`);
  }
  if (parts[1] === 'year' && parts[2]) return new Date(`${parts[2]}-01-01T00:00:00`);
  return new Date(); // fallback to today
}

function isTodayInPeriod(date: Date, view: string) {
  const today = new Date();
  if (view === 'month') return isSameMonth(date, today);
  if (view === 'week') {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    return today >= weekStart && today <= weekEnd;
  }
  if (view === 'year') return date.getFullYear() === today.getFullYear();
  return false;
}

// --- TOP BAR ---
function TopBar({ anchorDate, currentView, onPrev, onNext, onOpenModal, entries, setEntries }: any) {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const today = new Date();
  const showTodayButton = currentView !== 'admin' && !isTodayInPeriod(anchorDate, currentView);

  const handleGoToday = () => {
    if (currentView === 'week') navigate(`/week/${format(today, 'yyyy-MM-dd')}`);
    else if (currentView === 'month') navigate(`/month/${format(today, 'yyyy-MM')}`);
    else if (currentView === 'year') navigate(`/year/${format(today, 'yyyy')}`);
  };

  let labelText = '';
  if (currentView === 'week') {
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
    const end = endOfWeek(anchorDate, { weekStartsOn: 1 });
    if (isSameMonth(start, end)) {
      labelText = `${format(start, 'dd/MM')} – ${format(end, 'dd/MM, yyyy')}`;
    } else if (start.getFullYear() === end.getFullYear()) {
      labelText = `${format(start, 'dd/MM')} – ${format(end, 'dd/MM, yyyy')}`;
    } else {
      labelText = `${format(start, 'dd/MM/yy')} – ${format(end, 'dd/MM/yy')}`;
    }
  } else if (currentView === 'month') {
    labelText = format(anchorDate, 'MMMM, yyyy', { locale: vi });
  } else if (currentView === 'year') {
    labelText = format(anchorDate, 'yyyy');
  }

  return (
    <header className="bg-card/80 backdrop-blur border-b border-line flex flex-col md:flex-row md:items-center justify-between px-3 md:px-6 py-3 md:py-0 md:h-20 z-30 shrink-0 gap-3 md:gap-0">
      <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
        {/* Navigation Controls */}
        {currentView !== 'admin' && (
          <div className="flex items-center gap-1 md:gap-2">
            <button onClick={onPrev} className="p-2 md:p-2.5 hover:bg-bg rounded-full text-ink-2 transition-colors">
              <ChevronLeft size={20} />
            </button>
            
            <div className="relative" ref={pickerRef}>
              <button 
                onClick={() => setPickerOpen(!pickerOpen)}
                className="font-display font-bold text-lg md:text-2xl text-ink px-2 py-1 rounded-lg hover:bg-bg transition-colors flex items-center gap-1 capitalize"
              >
                {labelText} <span className="text-[10px] md:text-xs text-ink-3">▼</span>
              </button>
              
              {pickerOpen && (
                <div className="absolute top-full left-0 mt-2 bg-card rounded-2xl shadow-2xl border border-line p-4 min-w-[280px] z-50">
                  <DatePickerDropdown 
                    type={currentView} 
                    anchorDate={anchorDate} 
                    onClose={() => setPickerOpen(false)} 
                  />
                </div>
              )}
            </div>

            <button onClick={onNext} className="p-2 md:p-2.5 hover:bg-bg rounded-full text-ink-2 transition-colors">
              <ChevronRight size={20} />
            </button>

            {showTodayButton && (
              <button 
                onClick={handleGoToday}
                className="ml-2 px-3 py-1.5 text-xs md:text-sm font-bold text-ink-2 bg-bg hover:bg-line rounded-lg transition-colors hidden md:block"
              >
                Hôm nay
              </button>
            )}
          </div>
        )}
        {currentView === 'admin' && <h2 className="font-display font-bold text-xl md:text-2xl">Duyệt Đăng Ký Chờ</h2>}
      </div>
      
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-1 md:pb-0">
        <div className="flex bg-bg p-1 rounded-full shrink-0 border border-line">
          {['week', 'month', 'year'].map(v => (
            <button
              key={v}
              onClick={() => {
                if (v === 'week') navigate(`/week/${format(anchorDate, 'yyyy-MM-dd')}`);
                if (v === 'month') navigate(`/month/${format(anchorDate, 'yyyy-MM')}`);
                if (v === 'year') navigate(`/year/${format(anchorDate, 'yyyy')}`);
              }}
              className={`px-4 md:px-5 py-1.5 rounded-full text-xs md:text-sm font-medium transition-all ${currentView === v ? 'bg-card text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}
            >
              {v === 'week' ? 'Tuần' : v === 'month' ? 'Tháng' : 'Năm'}
            </button>
          ))}
        </div>
        
        <button onClick={() => navigate('/admin')} className={`shrink-0 text-xs md:text-sm px-4 py-1.5 rounded-full border ${currentView === 'admin' ? 'bg-ink text-white border-ink' : 'border-line text-ink-2 hover:bg-bg'}`}>
          Duyệt phép
        </button>

        <button 
          onClick={onOpenModal}
          className="ml-auto md:ml-2 bg-ink text-white px-5 py-2 rounded-full text-sm font-bold shadow-soft hover:bg-ink-2 transition-colors active:scale-95 shrink-0 whitespace-nowrap"
        >
          + Đăng ký
        </button>
      </div>
    </header>
  );
}

function DatePickerDropdown({ type, anchorDate, onClose }: { type: string, anchorDate: Date, onClose: () => void }) {
  const navigate = useNavigate();
  const [navYear, setNavYear] = useState(anchorDate.getFullYear());
  
  if (type === 'year') {
    const years = [2024, 2025, 2026, 2027, 2028];
    return (
      <div className="flex flex-col gap-2">
        <div className="font-bold text-sm text-ink-3 mb-2 px-2 uppercase tracking-wider">Chọn Năm</div>
        {years.map(y => (
          <button 
            key={y}
            onClick={() => { navigate(`/year/${y}`); onClose(); }}
            className={`p-3 text-left rounded-xl font-bold transition-colors ${y === anchorDate.getFullYear() ? 'bg-ink text-white' : 'hover:bg-bg text-ink'}`}
          >
            Năm {y}
          </button>
        ))}
      </div>
    );
  }
  
  if (type === 'month') {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setNavYear(y => y - 1)} className="p-1 hover:bg-bg rounded-md"><ChevronLeft size={18} /></button>
          <span className="font-bold text-ink">{navYear}</span>
          <button onClick={() => setNavYear(y => y + 1)} className="p-1 hover:bg-bg rounded-md"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({length: 12}).map((_, i) => {
            const mDate = new Date(navYear, i, 1);
            const isCurrent = isSameMonth(mDate, anchorDate);
            return (
              <button
                key={i}
                onClick={() => { navigate(`/month/${format(mDate, 'yyyy-MM')}`); onClose(); }}
                className={`py-3 rounded-xl text-sm font-medium transition-colors ${isCurrent ? 'bg-ink text-white' : 'bg-bg text-ink hover:bg-line'}`}
              >
                Th{i + 1}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Week picker (compact calendar)
  const monthStart = startOfMonth(new Date(navYear, anchorDate.getMonth(), 1));
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setNavYear(y => y - 1)} className="p-1 hover:bg-bg rounded-md"><ChevronLeft size={18} /></button>
        <span className="font-bold text-ink">{format(monthStart, 'MMMM yyyy', { locale: vi })}</span>
        <button onClick={() => setNavYear(y => y + 1)} className="p-1 hover:bg-bg rounded-md"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-ink-3">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const isSelectedWeek = isSameMonth(d, anchorDate) && getDay(d) === 1; // Simplified visual
          const weekStart = startOfWeek(d, { weekStartsOn: 1 });
          const isCurrentWeek = anchorDate >= weekStart && anchorDate <= endOfWeek(d, { weekStartsOn: 1 });
          return (
            <button
              key={d.toString()}
              onClick={() => { navigate(`/week/${format(d, 'yyyy-MM-dd')}`); onClose(); }}
              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs transition-colors ${isCurrentWeek ? 'bg-ink text-white font-bold' : isSameMonth(d, monthStart) ? 'text-ink hover:bg-bg' : 'text-ink-3 hover:bg-bg'}`}
            >
              {format(d, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  );
}


// --- VIEW CONTAINER ---
function ViewContainer({ type }: { type: string }) {
  // Simulating loading state when anchor changes
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const { entries, anchorDate, onOpenModal } = useOutletContext<any>();

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 200); // 200ms quick skeleton
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (loading) return <ViewSkeleton type={type} />;

  if (type === 'month') return <MonthGrid currentDate={anchorDate} entries={entries} onAdd={onOpenModal} />;
  if (type === 'week') return <WeekGrid currentDate={anchorDate} entries={entries} onAdd={onOpenModal} />;
  if (type === 'year') return <YearGrid currentDate={anchorDate} entries={entries} />;
  if (type === 'admin') return <AdminQueue />;
  
  return null;
}

function ViewSkeleton({ type }: { type: string }) {
  return (
    <div className="h-full flex flex-col min-w-0 animate-pulse">
      {type === 'month' && (
        <>
          <div className="grid grid-cols-7 gap-1 mb-1 md:mb-2">
            {Array.from({length: 7}).map((_, i) => <div key={i} className="h-4 bg-line rounded mx-auto w-8"></div>)}
          </div>
          <div className="calendar-grid flex-1 rounded-lg md:rounded-xl overflow-hidden shadow-soft opacity-30">
            {Array.from({length: 35}).map((_, i) => (
              <div key={i} className="bg-card p-2 min-h-[60px] md:min-h-[90px]">
                <div className="h-4 w-4 bg-line rounded-full"></div>
              </div>
            ))}
          </div>
        </>
      )}
      {type === 'week' && (
        <div className="flex gap-2 md:gap-4 flex-1">
          {Array.from({length: 7}).map((_, i) => (
            <div key={i} className="flex-1 bg-card rounded-xl opacity-30 shadow-soft"></div>
          ))}
        </div>
      )}
      {type === 'year' && (
        <div className="bg-card rounded-xl flex-1 opacity-30 shadow-soft"></div>
      )}
    </div>
  );
}


// --- SUBVIEWS ---

function MonthGrid({ currentDate, entries, onAdd }: { currentDate: Date, entries: any[], onAdd: () => void }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const currentYear = currentDate.getFullYear();
  const holidays = getHolidaysForYear(currentYear);
  
  // Calculate if month is empty
  const periodEntries = entries.filter(e => {
    const eStart = parseISO(e.startDate);
    const eEnd = parseISO(e.endDate);
    return eStart <= monthEnd && eEnd >= monthStart;
  });

  return (
    <div className="h-full flex flex-col min-w-0 relative slide-in">
      <div className="grid grid-cols-7 gap-1 mb-1 md:mb-2">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
          <div key={d} className="text-center font-bold text-ink-3 text-[10px] md:text-sm">{d}</div>
        ))}
      </div>
      <div className="calendar-grid flex-1 rounded-lg md:rounded-xl overflow-hidden shadow-soft relative">
        {days.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isHoliday = holidays.some(h => h.date === dateStr);
          const dayEntries = entries.filter(e => e.startDate <= dateStr && e.endDate >= dateStr);
          const isTodayMarker = isToday(day);
          
          let absentCount = 0;
          dayEntries.forEach(e => {
            absentCount += e.portion === 'full' ? 1 : 0.5;
          });
          
          const isOverCapacity = absentCount > 4; // 8 team members
          
          // Simple bridge logic (very rough heuristic for demo: if day is Tue/Thu and adjacent is holiday)
          let isBridge = false;
          if (dateStr === `${currentYear}-04-29`) isBridge = true; 

          let cellClass = 'calendar-cell p-1 md:p-1.5 gap-0.5 md:gap-1 min-h-[60px] md:min-h-[90px] border-line border-t border-l';
          if (!isSameMonth(day, monthStart)) cellClass += ' outside';
          else if (isHoliday) cellClass += ' holiday';
          else if (isOverCapacity) cellClass += ' alert';

          const displayEntries = dayEntries.slice(0, 6);
          const extraCount = dayEntries.length - 6;

          return (
            <div key={i} className={cellClass}>
              <div className="flex justify-between items-start">
                <span className={`font-mono text-xs md:text-sm font-medium flex items-center justify-center w-5 h-5 rounded-full ${isTodayMarker ? 'bg-pto text-white' : (!isSameMonth(day, monthStart) ? 'text-ink-3' : 'text-ink')}`}>
                  {format(day, 'd')}
                </span>
                {isBridge && <span className="text-[8px] md:text-[10px] bg-alert text-white px-1 py-0.5 rounded font-bold">CẦU</span>}
              </div>
              
              <div className="flex flex-wrap gap-0.5 md:gap-1 mt-auto md:mt-1">
                {displayEntries.map((e, j) => {
                  const user = TEAM.find(u => u.id === e.userId);
                  const color = e.type === 'pto' ? 'bg-pto border-pto' : 'bg-wfh border-wfh';
                  return (
                    <div 
                      key={j} 
                      className={`w-[18px] h-[18px] md:w-6 md:h-6 rounded md:rounded-md flex items-center justify-center text-[9px] md:text-xs ${color} bg-opacity-30 border ${e.status === 'tentative' ? 'border-dashed' : 'border-solid'}`} 
                      title={`${user?.name} - ${e.type}`}
                    >
                      {user?.avatar}
                    </div>
                  );
                })}
                {extraCount > 0 && (
                  <div className="w-[18px] h-[18px] md:w-6 md:h-6 rounded md:rounded-md flex items-center justify-center text-[9px] md:text-xs font-bold bg-line text-ink-2">
                    +{extraCount}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty State Overlay */}
        {periodEntries.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-bg/40 backdrop-blur-[1px]">
            <div className="bg-card p-4 rounded-2xl shadow-soft flex items-center gap-4 pointer-events-auto border border-line">
              <span className="text-3xl">🐰</span>
              <div>
                <p className="font-bold text-ink text-sm">Chưa ai đăng ký tháng này.</p>
                <button onClick={onAdd} className="text-pto text-sm font-bold mt-1 hover:opacity-80 transition-opacity flex items-center gap-1">+ Đăng ký ngay</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WeekGrid({ currentDate, entries, onAdd }: { currentDate: Date, entries: any[], onAdd: () => void }) {
  const currentYear = currentDate.getFullYear();
  const holidays = getHolidaysForYear(currentYear);
  
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const periodEntries = entries.filter(e => {
    const eStart = parseISO(e.startDate);
    const eEnd = parseISO(e.endDate);
    return eStart <= weekEnd && eEnd >= weekStart;
  });

  return (
    <div className="h-full flex flex-col overflow-x-auto relative slide-in">
      <div className="flex flex-1 gap-2 md:gap-4 min-w-[700px]">
        {days.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isHoliday = holidays.find(h => h.date === dateStr);
          const isTodayMarker = isToday(day);
          
          const dayEntries = entries.filter(e => e.startDate <= dateStr && e.endDate >= dateStr);
          let absentCount = 0;
          dayEntries.forEach(e => { absentCount += e.portion === 'full' ? 1 : 0.5; });
          const isOverCapacity = absentCount > 4;

          return (
            <div key={i} className={`flex-1 flex flex-col bg-card rounded-xl shadow-soft overflow-hidden ${isHoliday ? 'bg-holiday-soft' : ''}`}>
              <div className={`p-2 md:p-3 text-center border-b border-line flex flex-col items-center relative ${isOverCapacity ? 'bg-alert-soft' : ''}`}>
                <h3 className="font-bold text-ink text-sm md:text-base flex items-center gap-1">
                  {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][getDay(day)]} 
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-mono text-xs ${isTodayMarker ? 'bg-pto text-white' : 'text-ink-2'}`}>
                    {format(day, 'dd/MM')}
                  </span>
                </h3>
                {isHoliday && <p className="text-[10px] md:text-xs text-ink-2 mt-1">{isHoliday.name}</p>}
                {dateStr === `${currentYear}-04-29` && <span className="inline-block mt-1 text-[10px] bg-alert text-white px-2 py-0.5 rounded font-bold">NGÀY CẦU</span>}
              </div>
              
              <div className="flex-1 p-2 flex flex-col gap-2">
                {dayEntries.map((e, j) => {
                  const user = TEAM.find(u => u.id === e.userId);
                  const colorClass = e.type === 'pto' ? 'border-pto bg-pto-soft text-pto' : 'border-wfh bg-wfh-soft text-wfh';
                  return (
                    <div key={j} className={`flex items-center gap-2 p-1.5 md:p-2 rounded-lg border-l-4 ${colorClass} ${e.status === 'tentative' ? 'border-dashed opacity-70' : ''} bg-opacity-50`}>
                      <span className="text-lg md:text-xl">{user?.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs md:text-sm text-ink truncate flex items-center gap-1">
                          {user?.name}
                          {e.status === 'approved' && <span className="text-[10px]">⭐</span>}
                        </div>
                        <div className="text-[9px] md:text-[10px] uppercase font-bold tracking-wider opacity-80 flex items-center gap-1">
                          {e.type} {e.portion !== 'full' ? `(${e.portion})` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`p-2 md:p-3 border-t border-line text-center text-xs md:text-sm font-mono font-medium ${isOverCapacity ? 'bg-alert text-white' : 'text-ink-2'}`}>
                {absentCount}/8 vắng
              </div>
            </div>
          );
        })}
      </div>

      {periodEntries.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-bg/40 backdrop-blur-[1px]">
          <div className="bg-card p-4 rounded-2xl shadow-soft flex items-center gap-4 pointer-events-auto border border-line">
            <span className="text-3xl">🐹</span>
            <div>
              <p className="font-bold text-ink text-sm">Chưa ai đăng ký tuần này.</p>
              <button onClick={onAdd} className="text-pto text-sm font-bold mt-1 hover:opacity-80 transition-opacity flex items-center gap-1">+ Đăng ký ngay</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function YearGrid({ currentDate, entries }: { currentDate: Date, entries: any[] }) {
  const currentYear = currentDate.getFullYear();
  return (
    <div className="h-full bg-card rounded-xl p-3 md:p-4 overflow-x-auto no-scrollbar shadow-soft relative slide-in">
      <div className="min-w-[700px] md:min-w-[800px]">
        <div className="flex border-b border-line pb-2 mb-4">
          <div className="w-24 md:w-32 shrink-0"></div>
          {['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'].map(m => (
            <div key={m} className="flex-1 text-center font-bold text-ink-3 text-xs md:text-sm">{m}</div>
          ))}
        </div>
        
        <div className="flex flex-col gap-3">
          {TEAM.map(user => (
            <div key={user.id} className="flex items-center gap-2">
              <div className="w-24 md:w-32 shrink-0 flex items-center gap-2 font-medium text-xs md:text-sm">
                <span className="text-base md:text-xl">{user.avatar}</span> {user.name}
              </div>
              <div className="flex-1 flex gap-0.5 md:gap-1 h-6 md:h-8 items-center justify-around bg-bg/50 rounded-lg p-1">
                {Array.from({length: 48}).map((_, i) => {
                  // Only show data if looking at 2026 for demo purpose
                  if (currentYear !== 2026) return <div key={i} className="w-1 md:w-1.5 h-3 md:h-4 rounded-full bg-line/20" />;
                  
                  const val = Math.random();
                  let color = 'bg-line/50';
                  if (val > 0.9) color = 'bg-pto';
                  else if (val > 0.8) color = 'bg-wfh';
                  return <div key={i} className={`w-1 md:w-1.5 h-3 md:h-4 rounded-full ${color}`} />
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminQueue() {
  return (
    <div className="max-w-3xl mx-auto px-2 md:px-0 slide-in">
      <div className="bg-card rounded-xl shadow-soft overflow-hidden flex flex-col gap-px bg-line">
        <div className="bg-white p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="text-2xl md:text-3xl">🐼</div>
            <div className="flex-1 md:hidden">
              <h4 className="font-bold text-ink text-base">Trâm <span className="font-normal text-ink-3 text-xs ml-1">WFH</span></h4>
            </div>
          </div>
          <div className="flex-1 hidden md:block">
            <h4 className="font-bold text-ink text-lg">Trâm <span className="font-normal text-ink-3 text-sm ml-2">Làm ở nhà (WFH)</span></h4>
            <p className="text-sm font-mono text-ink-2 mt-0.5">28/04 - 29/04 <span className="bg-alert/10 text-alert px-2 py-0.5 rounded text-xs ml-2 uppercase font-bold">Chưa chốt</span></p>
          </div>
          <div className="md:hidden text-sm font-mono text-ink-2">
            28/04 - 29/04 <span className="bg-alert/10 text-alert px-2 py-0.5 rounded text-[10px] ml-1 uppercase font-bold">Chưa chốt</span>
          </div>
          <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
            <button className="flex-1 md:flex-none px-4 py-2 border border-line rounded-lg text-ink-2 hover:bg-bg font-medium text-sm">Từ chối</button>
            <button className="flex-1 md:flex-none px-4 py-2 bg-wfh text-white rounded-lg hover:brightness-110 font-bold text-sm shadow-sm flex items-center justify-center gap-1">Duyệt <span className="opacity-50">⭐</span></button>
          </div>
        </div>

        <div className="bg-white p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="text-2xl md:text-3xl">🦊</div>
            <div className="flex-1 md:hidden">
              <h4 className="font-bold text-ink text-base">Đạt <span className="font-normal text-ink-3 text-xs ml-1">PTO</span></h4>
            </div>
          </div>
          <div className="flex-1 hidden md:block">
            <h4 className="font-bold text-ink text-lg">Đạt <span className="font-normal text-ink-3 text-sm ml-2">Nghỉ phép (PTO)</span></h4>
            <p className="text-sm font-mono text-ink-2 mt-0.5">29/04 <span className="bg-alert/10 text-alert px-2 py-0.5 rounded text-xs ml-2 uppercase font-bold">Chưa chốt</span></p>
            <p className="text-xs text-alert font-bold mt-1">⚠️ Ngày này đang có 4 người vắng mặt</p>
          </div>
          <div className="md:hidden text-sm font-mono text-ink-2">
            29/04 <span className="bg-alert/10 text-alert px-2 py-0.5 rounded text-[10px] ml-1 uppercase font-bold">Chưa chốt</span>
            <p className="text-xs text-alert font-bold mt-1">⚠️ Ngày này đang có 4 người vắng mặt</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
            <button className="flex-1 md:flex-none px-4 py-2 border border-line rounded-lg text-ink-2 hover:bg-bg font-medium text-sm">Từ chối</button>
            <button className="flex-1 md:flex-none px-4 py-2 bg-pto text-white rounded-lg hover:brightness-110 font-bold text-sm shadow-sm flex items-center justify-center gap-1">Duyệt <span className="opacity-50">⭐</span></button>
          </div>
        </div>
      </div>
      
      <div className="mt-6 md:mt-8 text-center text-ink-3 text-xs md:text-sm pb-8 md:pb-0">
        <p>Đã duyệt 5 đơn vị phép tuần này.</p>
      </div>
    </div>
  );
}

function NewEntryModal({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState('pto');
  
  return (
    <div className="fixed inset-0 bg-ink/20 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-3xl md:rounded-[38px] p-5 md:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 md:top-6 right-4 md:right-6 w-8 h-8 flex items-center justify-center rounded-full bg-bg text-ink-2 hover:bg-line transition-colors"><X size={18} /></button>
        
        <h2 className="font-display font-bold text-xl md:text-2xl text-ink mb-4 md:mb-6">Đăng ký nghỉ / WFH</h2>
        
        <div className="flex p-1 bg-bg rounded-xl mb-4 md:mb-6 shrink-0 border border-line">
          <button onClick={() => setType('pto')} className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-colors ${type === 'pto' ? 'bg-card shadow-sm text-pto' : 'text-ink-2 hover:text-ink'}`}>Nghỉ (PTO)</button>
          <button onClick={() => setType('wfh')} className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-colors ${type === 'wfh' ? 'bg-card shadow-sm text-wfh' : 'text-ink-2 hover:text-ink'}`}>Làm ở nhà (WFH)</button>
        </div>

        <div className="space-y-4 md:space-y-5 overflow-y-auto pr-1 no-scrollbar flex-1">
          <div>
            <label className="block text-xs md:text-sm font-bold text-ink-2 mb-2">Ngày</label>
            <div className="flex gap-2 items-center">
              <input type="date" defaultValue="2026-04-29" className="flex-1 bg-bg border-none rounded-lg p-2.5 md:p-3 font-mono text-sm text-ink focus:ring-2 focus:ring-ink" />
              <span className="text-ink-3">-</span>
              <input type="date" defaultValue="2026-04-29" className="flex-1 bg-bg border-none rounded-lg p-2.5 md:p-3 font-mono text-sm text-ink focus:ring-2 focus:ring-ink" />
            </div>
            <p className="text-alert text-[11px] md:text-xs mt-2 font-medium flex items-start md:items-center gap-1">
              <span className="shrink-0">⚠️</span> Thứ Tư 29/04 đã có 5/8 người vắng mặt — Huy, Trâm, Đạt, Ngọc, Bảo.
            </p>
          </div>

          <div>
            <label className="block text-xs md:text-sm font-bold text-ink-2 mb-2">Thời gian</label>
            <div className="flex gap-2">
              <button className="flex-1 py-2 bg-ink text-white rounded-lg font-bold text-xs md:text-sm">Cả ngày</button>
              <button className="flex-1 py-2 bg-bg text-ink-2 hover:bg-line rounded-lg font-medium text-xs md:text-sm">Sáng</button>
              <button className="flex-1 py-2 bg-bg text-ink-2 hover:bg-line rounded-lg font-medium text-xs md:text-sm">Chiều</button>
            </div>
          </div>

          <div className="flex items-center gap-3 py-2 border-t border-line mt-2 pt-3 md:pt-4">
            <input type="checkbox" id="tentative" className="w-4 h-4 md:w-5 md:h-5 rounded border-line text-ink focus:ring-ink" />
            <label htmlFor="tentative" className="font-medium text-sm text-ink cursor-pointer">Chưa chốt (Chỉ dự kiến)</label>
          </div>

          <div>
            <input type="text" placeholder="Ghi chú thêm (không bắt buộc)..." className="w-full bg-bg border-none rounded-lg p-2.5 md:p-3 text-xs md:text-sm text-ink focus:ring-2 focus:ring-ink" />
          </div>
        </div>

        <div className="mt-4 md:mt-8 flex gap-3 shrink-0 pt-3 border-t border-line md:border-none md:pt-0">
          <button onClick={onClose} className="px-4 md:px-6 py-2.5 md:py-3 bg-bg text-ink-2 hover:bg-line rounded-xl font-bold transition-colors text-sm">Hủy</button>
          <button onClick={onClose} className={`flex-1 py-2.5 md:py-3 text-white rounded-xl font-bold shadow-soft transition-colors text-sm ${type === 'pto' ? 'bg-pto hover:brightness-110' : 'bg-wfh hover:brightness-110'}`}>
            Đăng ký
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortcutsPopover({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed bottom-16 right-4 bg-ink text-white p-4 rounded-xl shadow-2xl z-50 text-sm w-64 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-3 border-b border-ink-2 pb-2">
        <h3 className="font-bold">Phím tắt</h3>
        <button onClick={onClose} className="text-ink-3 hover:text-white"><X size={16} /></button>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between"><span>Lùi / Tiến</span> <span className="font-mono text-ink-3">← / →</span></div>
        <div className="flex justify-between"><span>Về Hôm nay</span> <span className="font-mono text-ink-3">T</span></div>
        <div className="flex justify-between"><span>Xem Tuần</span> <span className="font-mono text-ink-3">1</span></div>
        <div className="flex justify-between"><span>Xem Tháng</span> <span className="font-mono text-ink-3">2</span></div>
        <div className="flex justify-between"><span>Xem Năm</span> <span className="font-mono text-ink-3">3</span></div>
        <div className="flex justify-between"><span>Bật/Tắt Help</span> <span className="font-mono text-ink-3">?</span></div>
      </div>
    </div>
  );
}
