import React, { useState, useEffect } from 'react';
import { AcademicResource, Subject, ResourceCategory } from '../types';
import { X, BookOpen, ExternalLink, Link2, FileText } from 'lucide-react';

interface ResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (resource: Omit<AcademicResource, 'id' | 'dateAdded'>) => Promise<any>;
  onUpdate?: (id: string, updates: Partial<AcademicResource>) => Promise<any>;
  editingResource?: AcademicResource | null;
  subjects: Subject[];
}

export const ResourceModal: React.FC<ResourceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  editingResource,
  subjects,
}) => {
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [category, setCategory] = useState<ResourceCategory>('reviewer');
  const [url, setUrl] = useState('');
  const [contentSnippet, setContentSnippet] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (editingResource) {
      setTitle(editingResource.title);
      setSubjectId(editingResource.subjectId);
      setCategory(editingResource.category);
      setUrl(editingResource.url || '');
      setContentSnippet(editingResource.contentSnippet || '');
      setTagsInput(editingResource.tags ? editingResource.tags.join(', ') : '');
    } else {
      setTitle('');
      setSubjectId(subjects[0]?.id || '');
      setCategory('reviewer');
      setUrl('');
      setContentSnippet('');
      setTagsInput('');
    }
    setErrorMsg('');
  }, [editingResource, isOpen, subjects]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Resource title is required.');
      return;
    }
    if (!subjectId) {
      setErrorMsg('Subject selection is required.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const payload = {
      title: title.trim(),
      subjectId,
      category,
      url: url.trim() || undefined,
      contentSnippet: contentSnippet.trim() || undefined,
      tags,
    };

    if (editingResource && onUpdate) {
      await onUpdate(editingResource.id, payload);
    } else {
      await onSave(payload);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-lg w-full p-6 shadow-2xl relative my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>{editingResource ? 'Edit Academic Resource' : 'Add Academic Resource'}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Resource Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter 2 Literature Review Synthesis Matrix"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Associated Course *
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} - {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ResourceCategory)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 capitalize"
              >
                <option value="reviewer">Reviewer / Notes</option>
                <option value="slides">Lecture Slides</option>
                <option value="syllabus">Syllabus / Guide</option>
                <option value="past_paper">Past Paper / Exam</option>
                <option value="link">Reference Link</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Document URL or Cloud Drive Link</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/... or https://ptc.edu.ph/..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Summary or Key Takeaways
            </label>
            <textarea
              rows={3}
              value={contentSnippet}
              onChange={(e) => setContentSnippet(e.target.value)}
              placeholder="Key concepts, page references, formula summaries or notes..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Capstone, Midterm, Database, ERD"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md shadow-sm shadow-indigo-600/30 transition-colors cursor-pointer"
            >
              {editingResource ? 'Save Resource' : 'Add to Repository'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
