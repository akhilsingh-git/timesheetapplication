import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

export default function ApprovalsPage() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // In a real app we'd fetch "pending timesheets". 
    // Here we will fetch all users and their current week timesheet for demo
    // Or add an endpoint /timesheets/pending.
    // For MVP/Demo: Fetch Users -> Fetch their current week timesheet.
    // Let's create a simpler backend endpoint or just mock list logic for now
    // Actually, let's fetch all users, then iterate to get their timesheets? N+1 problem but fine for demo.
    
    // Better: GET /users then loop.
    
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const usersRes = await api.get('/users');
            // Filter out self
            const employees = usersRes.data.filter(u => u.id !== user.id);
            setUsers(employees);
            
            // In a real iteration, we would fetch timesheet statuses here
        } catch(e) {
            toast.error("Failed to load team");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
             <div>
                <h2 className="text-3xl font-heading font-bold text-slate-900">Team Approvals</h2>
                <p className="text-slate-500">Review and approve timesheets for your team.</p>
            </div>
            
            <div className="grid gap-6">
                {users.map(u => (
                    <EmployeeTimesheetCard key={u.id} employee={u} />
                ))}
                 {users.length === 0 && <p>No team members found.</p>}
            </div>
        </div>
    );
}

function EmployeeTimesheetCard({ employee }) {
    // Fetch latest timesheet for this employee
    const [timesheet, setTimesheet] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Hardcoded to current week for demo
    const currentWeekStart = new Date().toISOString().slice(0, 10); // Approximation
    
    // Better approximation for start of week
    const getStartOfWeek = () => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().slice(0, 10);
    }
    const weekStart = getStartOfWeek();

    useEffect(() => {
        api.get(`/timesheets/week?week_start=${weekStart}&user_id=${employee.id}`)
           .then(res => setTimesheet(res.data))
           .catch(() => setTimesheet(null))
           .finally(() => setLoading(false));
    }, [employee.id, weekStart]);

    const handleAction = async (action) => {
        if (!timesheet) return;
        try {
            await api.post(`/timesheets/${timesheet.id}/${action}`);
            toast.success(`Timesheet ${action}ed`);
            // Refresh
            const res = await api.get(`/timesheets/week?week_start=${weekStart}&user_id=${employee.id}`);
            setTimesheet(res.data);
        } catch(e) {
            toast.error(`Failed to ${action}`);
        }
    };

    if (loading) return null;
    if (!timesheet) return (
         <Card>
            <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                            {employee.full_name[0]}
                        </div>
                        <div>
                             <CardTitle className="text-base">{employee.full_name}</CardTitle>
                             <CardDescription>No submission for this week</CardDescription>
                        </div>
                    </div>
                    <Badge variant="outline">Not Started</Badge>
                </div>
            </CardHeader>
         </Card>
    );

    return (
        <Card>
            <CardContent className="p-6">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg">
                            {employee.full_name[0]}
                        </div>
                        <div>
                             <h3 className="font-heading font-bold text-lg">{employee.full_name}</h3>
                             <p className="text-slate-500 text-sm">Week of {timesheet.week_start_date} • {timesheet.total_hours} Hours</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                         <div className="text-right mr-4">
                             <div className="text-sm font-medium text-slate-900">Status</div>
                             <Badge variant={timesheet.status === 'Submitted' ? 'warning' : 'secondary'}>{timesheet.status}</Badge>
                         </div>
                         
                         {timesheet.status === 'Submitted' && (
                             <div className="flex gap-2">
                                 <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => handleAction('reject')}>Reject</Button>
                                 <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAction('approve')}>Approve</Button>
                             </div>
                         )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
