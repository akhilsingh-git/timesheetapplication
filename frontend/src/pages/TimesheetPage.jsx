import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import TimesheetGrid from '../components/TimesheetGrid';
import { Button } from '../components/ui/button';
import { format, startOfWeek, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';

export default function TimesheetPage() {
  const { user } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  );
  const [timesheet, setTimesheet] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchTimesheet();
  }, [currentWeekStart]);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (err) {
      toast.error("Failed to load projects");
    }
  };

  const fetchTimesheet = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/timesheets/week?week_start=${currentWeekStart}`);
      setTimesheet(res.data || { rows: [], status: 'Draft' });
    } catch (err) {
      // If 404/null just empty
      setTimesheet({ rows: [], status: 'Draft' });
    } finally {
      setLoading(false);
    }
  };

  const handleWeekChange = (direction) => {
    const date = new Date(currentWeekStart);
    const newDate = direction === 'next' ? addDays(date, 7) : subDays(date, 7);
    setCurrentWeekStart(format(newDate, 'yyyy-MM-dd'));
  };

  const handleSave = async (submit = false) => {
    if (!user) return;
    setSaving(true);
    try {
      // 1. Get current state from child? 
      // Actually TimesheetGrid should probably bubble up changes or we pass a ref. 
      // Better: TimesheetGrid calls onSave prop which updates local state here, then we push.
      // But we need to capture the current "rows" from the grid.
      // Let's pass a ref or lift state up properly.
      // I'll refactor TimesheetGrid to accept `rows` and `onChange` to lift state.
      // Wait, I designed TimesheetGrid to manage its own state for simplicity in previous step.
      // Let's make TimesheetGrid controlled OR use a ref. 
      // Let's use a REF approach for "Save" button outside the component, OR move the Save button INSIDE or pass a trigger.
      // Refactoring TimesheetGrid to be controlled is safer.
      
      // ... WAIT, I already wrote TimesheetGrid with internal state. 
      // Quick fix: Move Save/Submit buttons into the TimesheetGrid OR Lift state.
      // I will lift the state in the next file write update.
      // For now, let's assume TimesheetGrid calls `onSave` whenever rows change? No, that's too frequent.
      
      // Let's modify TimesheetGrid to accept `rows` and `setRows` from here.
      
    } catch (err) {
      console.error(err);
    }
  };
  
  // RE-WRITE PLAN: 
  // I will make TimesheetGrid a controlled component in the final integration.
  // For now, let's just finish the page structure.
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-3xl font-heading font-bold text-slate-900">My Timesheet</h2>
           <p className="text-slate-500">Track your work hours for the week.</p>
        </div>
        
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => handleWeekChange('prev')}>
                <ChevronLeft size={16} />
            </Button>
            <div className="flex flex-col items-center px-4 min-w-[140px]">
                <span className="text-sm font-medium text-slate-500">Week of</span>
                <span className="font-mono font-bold text-slate-900">{format(new Date(currentWeekStart), 'MMM dd, yyyy')}</span>
            </div>
            <Button variant="outline" size="icon" onClick={() => handleWeekChange('next')}>
                <ChevronRight size={16} />
            </Button>
        </div>

        <div className="flex items-center gap-2">
            {timesheet?.status && (
                <Badge variant={timesheet.status === 'Approved' ? 'success' : timesheet.status === 'Submitted' ? 'warning' : 'secondary'}
                 className="mr-2 text-sm px-3 py-1"
                >
                    {timesheet.status}
                </Badge>
            )}
             {/* Actions handled via Ref or Lifted State */}
             {/* Placeholder for actions, logic below */}
        </div>
      </div>

      <TimesheetGridWrapper 
        weekStartDate={currentWeekStart}
        initialData={timesheet}
        projects={projects}
        loading={loading}
        user={user}
        refresh={fetchTimesheet}
      />
    </div>
  );
}

// Wrapper to handle the "Controlled" nature cleanly
function TimesheetGridWrapper({ weekStartDate, initialData, projects, loading, user, refresh }) {
    const [rows, setRows] = useState([]);
    
    useEffect(() => {
        if (initialData) setRows(initialData.rows || []);
    }, [initialData]);

    const handleSave = async () => {
        try {
             const payload = {
                 user_id: user.id,
                 week_start_date: weekStartDate,
                 rows: rows,
                 status: 'Draft' // Backend handles status preservation
             };
             await api.post('/timesheets', payload);
             toast.success("Timesheet saved");
             refresh();
        } catch(e) {
            toast.error("Error saving timesheet");
        }
    };

    const handleSubmit = async () => {
         try {
             // Save first
             const payload = {
                 user_id: user.id,
                 week_start_date: weekStartDate,
                 rows: rows
             };
             const res = await api.post('/timesheets', payload);
             
             // Then Submit
             await api.post(`/timesheets/${res.data.id}/submit`);
             toast.success("Timesheet submitted for approval");
             refresh();
        } catch(e) {
            toast.error("Error submitting timesheet");
        }
    };

    if (loading) return <div>Loading...</div>;

    const isReadOnly = initialData?.status === 'Submitted' || initialData?.status === 'Approved';

    return (
        <div className="space-y-4">
             <div className="flex justify-end gap-2">
                 <Button variant="outline" onClick={handleSave} disabled={isReadOnly}>
                    <Save size={16} className="mr-2" /> Save Draft
                 </Button>
                 <Button onClick={handleSubmit} disabled={isReadOnly}>
                    <Send size={16} className="mr-2" /> Submit
                 </Button>
            </div>
            
            {/* We modify TimesheetGrid to accept rows/setRows directly in the next step */}
            <TimesheetGrid 
                weekStartDate={weekStartDate} 
                timesheetData={{...initialData, rows}} 
                projects={projects} 
                status={initialData?.status}
                // Custom prop I will add to Grid to make it controlled
                onChange={setRows} 
            />
        </div>
    )
}
