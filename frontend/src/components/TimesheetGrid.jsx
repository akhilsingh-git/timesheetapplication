import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { NotesModal } from './NotesModal';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TimesheetGrid({ weekStartDate, timesheetData, projects, onChange, status }) {
  // Controlled component pattern: favor props.rows if onChange is handled parent-side
  // But to be safe, we use internal state synced with props for now, and emit changes
  const [localRows, setLocalRows] = useState([]);
  const [activeNote, setActiveNote] = useState(null); 

  useEffect(() => {
    if (timesheetData && timesheetData.rows) {
      setLocalRows(timesheetData.rows);
    } else {
      setLocalRows([]);
    }
  }, [timesheetData]);

  // Emit changes whenever localRows updates
  const updateRows = (newRows) => {
      setLocalRows(newRows);
      if (onChange) onChange(newRows);
  };

  const dateHeaders = useMemo(() => {
    const start = new Date(weekStartDate);
    return DAYS.map((d, i) => {
      const date = addDays(start, i);
      return { day: d, date: format(date, 'MMM dd'), iso: format(date, 'yyyy-MM-dd') };
    });
  }, [weekStartDate]);

  const handleAddRow = (projectId, subProjectId) => {
    const exists = localRows.find(r => r.project_id === projectId && r.sub_project_id === subProjectId);
    if (exists) {
      toast.error("Already exists");
      return;
    }
    const newRow = {
      project_id: projectId,
      sub_project_id: subProjectId,
      entries: Array(7).fill(null).map((_, i) => ({ day_index: i, hours: 0, notes: "" }))
    };
    updateRows([...localRows, newRow]);
  };

  const handleHoursChange = (rowIndex, dayIndex, val) => {
    const newRows = [...localRows];
    // Handle empty string or validation
    let numVal = parseFloat(val);
    if (val === '') numVal = 0; // Or keep as 0
    if (isNaN(numVal)) numVal = 0;
    
    // We store 0 internally but input might show '' if focused? 
    // For simplicity, store number.
    newRows[rowIndex].entries[dayIndex].hours = numVal;
    updateRows(newRows);
  };

  const handleDeleteRow = (index) => {
    const newRows = [...localRows];
    newRows.splice(index, 1);
    updateRows(newRows);
  };

  const getProjectName = (pid) => projects.find(p => p.id === pid)?.name || 'Unknown';
  const getSubProjectName = (pid, spid) => {
    const p = projects.find(p => p.id === pid);
    return p?.sub_projects.find(sp => sp.id === spid)?.name || 'Unknown';
  };

  const groupedRows = useMemo(() => {
    const groups = {};
    localRows.forEach((row, index) => {
      if (!groups[row.project_id]) groups[row.project_id] = [];
      groups[row.project_id].push({ ...row, originalIndex: index });
    });
    return groups;
  }, [localRows]);

  const calculateTotal = () => {
    return localRows.reduce((acc, row) => {
      return acc + row.entries.reduce((sum, e) => sum + (e.hours || 0), 0);
    }, 0);
  };

  const calculateDayTotal = (dayIndex) => {
      return localRows.reduce((acc, row) => acc + (row.entries[dayIndex]?.hours || 0), 0);
  }

  const isReadOnly = status === 'Submitted' || status === 'Approved';

  return (
    <div className="space-y-6">
      <div className="border rounded-xl shadow-sm bg-white overflow-hidden ring-1 ring-slate-900/5">
        {/* Header Grid */}
        <div className="grid grid-cols-[300px_repeat(7,1fr)_80px] bg-slate-50/80 border-b border-slate-200 backdrop-blur-sm">
          <div className="p-4 font-heading font-semibold text-sm text-slate-700 flex items-center">
            Project / Assignment
          </div>
          {dateHeaders.map((dh, i) => (
            <div key={i} className="py-2 px-1 flex flex-col items-center justify-center border-l border-slate-200/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{dh.day}</span>
              <span className="text-sm font-bold text-slate-900">{dh.date}</span>
            </div>
          ))}
          <div className="p-4 font-heading font-semibold text-sm text-slate-700 flex items-center justify-center border-l border-slate-200 bg-slate-100/50">
            Total
          </div>
        </div>

        {/* Rows Grouped by Project */}
        <div className="divide-y divide-slate-100">
          {Object.keys(groupedRows).length === 0 && (
             <div className="p-16 text-center flex flex-col items-center justify-center text-muted-foreground gap-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <Plus className="text-slate-300" />
                </div>
                <p>No entries yet.</p> 
                <p className="text-xs">Add a project below to get started.</p>
             </div>
          )}

          {Object.entries(groupedRows).map(([projectId, projectRows]) => (
            <div key={projectId} className="bg-white">
              <div className="px-4 py-1.5 bg-slate-50/50 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex justify-between items-center">
                {getProjectName(projectId)}
              </div>

              {projectRows.map((row) => (
                <div key={`${row.project_id}-${row.sub_project_id}`} className="grid grid-cols-[300px_repeat(7,1fr)_80px] group hover:bg-slate-50/30 transition-colors">
                  {/* Sub Project Name */}
                  <div className="px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-700 border-r border-transparent">
                    <span className="truncate pr-2" title={getSubProjectName(row.project_id, row.sub_project_id)}>
                      {getSubProjectName(row.project_id, row.sub_project_id)}
                    </span>
                    {!isReadOnly && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500" onClick={() => handleDeleteRow(row.originalIndex)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>

                  {/* Input Cells */}
                  {row.entries.map((entry, dayIndex) => (
                    <div key={dayIndex} className="relative border-l border-slate-100 h-10 md:h-12">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        disabled={isReadOnly}
                        value={entry.hours === 0 ? '' : entry.hours}
                        onChange={(e) => handleHoursChange(row.originalIndex, dayIndex, e.target.value)}
                        className="w-full h-full text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-inset focus:ring-primary/20 outline-none font-mono text-sm text-slate-900 placeholder-slate-200 transition-all selection:bg-primary/20"
                        placeholder="-"
                      />
                      {(entry.notes || !isReadOnly) && (
                         <div className="absolute top-0.5 right-0.5 z-10">
                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button 
                                          className={cn(
                                            "w-3 h-3 flex items-center justify-center rounded-full transition-all",
                                            entry.notes ? "bg-blue-500" : "opacity-0 group-hover:opacity-100 hover:bg-slate-200"
                                          )}
                                          onClick={() => !isReadOnly && setActiveNote({ 
                                            rowIndex: row.originalIndex, 
                                            dayIndex, 
                                            notes: entry.notes, 
                                            date: dateHeaders[dayIndex].date,
                                            title: `${getProjectName(row.project_id)} - ${getSubProjectName(row.project_id, row.sub_project_id)}`
                                          })}
                                        >
                                           {entry.notes && <span className="sr-only">Has notes</span>}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs">{entry.notes || "Add Note"}</p>
                                    </TooltipContent>
                                </Tooltip>
                             </TooltipProvider>
                         </div>
                      )}
                    </div>
                  ))}

                  {/* Row Total */}
                  <div className="flex items-center justify-center font-mono text-sm font-semibold text-slate-600 bg-slate-50/20 border-l border-slate-100">
                    {row.entries.reduce((sum, e) => sum + (e.hours || 0), 0)}
                  </div>
                </div>
              ))}
            </div>
          ))}
          
           {/* Daily Totals Footer */}
           <div className="grid grid-cols-[300px_repeat(7,1fr)_80px] bg-slate-50 border-t border-slate-200">
                <div className="p-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-end pr-4">
                    Daily Total
                </div>
                {dateHeaders.map((_, i) => (
                    <div key={i} className="p-3 flex items-center justify-center font-mono text-sm font-bold text-slate-900 border-l border-slate-200">
                        {calculateDayTotal(i)}
                    </div>
                ))}
                 <div className="p-3 flex items-center justify-center font-mono text-base font-extrabold text-primary border-l border-slate-200 bg-primary/5">
                    {calculateTotal()}
                </div>
           </div>
        </div>
      </div>
      
      {/* Add Row Controls */}
      {!isReadOnly && (
        <div className="p-4 bg-white border border-dashed border-slate-300 rounded-xl flex items-center gap-4 hover:border-slate-400 transition-colors">
            <span className="text-sm font-medium text-slate-600">Add Entry:</span>
           <AddRowForm projects={projects} onAdd={handleAddRow} />
        </div>
      )}

      {/* Notes Modal */}
      {activeNote && (
        <NotesModal 
          isOpen={!!activeNote}
          onClose={() => setActiveNote(null)}
          notes={activeNote.notes}
          dayDate={activeNote.date}
          projectTitle={activeNote.title}
          onSave={(text) => {
             const newRows = [...localRows];
             newRows[activeNote.rowIndex].entries[activeNote.dayIndex].notes = text;
             updateRows(newRows);
          }}
        />
      )}
      
      {/* Validation Warning */}
       {calculateTotal() < 40 && calculateTotal() > 0 && (
          <div className="flex items-center gap-2 text-amber-700 text-sm bg-amber-50 p-4 rounded-xl border border-amber-100">
              <AlertCircle size={18} />
              <span><strong>Weekly Target:</strong> You have logged {calculateTotal()} hours. The standard week is 40 hours.</span>
          </div>
       )}
    </div>
  );
}

function AddRowForm({ projects, onAdd }) {
    const [selectedProject, setSelectedProject] = useState("");
    const [selectedSubProject, setSelectedSubProject] = useState("");
    
    const subProjects = useMemo(() => {
        if (!selectedProject) return [];
        return projects.find(p => p.id === selectedProject)?.sub_projects || [];
    }, [selectedProject, projects]);

    const handleAdd = () => {
        if (selectedProject && selectedSubProject) {
            onAdd(selectedProject, selectedSubProject);
            setSelectedSubProject("");
        }
    };

    return (
        <div className="flex items-center gap-3">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-[200px] bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Select Project" />
                </SelectTrigger>
                <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
            </Select>

            <Select value={selectedSubProject} onValueChange={setSelectedSubProject} disabled={!selectedProject}>
                <SelectTrigger className="w-[200px] bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Select Task" />
                </SelectTrigger>
                <SelectContent>
                    {subProjects.map(sp => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}
                </SelectContent>
            </Select>

            <Button size="sm" onClick={handleAdd} disabled={!selectedSubProject} className="bg-slate-900 text-white hover:bg-slate-800">
                <Plus size={16} className="mr-2" /> Add to Grid
            </Button>
        </div>
    )
}
