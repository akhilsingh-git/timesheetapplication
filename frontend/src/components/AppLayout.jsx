import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutGrid, Clock, Users, LogOut, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Toaster } from './ui/sonner';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Toaster />
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-10">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-xl font-heading font-extrabold tracking-tight text-slate-900">
            Timesheet<span className="text-primary">Pro</span>
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavLink 
            to="/" 
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <Clock size={18} />
            My Timesheet
          </NavLink>
          
          {(user?.role === 'Manager' || user?.role === 'Admin') && (
            <NavLink 
              to="/approvals" 
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <Users size={18} />
              Team Approvals
            </NavLink>
          )}
          
           {user?.role === 'Admin' && (
            <NavLink 
              to="/admin" 
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <Settings size={18} />
              Admin
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.role}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-slate-600" onClick={handleLogout}>
            <LogOut size={16} className="mr-2" />
            Log Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
