import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';

export function NotesModal({ isOpen, onClose, notes, dayDate, onSave, projectTitle }) {
  const [localNotes, setLocalNotes] = useState(notes || '');

  React.useEffect(() => {
    setLocalNotes(notes || '');
  }, [notes, isOpen]);

  const handleSave = () => {
    onSave(localNotes);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Notes for {dayDate}</DialogTitle>
          <div className="text-sm text-muted-foreground">{projectTitle}</div>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea 
            value={localNotes} 
            onChange={(e) => setLocalNotes(e.target.value)} 
            placeholder="Describe your work..."
            className="h-32"
          />
        </div>
        <DialogFooter>
           <Button variant="secondary" onClick={onClose}>Cancel</Button>
           <Button onClick={handleSave}>Save Note</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
