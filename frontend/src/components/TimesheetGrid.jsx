import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Plus, Trash2, MessageSquare, AlertCircle } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { NotesModal } from './NotesModal';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TimesheetGrid({ weekStartDate, timesheetData, projects, onSave, status }) {
  // timesheetData is { id, rows: [], status }
  const [rows, setRows] = useState([]);
  const [activeNote, setActiveNote] = useState(null); // { rowIndex, dayIndex, currentNotes }

  useEffect(() => {
    if (timesheetData && timesheetData.rows) {
      setRows(timesheetData.rows);
    } else {
      setRows([]);
    }
  }, [timesheetData]);

  // Generate date headers
  const dateHeaders = useMemo(() => {
    const start = new Date(weekStartDate);
    return DAYS.map((d, i) => {
      const date = addDays(start, i);
      return { day: d, date: format(date, 'MMM dd'), iso: format(date, 'yyyy-MM-dd') };
    });
  }, [weekStartDate]);

  const handleAddRow = (projectId, subProjectId) => {
    // Check if exists
    const exists = rows.find(r => r.project_id === projectId && r.sub_project_id === subProjectId);
    if (exists) {
      toast.error("This project/sub-project is already on the timesheet");
      return;
    }

    const newRow = {
      project_id: projectId,
      sub_project_id: subProjectId,
      entries: Array(7).fill(null).map((_, i) => ({ day_index: i, hours: 0, notes: "" }))
    };
    setRows([...rows, newRow]);
  };

  const handleHoursChange = (rowIndex, dayIndex, val) => {
    const newRows = [...rows];
    let numVal = parseFloat(val);
    if (isNaN(numVal)) numVal = 0;
    
    newRows[rowIndex].entries[dayIndex].hours = numVal;
    setRows(newRows);
  };

  const handleDeleteRow = (index) => {
    const newRows = [...rows];
    newRows.splice(index, 1);
    setRows(newRows);
  };

  const getProjectName = (pid) => projects.find(p => p.id === pid)?.name || 'Unknown';
  const getSubProjectName = (pid, spid) => {
    const p = projects.find(p => p.id === pid);
    return p?.sub_projects.find(sp => sp.id === spid)?.name || 'Unknown';
  };

  // Helper to group UI rows by Project for visual structure if needed
  // For now, we will render flat list but sorted? 
  // Requirement: Rows: Two-level hierarchy. 
  // Let's group by Project in rendering.
  const groupedRows = useMemo(() => {
    const groups = {};
    rows.forEach((row, index) => {
      if (!groups[row.project_id]) groups[row.project_id] = [];
      groups[row.project_id].push({ ...row, originalIndex: index });
    });
    return groups;
  }, [rows]);

  const calculateTotal = () => {
    return rows.reduce((acc, row) => {
      return acc + row.entries.reduce((sum, e) => sum + (e.hours || 0), 0);
    }, 0);
  };

  const calculateDayTotal = (dayIndex) => {
      return rows.reduce((acc, row) => acc + (row.entries[dayIndex]?.hours || 0), 0);
  }

  const isReadOnly = status === 'Submitted' || status === 'Approved';

  return (
    <div className="space-y-6">
      <div className="border rounded-xl shadow-sm bg-white overflow-hidden">
        {/* Header Grid */}
        <div className="grid grid-cols-[300px_repeat(7,1fr)_80px] bg-slate-50 border-b border-slate-200">
          <div className="p-4 font-heading font-semibold text-sm text-slate-700 flex items-center">
            Project / Assignment
          </div>
          {dateHeaders.map((dh, i) => (
            <div key={i} className="p-2 flex flex-col items-center justify-center border-l border-slate-100">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{dh.day}</span>
              <span className="text-sm font-bold text-slate-900">{dh.date}</span>
            </div>
          ))}
          <div className="p-4 font-heading font-semibold text-sm text-slate-700 flex items-center justify-center border-l border-slate-100 bg-slate-100/50">
            Total
          </div>
        </div>

        {/* Rows Grouped by Project */}
        <div className="divide-y divide-slate-100">
          {Object.keys(groupedRows).length === 0 && (
             <div className="p-12 text-center text-muted-foreground">
                No entries yet. Add a project to get started.
             </div>
          )}

          {Object.entries(groupedRows).map(([projectId, projectRows]) => (
            <div key={projectId} className="bg-white">
              {/* Project Group Header - Optional, or just inline. 
                  Let's show Project Name as a section header if desired, or inline. 
                  Given the screenshot, it looks like Project Name is top, then rows.
              */}
              <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-widest flex justify-between">
                {getProjectName(projectId)}
              </div>

              {projectRows.map((row) => (
                <div key={`${row.project_id}-${row.sub_project_id}`} className="grid grid-cols-[300px_repeat(7,1fr)_80px] group hover:bg-slate-50/50 transition-colors">
                  {/* Sub Project Name */}
                  <div className="p-4 flex items-center justify-between text-sm font-medium text-slate-700 border-r border-transparent">
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
                    <div key={dayIndex} className="relative border-l border-slate-100 h-12">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        disabled={isReadOnly}
                        value={entry.hours === 0 ? '' : entry.hours}
                        onChange={(e) => handleHoursChange(row.originalIndex, dayIndex, e.target.value)}
                        className="w-full h-full text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-inset focus:ring-primary/20 outline-none font-mono text-sm text-slate-900 placeholder-slate-200 transition-all"
                        placeholder="-"
                      />
                      {/* Note Indicator/Button */}
                      {(entry.notes || !isReadOnly) && (
                         <div className="absolute top-1 right-1">
                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button 
                                          className={cn(
                                            "p-0.5 rounded-full transition-all",
                                            entry.notes ? "text-primary bg-primary/10" : "text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-500"
                                          )}
                                          onClick={() => !isReadOnly && setActiveNote({ 
                                            rowIndex: row.originalIndex, 
                                            dayIndex, 
                                            notes: entry.notes, 
                                            date: dateHeaders[dayIndex].date,
                                            title: `${getProjectName(row.project_id)} - ${getSubProjectName(row.project_id, row.sub_project_id)}`
                                          })}
                                        >
                                           <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{entry.notes || "Add Note"}</p>
                                    </TooltipContent>
                                </Tooltip>
                             </TooltipProvider>
                         </div>
                      )}
                    </div>
                  ))}

                  {/* Row Total */}
                  <div className="flex items-center justify-center font-mono text-sm font-semibold text-slate-700 bg-slate-50/30 border-l border-slate-100">
                    {row.entries.reduce((sum, e) => sum + (e.hours || 0), 0)}
                  </div>
                </div>
              ))}
            </div>
          ))}
          
           {/* Daily Totals Footer */}
           <div className="grid grid-cols-[300px_repeat(7,1fr)_80px] bg-slate-100 border-t border-slate-200">
                <div className="p-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-end pr-4">
                    Weekly Total
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
        <div className="p-4 bg-white border border-dashed border-slate-300 rounded-lg flex items-center gap-4">
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
             const newRows = [...rows];
             newRows[activeNote.rowIndex].entries[activeNote.dayIndex].notes = text;
             setRows(newRows);
          }}
        />
      )}
      
      {/* Validation Warning */}
       {calculateTotal() < 40 && (
          <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-3 rounded-md border border-amber-200">
              <AlertCircle size={16} />
              <span>Note: Total hours are less than 40. You can still submit, but consider checking your entries.</span>
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
            // Keep project selected for easier sequential adding
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Project" />
                </SelectTrigger>
                <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
            </Select>

            <Select value={selectedSubProject} onValueChange={setSelectedSubProject} disabled={!selectedProject}>
                <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Task" />
                </SelectTrigger>
                <SelectContent>
                    {subProjects.map(sp => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}
                </SelectContent>
            </Select>

            <Button size="sm" onClick={handleAdd} disabled={!selectedSubProject}>
                <Plus size={16} className="mr-2" /> Add
            </Button>
        </div>
    )
}
