import React, { useState, useMemo } from 'react';
import { AcademicResource, Subject, ResourceCategory } from '../types';
import { formatDateOnly } from '../utils/dateUtils';
import {
  Search,
  BookOpen,
  ExternalLink,
  Plus,
  Tag,
  Edit2,
  Trash2,
  FileText,
  Link as LinkIcon,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface ResourceHubViewProps {
  resources: AcademicResource[];
  subjects: Subject[];
  onOpenNewResource: () => void;
  onEditResource: (resource: AcademicResource) => void;
  onDeleteResource: (id: string) => Promise<void>;
}

export const ResourceHubView: React.FC<ResourceHubViewProps> = ({
  resources,
  subjects,
  onOpenNewResource,
  onEditResource,
  onDeleteResource,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = res.title.toLowerCase().includes(q);
        const matchesSnippet = res.contentSnippet?.toLowerCase().includes(q);
        const matchesTags = res.tags?.some((t) => t.toLowerCase().includes(q));
        const sub = subjectMap.get(res.subjectId);
        const matchesSubject = sub
          ? sub.code.toLowerCase().includes(q) || sub.name.toLowerCase().includes(q)
          : false;

        if (!matchesTitle && !matchesSnippet && !matchesTags && !matchesSubject) {
          return false;
        }
      }

      if (selectedSubjectId !== 'all' && res.subjectId !== selectedSubjectId) {
        return false;
      }

      if (selectedCategory !== 'all' && res.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [resources, searchQuery, selectedSubjectId, selectedCategory, subjectMap]);

  const getCategoryIcon = (cat: ResourceCategory) => {
    switch (cat) {
      case 'syllabus':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
      case 'slides':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      case 'reviewer':
        return <BookOpen className="w-4 h-4 text-indigo-400" />;
      case 'past_paper':
        return <HelpCircle className="w-4 h-4 text-amber-400" />;
      case 'link':
      default:
        return <LinkIcon className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Resource Repository</h2>
        <span className="text-xs text-slate-400 tabular-nums">
          {filteredResources.length} of {resources.length} resources
        </span>
      </div>

      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/40 p-3 rounded-lg border border-slate-800">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search study materials, notes, tags..."
            className="w-full bg-slate-950 border border-slate-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Subject Filter */}
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Courses</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 capitalize"
          >
            <option value="all">All Categories</option>
            <option value="reviewer">Reviewers & Notes</option>
            <option value="slides">Lecture Slides</option>
            <option value="syllabus">Syllabi & Guides</option>
            <option value="past_paper">Past Exams / Quizzes</option>
            <option value="link">Reference Links</option>
          </select>

          {/* Add Resource Button */}
          <button
            onClick={onOpenNewResource}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Resource</span>
          </button>
        </div>
      </div>

      {/* Grid of Resources */}
      {filteredResources.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-lg p-10 text-center">
          <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-300 mb-3">
            {resources.length === 0 ? 'No resources saved yet.' : 'No resources match your search or filters.'}
          </p>
          {resources.length === 0 ? (
            <button
              onClick={onOpenNewResource}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Study Material</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSubjectId('all');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 border border-slate-700 text-slate-200 text-xs font-medium rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map((res) => {
            const subject = subjectMap.get(res.subjectId);

            return (
              <div
                key={res.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-lg p-4 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Subject Code + Category Icon + Actions */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${subject?.color || '#6366f1'}20`,
                          color: subject?.color || '#818cf8',
                        }}
                      >
                        {subject?.code || 'GEN-IT'}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 capitalize">
                        {getCategoryIcon(res.category)}
                        <span>{res.category.replace('_', ' ')}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditResource(res)}
                        title={`Edit ${res.title}`}
                        aria-label={`Edit ${res.title}`}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteResource(res.id)}
                        title={`Delete ${res.title}`}
                        aria-label={`Delete ${res.title}`}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-semibold text-white mb-2 leading-snug">
                    {res.title}
                  </h3>

                  {/* Snippet */}
                  {res.contentSnippet && (
                    <p className="text-sm text-slate-300 mb-3 line-clamp-3 leading-relaxed">
                      {res.contentSnippet}
                    </p>
                  )}

                  {/* Tags (Unboxed text with middot or small tags) */}
                  {res.tags && res.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mb-3">
                      <Tag className="w-3 h-3 text-slate-600" />
                      {res.tags.map((t, i) => (
                        <span key={i} className="text-slate-400">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer: Date Added & Open Link */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-xs text-slate-400 font-mono tabular-nums">
                    Added {formatDateOnly(res.dateAdded)}
                  </span>

                  {res.url ? (
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-indigo-800/60 bg-indigo-950/30 px-2.5 py-1.5 text-xs text-indigo-300 hover:border-indigo-600 hover:text-white font-medium transition-colors"
                    >
                      <span>Open resource</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-600">Local Reference</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
