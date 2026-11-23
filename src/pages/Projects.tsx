import React, { useState, useEffect } from 'react';
import { 
  FolderGit2, 
  Search, 
  Filter, 
  Plus, 
  ExternalLink, 
  Github, 
  Users, 
  CheckCircle2, 
  Clock, 
  X,
  Send,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { ProjectLaunchModal } from '../components/ProjectLaunchModal';
import type { Project, ProjectStatus } from '../types';

interface ProjectsProps {
  navigate: (path: string) => void;
}

export const Projects: React.FC<ProjectsProps> = ({ navigate }) => {
  const { user, isApprovedMember, signInWithGoogle } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Join Team Application Modal State
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [roleDesired, setRoleDesired] = useState('');
  const [pitch, setPitch] = useState('');
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'projects'));
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
        setProjects(list);
      } else {
        const { INITIAL_PROJECTS } = await import('../lib/seedData');
        setProjects(INITIAL_PROJECTS.map((p, i) => ({ id: `init_proj_${i}`, ...p })));
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      const { INITIAL_PROJECTS } = await import('../lib/seedData');
      setProjects(INITIAL_PROJECTS.map((p, i) => ({ id: `init_proj_${i}`, ...p })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleApplyToTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProject) return;

    try {
      setSubmittingJoin(true);
      const appRef = doc(collection(db, 'projectApplications'));
      await setDoc(appRef, {
        projectId: selectedProject.id,
        projectTitle: selectedProject.title,
        applicantId: user.uid,
        applicantName: user.displayName || 'Engineering Student',
        applicantEmail: user.email || '',
        roleDesired: roleDesired.trim(),
        pitch: pitch.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.6 },
        colors: ['#CCFF00', '#ffffff'],
      });

      setJoinSuccess(true);
      setTimeout(() => {
        setIsJoinModalOpen(false);
        setJoinSuccess(false);
        setRoleDesired('');
        setPitch('');
      }, 2500);
    } catch (err) {
      console.error('Error applying to project team:', err);
    } finally {
      setSubmittingJoin(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchDesc = p.description.toLowerCase().includes(q);
      const matchSkills = p.requiredSkills?.some((s) => s.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchSkills) return false;
    }
    return true;
  });

  const categories = Array.from(new Set(projects.map((p) => p.category))).filter(Boolean);

  return (
    <div className="min-h-screen bg-[#0b0c0e] py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-10">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#1f2229] pb-8">
          <div className="space-y-3">
            <span className="font-mono text-xs uppercase tracking-widest text-[#CCFF00]">
              Production Workspaces
            </span>
            <h1 className="font-display text-3xl sm:text-5xl font-black text-white">
              Student Engineering Projects
            </h1>
            <p className="text-xs sm:text-sm text-[#9ca3af] max-w-2xl leading-relaxed">
              Explore active hardware prototypes, autonomous algorithms, and deeptech builds. Join existing multidisciplinary teams or launch your own workspace.
            </p>
          </div>

          <button
            onClick={() => {
              if (!user) {
                signInWithGoogle();
              } else {
                setIsLaunchModalOpen(true);
              }
            }}
            className="flex items-center gap-2 rounded-xl bg-[#CCFF00] px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-[#b8e600] shadow-lg shadow-[#CCFF00]/20 transition-all cursor-pointer self-start md:self-auto"
          >
            <Plus className="h-4 w-4" /> Launch Project Workspace
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 rounded-2xl border border-[#232731] bg-[#121419] p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8e919b]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project name, tech stack (ROS2, PyTorch, PCB), or description..."
              className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2.5 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="recruiting">Recruiting Builders</option>
              <option value="in_progress">In Active Build</option>
              <option value="review">Under Review</option>
              <option value="completed">Completed Deliverable</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-[#2b2f38] bg-[#17191e] px-3 py-2.5 text-xs text-white focus:border-[#CCFF00] focus:outline-none"
            >
              <option value="all">All Domains</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Project Cards Grid */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-[#8e919b]">
            <span className="inline-block h-3 w-3 rounded-full bg-[#CCFF00] animate-ping mr-2"></span>
            Syncing project workspaces from Firestore...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-2xl border border-[#232731] bg-[#111317] p-12 text-center space-y-4">
            <FolderGit2 className="h-10 w-10 text-[#52525b] mx-auto" />
            <h3 className="font-display text-lg font-bold text-white">No projects found matching criteria</h3>
            <p className="text-xs text-[#8e919b]">Try broadening your filters or create a new project workspace.</p>
            <button
              onClick={() => setIsLaunchModalOpen(true)}
              className="rounded-xl bg-[#CCFF00] px-4 py-2 text-xs font-bold text-black uppercase"
            >
              Launch First Workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="group flex flex-col justify-between rounded-2xl border border-[#232731] bg-[#111317] p-6 space-y-6 hover:border-[#CCFF00]/50 transition-all"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-[#1b1e25] border border-[#2b2f38] px-3 py-1 font-mono text-[10px] text-zinc-300">
                      {project.category}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase border ${
                      project.status === 'recruiting'
                        ? 'bg-[#CCFF00]/10 border-[#CCFF00]/30 text-[#CCFF00]'
                        : project.status === 'in_progress'
                        ? 'bg-blue-950/40 border-blue-700/50 text-blue-400'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                    }`}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display text-lg font-bold text-white group-hover:text-[#CCFF00] transition-colors">
                      {project.title}
                    </h3>
                    <p className="text-xs text-[#8e919b] mt-2 line-clamp-3 leading-relaxed">
                      {project.description}
                    </p>
                  </div>

                  {/* Required Skills */}
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">
                      Target Disciplines & Tech:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {project.requiredSkills?.map((skill, i) => (
                        <span key={i} className="rounded bg-[#181a20] px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Team roster count */}
                  <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
                    <Users className="h-3.5 w-3.5 text-[#CCFF00]" />
                    <span>{project.teamMemberIds?.length || 1} Team Members (Lead: {project.leaderName})</span>
                  </div>
                </div>

                <div className="border-t border-[#1c1f26] pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {project.repoUrl && (
                      <a
                        href={project.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-[#181a20] text-zinc-400 hover:text-white hover:bg-[#232731]"
                        title="Repository"
                      >
                        <Github className="h-4 w-4" />
                      </a>
                    )}
                    {project.demoUrl && (
                      <a
                        href={project.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-[#181a20] text-zinc-400 hover:text-[#CCFF00] hover:bg-[#232731]"
                        title="Live Demo"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedProject(project)}
                      className="rounded-xl border border-[#2b2f38] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:border-[#CCFF00] transition-colors cursor-pointer"
                    >
                      Workspace Details
                    </button>
                    {project.status === 'recruiting' && (
                      <button
                        onClick={() => {
                          setSelectedProject(project);
                          setIsJoinModalOpen(true);
                        }}
                        className="rounded-xl bg-[#CCFF00] px-3.5 py-1.5 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600] transition-colors cursor-pointer"
                      >
                        Join Team
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Project Detail Modal */}
        {selectedProject && !isJoinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
            <div className="relative w-full max-w-2xl rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
                <div>
                  <span className="font-mono text-[10px] text-[#CCFF00] uppercase">
                    {selectedProject.category}
                  </span>
                  <h3 className="font-display text-xl font-bold text-white">
                    {selectedProject.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="rounded-lg p-1.5 text-[#9ca3af] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-semibold text-white mb-1">Architecture & Vision</h4>
                  <p className="text-[#9ca3af] leading-relaxed">{selectedProject.description}</p>
                </div>

                {selectedProject.objectives && selectedProject.objectives.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-white mb-2">Deliverable Objectives</h4>
                    <ul className="space-y-1.5 text-[#d4d4d8]">
                      {selectedProject.objectives.map((obj, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-[#CCFF00] shrink-0 mt-0.5" />
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedProject.milestones && selectedProject.milestones.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-white mb-2">Milestones Timeline</h4>
                    <div className="space-y-2">
                      {selectedProject.milestones.map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded-lg bg-[#16181f] p-2.5 border border-[#23262d]">
                          <span className={m.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}>
                            {m.title}
                          </span>
                          <span className="font-mono text-[10px] text-[#CCFF00]">{m.targetDate}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-[#262933] bg-[#14161c] p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 block">Lead Architect</span>
                    <span className="font-semibold text-white">{selectedProject.leaderName}</span>
                  </div>
                  {selectedProject.status === 'recruiting' && (
                    <button
                      onClick={() => setIsJoinModalOpen(true)}
                      className="rounded-xl bg-[#CCFF00] px-4 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600]"
                    >
                      Apply to Join Team
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Apply to Join Team Modal */}
        {isJoinModalOpen && selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
            <div className="relative w-full max-w-lg rounded-2xl border border-[#2b2f38] bg-[#0f1115] p-6 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-[#23262d] pb-4">
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    Apply to Join: {selectedProject.title}
                  </h3>
                  <p className="text-[11px] text-[#8e919b]">
                    Send your role preference and technical pitch directly to {selectedProject.leaderName}.
                  </p>
                </div>
                <button
                  onClick={() => setIsJoinModalOpen(false)}
                  className="rounded-lg p-1.5 text-[#9ca3af] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!user ? (
                <div className="py-8 text-center space-y-4">
                  <p className="text-xs text-[#9ca3af]">Please sign in with Google to send a team application.</p>
                  <button
                    onClick={() => signInWithGoogle()}
                    className="rounded-xl bg-[#CCFF00] px-5 py-2.5 font-display text-xs font-bold uppercase text-black"
                  >
                    Sign In with Google
                  </button>
                </div>
              ) : joinSuccess ? (
                <div className="py-8 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#CCFF00]/20 text-[#CCFF00]">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h4 className="font-display text-base font-bold text-white">Application Sent!</h4>
                  <p className="text-xs text-[#9ca3af]">The project leader has been notified of your interest.</p>
                </div>
              ) : (
                <form onSubmit={handleApplyToTeam} className="space-y-4 pt-4 text-xs">
                  <div>
                    <label className="block font-semibold text-white mb-1">
                      Role Desired *
                    </label>
                    <input
                      type="text"
                      value={roleDesired}
                      onChange={(e) => setRoleDesired(e.target.value)}
                      placeholder="e.g. Firmware Engineer / CFD Aerodynamicist / CV Pipeline"
                      required
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-white mb-1">
                      Why are you the right fit? (Technical Pitch) *
                    </label>
                    <textarea
                      value={pitch}
                      onChange={(e) => setPitch(e.target.value)}
                      placeholder="Mention your relevant coursework, tools mastered, or past projects..."
                      rows={4}
                      required
                      className="w-full rounded-xl border border-[#2b2f38] bg-[#17191e] px-3.5 py-2 text-white placeholder-[#5a5f6e] focus:border-[#CCFF00] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#23262d]">
                    <button
                      type="button"
                      onClick={() => setIsJoinModalOpen(false)}
                      className="rounded-xl border border-[#2b2f38] px-4 py-2 text-xs font-semibold text-[#8e919b]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingJoin}
                      className="rounded-xl bg-[#CCFF00] px-5 py-2 font-display text-xs font-bold uppercase text-black hover:bg-[#b8e600]"
                    >
                      {submittingJoin ? 'Sending...' : 'Send Join Pitch'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Launch Modal */}
        <ProjectLaunchModal
          isOpen={isLaunchModalOpen}
          onClose={() => setIsLaunchModalOpen(false)}
          onSuccess={() => {
            fetchProjects();
          }}
        />

      </div>
    </div>
  );
};
