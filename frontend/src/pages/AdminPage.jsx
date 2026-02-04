import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Trash2, FolderPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';

export default function AdminPage() {
    const [projects, setProjects] = useState([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const res = await api.get('/projects');
            setProjects(res.data);
        } catch (e) {
            toast.error("Failed to load projects");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-heading font-bold text-slate-900">System Administration</h2>
                    <p className="text-slate-500">Manage projects, codes, and system settings.</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)}>
                    <FolderPlus size={16} className="mr-2" /> New Project
                </Button>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Active Projects & Codes</CardTitle>
                        <CardDescription>Define the hierarchy for time entry.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Project Name</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Sub-Projects</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projects.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.name}</TableCell>
                                        <TableCell><code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{p.code}</code></TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {p.sub_projects.map(sp => (
                                                    <span key={sp.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                                        {sp.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" disabled>Edit</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <CreateProjectDialog 
                open={isDialogOpen} 
                onOpenChange={setIsDialogOpen} 
                onSuccess={() => {
                    loadProjects();
                    setIsDialogOpen(false);
                }} 
            />
        </div>
    );
}

function CreateProjectDialog({ open, onOpenChange, onSuccess }) {
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [subProjects, setSubProjects] = useState([{ name: "", code: "" }]);

    const handleAddSub = () => {
        setSubProjects([...subProjects, { name: "", code: "" }]);
    };

    const handleSubChange = (index, field, val) => {
        const newSubs = [...subProjects];
        newSubs[index][field] = val;
        setSubProjects(newSubs);
    };

    const handleSubmit = async () => {
        try {
            const payload = {
                name,
                code,
                sub_projects: subProjects.filter(sp => sp.name && sp.code)
            };
            await api.post('/projects', payload);
            toast.success("Project created");
            onSuccess();
            // Reset
            setName("");
            setCode("");
            setSubProjects([{ name: "", code: "" }]);
        } catch (e) {
            toast.error("Failed to create project");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Project Name</label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Website Redesign" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Project Code</label>
                            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. WEB-001" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Sub-Projects (Tasks)</label>
                        {subProjects.map((sp, i) => (
                            <div key={i} className="flex gap-2">
                                <Input 
                                    value={sp.name} 
                                    onChange={e => handleSubChange(i, 'name', e.target.value)} 
                                    placeholder="Task Name" 
                                    className="flex-1"
                                />
                                <Input 
                                    value={sp.code} 
                                    onChange={e => handleSubChange(i, 'code', e.target.value)} 
                                    placeholder="Code" 
                                    className="w-32" 
                                />
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={handleAddSub} className="mt-2">
                            <Plus size={14} className="mr-2" /> Add Task
                        </Button>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>Create Project</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
