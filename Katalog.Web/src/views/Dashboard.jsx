import { createSignal, createMemo, For, Show, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import {
  apiService,
  computeProjectSummary,
  formatCompactRupiah,
  formatPublicLocation,
  parseSmartRupiahNumber
} from '../services/api';
import {
  DEFAULT_COVER_IMG,
  DEFAULT_THUMB_IMG,
  createDefaultProjectForm
} from '../constants/defaultData';
import { getStatusColor } from '../utils/formatters';
import ProjectFormModal from '../components/dashboard/ProjectFormModal';
import '../styles/dashboard.css';
import KnowledgeBaseManager from '../components/dashboard/KnowledgeBaseManager';
import { buildAgentReferralUrl, createAgentSlug, formatWaDisplay } from '../utils/i18n';

const IconBase = (props) => (
  <svg
    width={props.size || 18}
    height={props.size || 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={props.strokeWidth || 1.8}
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {props.children}
  </svg>
);

const SvgIcon = {
  Layers: () => (
    <IconBase size={20}>
      <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
      <polyline points="2 17 12 22 22 17"></polyline>
      <polyline points="2 12 12 17 22 12"></polyline>
    </IconBase>
  ),
  Chart: () => (
    <IconBase size={18}>
      <line x1="18" y1="20" x2="18" y2="10"></line>
      <line x1="12" y1="20" x2="12" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="14"></line>
    </IconBase>
  ),
  Building: () => (
    <IconBase size={18}>
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
      <path d="M9 22v-4h6v4"></path>
      <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"></path>
    </IconBase>
  ),
  Activity: () => (
    <IconBase size={18}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </IconBase>
  ),
  Users: () => (
    <IconBase size={18}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </IconBase>
  ),
  Globe: () => (
    <IconBase size={18}>
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </IconBase>
  ),
  Refresh: () => (
    <IconBase size={15}>
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </IconBase>
  ),
  Plus: () => (
    <IconBase size={16} strokeWidth={2}>
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </IconBase>
  ),
  Minus: () => (
    <IconBase size={16} strokeWidth={2}>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </IconBase>
  ),
  MapPin: () => (
    <IconBase size={13}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3"></circle>
    </IconBase>
  ),
  Image: () => (
    <IconBase size={14}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </IconBase>
  ),
  Video: () => (
    <IconBase size={14}>
      <polygon points="23 7 16 12 23 17 23 7"></polygon>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
    </IconBase>
  ),
  Edit: () => (
    <IconBase size={16}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </IconBase>
  ),
  Trash: () => (
    <IconBase size={16}>
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </IconBase>
  ),
  Bed: () => (
    <IconBase size={14}>
      <path d="M2 4v16"></path>
      <path d="M2 8h18a2 2 0 0 1 2 2v10"></path>
      <path d="M2 17h20"></path>
      <path d="M6 8v9"></path>
    </IconBase>
  ),
  Bath: () => (
    <IconBase size={14}>
      <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"></path>
      <line x1="10" y1="5" x2="8" y2="7"></line>
      <line x1="2" y1="12" x2="22" y2="12"></line>
    </IconBase>
  ),
  Car: () => (
    <IconBase size={14}>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path>
      <circle cx="7" cy="17" r="2"></circle>
      <path d="M9 17h6"></path>
      <circle cx="17" cy="17" r="2"></circle>
    </IconBase>
  ),
  Shield: () => (
    <IconBase size={15}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </IconBase>
  ),
  Key: () => (
    <IconBase size={15}>
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
    </IconBase>
  ),
  Copy: () => (
    <IconBase size={14}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </IconBase>
  ),
  Check: () => (
    <IconBase size={14} strokeWidth={2.2}>
      <polyline points="20 6 9 17 4 12"></polyline>
    </IconBase>
  ),
  Eye: () => (
    <IconBase size={15}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </IconBase>
  ),
  EyeOff: () => (
    <IconBase size={15}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </IconBase>
  ),
  LogOut: () => (
    <IconBase size={16}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </IconBase>
  ),
  ChatBot: () => (
    <IconBase size={18}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </IconBase>
  )
};

const VALID_TABS = ['analytics', 'management', 'logs', 'team', 'knowledge'];
const DEFAULT_ACCOUNT_FORM = {
  name: '',
  email: '',
  password: '',
  phone: '',
  role: 'ADMIN',
  title: 'Property Agent'
};

export default function Dashboard(props) {
  const rawSavedTab = localStorage.getItem('jakurban_dashboard_tab');
  const [adminView, setAdminViewState] = createSignal(
    VALID_TABS.includes(rawSavedTab) ? rawSavedTab : 'analytics'
  );

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = createSignal(false);

  const setAdminView = (tab) => {
    setAdminViewState(tab);
    setIsMobileSidebarOpen(false);
    localStorage.setItem('jakurban_dashboard_tab', tab);
  };

  const [showProjectModal, setShowProjectModal] = createSignal(false);
  const [isEditingProject, setIsEditingProject] = createSignal(false);
  const [showUnitForm, setShowUnitForm] = createSignal(false);
  const [expandedProjects, setExpandedProjects] = createSignal({});
  const [isLoading, setIsLoading] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [apiStatus, setApiStatus] = createSignal('connecting');
  const [logFilter, setLogFilter] = createSignal('ALL');
  const [logDateFrom, setLogDateFrom] = createSignal('');
  const [logDateTo, setLogDateTo] = createSignal('');
  const [logPage, setLogPage] = createSignal(1);
  const LOGS_PER_PAGE = 8;

  const [editingAccountId, setEditingAccountId] = createSignal(null);

  const [newAccountForm, setNewAccountForm] = createStore({ ...DEFAULT_ACCOUNT_FORM });
  const [visiblePasswords, setVisiblePasswords] = createSignal({});
  const [copiedId, setCopiedId] = createSignal(null);
  const [projectForm, setProjectForm] = createStore(createDefaultProjectForm());

  const isSuperAdmin = () =>
    props.userRole === 'SUPER_ADMIN' || props.currentUser?.role === 'SUPER_ADMIN';

  const activeUser = () =>
    props.currentUser || {
      name: isSuperAdmin() ? 'Super Admin' : 'Admin JakUrban',
      email: isSuperAdmin() ? 'super@jakurban.com' : 'admin@jakurban.com',
      role: props.userRole || 'ADMIN'
    };

  const getInitials = (name = '') =>
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'JU';

  const loadProjectsFromBackend = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getProjects();
      if (Array.isArray(data) && data.length > 0) {
        props.setClusters(data);
      }
      setApiStatus('online');
    } catch (err) {
      console.warn('Backend belum terjangkau, menggunakan state lokal:', err.message);
      setApiStatus('offline');
    } finally {
      setIsLoading(false);
    }
  };

  onMount(loadProjectsFromBackend);

  const toggleExpandProject = (projectId) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const openAddProjectModal = () => {
    setProjectForm(createDefaultProjectForm());
    setShowUnitForm(false);
    setIsEditingProject(false);
    setShowProjectModal(true);
  };

  const openEditProjectModal = (project, openUnitAdder = false) => {
    const existingPhotos = Array.isArray(project.photos)
      ? [...project.photos]
      : project.img
      ? [project.img]
      : [];
    const existingVideos = Array.isArray(project.videos) ? [...project.videos] : [];
    const existingUnits = Array.isArray(project.units)
      ? project.units.map((u) => {
          const rawDigit = parseSmartRupiahNumber(u.rawPrice || u.price || 0);
          return {
            ...u,
            price: rawDigit > 0 ? String(rawDigit) : '',
            rawPrice: rawDigit
          };
        })
      : [];

    setProjectForm({
      id: project.id,
      name: project.cluster || project.name || '',
      location: project.location || '',
      exactLocation: project.exactLocation || '',
      description: project.description || '',
      photos: existingPhotos,
      videos: existingVideos,
      units: existingUnits
    });

    setShowUnitForm(openUnitAdder);
    setIsEditingProject(true);
    setShowProjectModal(true);
  };

  const closeProjectModal = () => {
    setShowProjectModal(false);
    setIsEditingProject(false);
    setShowUnitForm(false);
  };

  const applySavedCluster = (savedProject, editingMode, targetId) => {
    if (editingMode) {
      props.setClusters(props.clusters.map((c) => (c.id === targetId ? savedProject : c)));
    } else {
      props.setClusters([savedProject, ...(props.clusters || [])]);
      setExpandedProjects((prev) => ({ ...prev, [savedProject.id]: true }));
    }
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const editingMode = isEditingProject();
    const mainCover = projectForm.photos[0] || DEFAULT_COVER_IMG;

    const rawPayload = computeProjectSummary({
      id: editingMode ? projectForm.id : 0,
      name: projectForm.name,
      cluster: projectForm.name,
      location: formatPublicLocation(projectForm.location),
      exactLocation: projectForm.exactLocation || '',
      description: projectForm.description,
      img: mainCover,
      photos: [...projectForm.photos],
      videos: [...projectForm.videos],
      units: projectForm.units.map((u) => ({
        ...u,
        beds: Number(u.beds || 0),
        baths: Number(u.baths || 0),
        carport: Number(u.carport ?? 1),
        photos: Array.isArray(u.photos) ? [...u.photos] : []
      }))
    });

    const mergeServerProject = (serverData) =>
      computeProjectSummary({
        ...serverData,
        exactLocation: projectForm.exactLocation || '',
        photos: projectForm.photos?.length ? [...projectForm.photos] : (serverData.photos || []),
        videos: projectForm.videos?.length ? [...projectForm.videos] : (serverData.videos || []),
        units: (serverData.units || []).map((su, idx) => ({
          ...su,
          carport: rawPayload.units[idx]?.carport ?? su.carport ?? 1,
          photos: rawPayload.units[idx]?.photos?.length ? rawPayload.units[idx].photos : su.photos,
          videos: rawPayload.units[idx]?.videos?.length ? rawPayload.units[idx].videos : su.videos
        }))
      });

    try {
      const responseData = editingMode
        ? await apiService.updateProject(projectForm.id, rawPayload)
        : await apiService.createProject(rawPayload);

      applySavedCluster(mergeServerProject(responseData), editingMode, projectForm.id);
      setApiStatus('online');
    } catch (err) {
      console.warn('Simpan ke API gagal, menyimpan ke state lokal:', err.message);
      setApiStatus('offline');
      const fallbackPayload = computeProjectSummary({
        ...rawPayload,
        id: editingMode ? projectForm.id : `proj-${Date.now()}`
      });
      applySavedCluster(fallbackPayload, editingMode, fallbackPayload.id);
    } finally {
      props.addActivityLog?.({
        action: editingMode ? 'UPDATE' : 'CREATE',
        category: 'PROJECT',
        target: rawPayload.name,
        details: editingMode
          ? `Memperbarui data project (${rawPayload.location}) beserta ${rawPayload.units.length} tipe unit`
          : `Menambahkan project baru di ${rawPayload.location} dengan ${rawPayload.units.length} tipe unit`
      });
      setIsSaving(false);
      closeProjectModal();
    }
  };

  const handleDeleteProject = async (id) => {
    const targetProject = (props.clusters || []).find((p) => p.id === id);
    if (!confirm(`Apakah Anda yakin ingin menghapus "${targetProject?.name || 'project ini'}" beserta seluruh unitnya?`)) return;
    try {
      await apiService.deleteProject(id);
      setApiStatus('online');
    } catch (err) {
      console.warn('Hapus di API gagal, menghapus dari state lokal:', err.message);
    }
    props.setClusters(props.clusters.filter((p) => p.id !== id));
    props.addActivityLog?.({
      action: 'DELETE',
      category: 'PROJECT',
      target: targetProject?.name || `Project #${id}`,
      details: 'Menghapus project beserta seluruh inventori unit di dalamnya'
    });
  };

  const handleDeleteUnitFromTable = async (project, unitId) => {
    const targetUnit = (project.units || []).find((u) => u.id === unitId);
    if (!confirm(`Hapus unit "${targetUnit?.name || ''}" dari ${project.name}?`)) return;
    const updatedUnits = (project.units || []).filter((u) => u.id !== unitId);
    const updatedProjectPayload = computeProjectSummary({ ...project, units: updatedUnits });

    try {
      const saved = await apiService.updateProject(project.id, updatedProjectPayload);
      props.setClusters(props.clusters.map((p) => (p.id === project.id ? saved : p)));
    } catch {
      props.setClusters(
        props.clusters.map((p) => (p.id === project.id ? updatedProjectPayload : p))
      );
    }

    props.addActivityLog?.({
      action: 'DELETE',
      category: 'UNIT',
      target: `${targetUnit?.name || 'Unit'} — ${project.name}`,
      details: `Menghapus tipe unit dari project ${project.name}`
    });
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = 'JU-';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewAccountForm('password', pass);
  };

  const handleStartEditAccount = (acc) => {
    if (!isSuperAdmin()) return;
    setEditingAccountId(acc.id);
    setNewAccountForm({
      name: acc.name || '',
      email: acc.email || '',
      password: acc.password || '',
      phone: acc.phone || '',
      slug: acc.slug || '',
      role: acc.role || 'ADMIN',
      title: acc.title || 'Property Agent'
    });
  };

  const handleCancelEditAccount = () => {
    setEditingAccountId(null);
    setNewAccountForm({ ...DEFAULT_ACCOUNT_FORM });
  };

  const handleCreateAccount = (e) => {
    e.preventDefault();
    if (!isSuperAdmin()) return;

    const cleanName = newAccountForm.name.trim();
    const cleanEmail = newAccountForm.email.trim().toLowerCase();
    const cleanPassword = newAccountForm.password.trim();
    const cleanPhone = newAccountForm.phone.trim();
    const targetEditId = editingAccountId();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      alert('Nama, Email, dan Password wajib diisi.');
      return;
    }

    const exists = (props.accounts || []).some(
      (acc) => acc.id !== targetEditId && acc.email.toLowerCase() === cleanEmail
    );
    if (exists) {
      alert('Email tersebut sudah terdaftar pada akun lain. Gunakan email lain.');
      return;
    }

    if (targetEditId) {
      const updatedList = (props.accounts || []).map((acc) =>
        acc.id === targetEditId
          ? {
              ...acc,
              name: cleanName,
              email: cleanEmail,
              password: cleanPassword,
              role: newAccountForm.role,
              title: newAccountForm.title || 'Property Agent'
            }
          : acc
      );

      props.setAccounts?.(updatedList);
      props.addActivityLog?.({
        action: 'UPDATE',
        category: 'TEAM',
        target: `${cleanName} (${cleanEmail})`,
        details: `Memperbarui kredensial akun ${
          newAccountForm.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin / Agent'
        } (${newAccountForm.title || 'Property Agent'})`
      });

      handleCancelEditAccount();
      return;
    }

    const now = new Date();
    const createdAccount = {
      id: `usr-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword,
      phone: cleanPhone,
      slug: createAgentSlug(cleanName),
      role: newAccountForm.role,
      title: newAccountForm.title || 'Property Agent',
      createdAt:
        now.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) +
        ', ' +
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    props.setAccounts?.([...(props.accounts || []), createdAccount]);
    props.addActivityLog?.({
      action: 'CREATE',
      category: 'TEAM',
      target: `${cleanName} (${cleanEmail})`,
      details: `Membuat kredensial login ${
        createdAccount.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin / Agent'
      } (${createdAccount.title})`
    });

    setNewAccountForm({ ...DEFAULT_ACCOUNT_FORM });
  };

  const handleRemoveAccount = (acc) => {
    if (!isSuperAdmin()) return;
    if (acc.email.toLowerCase() === activeUser().email?.toLowerCase()) {
      alert('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.');
      return;
    }
    if (!confirm(`Cabut akses login untuk ${acc.name} (${acc.email})?`)) return;

    props.setAccounts?.((props.accounts || []).filter((item) => item.id !== acc.id));
    props.addActivityLog?.({
      action: 'DELETE',
      category: 'TEAM',
      target: `${acc.name} (${acc.email})`,
      details: 'Mencabut akses kredensial akun dari sistem'
    });
  };

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyAccountCredentials = (acc) => {
    const text = `Akses Login JakUrban OS\nNama: ${acc.name}\nRole: ${acc.role}\nEmail: ${acc.email}\nPassword: ${acc.password}`;
    navigator.clipboard?.writeText(text);
    setCopiedId(acc.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const MONTH_MAP = {
    jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5,
    jul: 6, agu: 7, aug: 7, agt: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11
  };

  const parseLogTimestampDate = (timestampStr = '') => {
    if (!timestampStr) return null;
    const match = String(timestampStr).match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const monthKey = match[2].slice(0, 3).toLowerCase();
      const year = parseInt(match[3], 10);
      const monthIdx = MONTH_MAP[monthKey];
      if (monthIdx !== undefined) {
        return new Date(year, monthIdx, day);
      }
    }
    const fallbackDate = new Date(timestampStr);
    return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
  };

  const filteredLogs = createMemo(() => {
    let logs = props.activityLogs || [];
    if (logFilter() === 'CRUD') {
      logs = logs.filter((l) => l.category === 'PROJECT' || l.category === 'UNIT');
    } else if (logFilter() !== 'ALL') {
      logs = logs.filter((l) => l.category === logFilter());
    }

    const fromStr = logDateFrom();
    const toStr = logDateTo();

    if (fromStr || toStr) {
      const fromDate = fromStr ? new Date(`${fromStr}T00:00:00`) : null;
      const toDate = toStr ? new Date(`${toStr}T23:59:59`) : null;

      logs = logs.filter((l) => {
        const logDate = parseLogTimestampDate(l.timestamp);
        if (!logDate) return true;
        if (fromDate && logDate < fromDate) return false;
        if (toDate && logDate > toDate) return false;
        return true;
      });
    }

    return logs;
  });

  const totalLogPages = createMemo(() =>
    Math.max(1, Math.ceil(filteredLogs().length / LOGS_PER_PAGE))
  );

  const paginatedLogs = createMemo(() => {
    const current = Math.min(logPage(), totalLogPages());
    const start = (current - 1) * LOGS_PER_PAGE;
    return filteredLogs().slice(start, start + LOGS_PER_PAGE);
  });

  const totalVisitorProjectClicks = createMemo(() =>
    Object.values(props.analytics?.projectClicks || {}).reduce((acc, val) => acc + Number(val || 0), 0)
  );

  const totalVisitorUnitClicks = createMemo(() =>
    Object.values(props.analytics?.unitClicks || {}).reduce((acc, val) => acc + Number(val || 0), 0)
  );

  const getActionBadgeClass = (action) => {
    const map = {
      CREATE: 'log-badge create',
      UPDATE: 'log-badge update',
      DELETE: 'log-badge delete',
      LOGIN: 'log-badge login',
      LOGOUT: 'log-badge logout'
    };
    return map[action] || 'log-badge';
  };

  const statusLabel = () => {
    if (apiStatus() === 'online') return 'Terhubung';
    if (apiStatus() === 'connecting') return 'Menghubungkan...';
    return 'Terputus';
  };

  return (
    <div class="dashboard-layout">
      {/* SIDEBAR */}

      {/* TAMBAHKAN BACKDROP INI TEPAT DI ATAS <aside> */}
      <Show when={isMobileSidebarOpen()}>
        <div
          class="dashboard-sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
        ></div>
      </Show>

      <aside class={`sidebar-modern ${isMobileSidebarOpen() ? 'open' : ''}`}>
        <div class="sidebar-header">
          <div class="brand-logo">
            <SvgIcon.Layers />
          </div>
          <div>
            <h3 class="brand-title">JakUrban OS</h3>
            <span class="brand-version">Enterprise Workspace</span>
          </div>
          <button
            type="button"
            class="dashboard-sidebar-close"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Tutup Sidebar"
          >
            ✕
          </button>
        </div>

        <div class="sidebar-user-card">
          <div class="user-avatar">{getInitials(activeUser().name)}</div>
          <div class="user-meta">
            <strong>{activeUser().name}</strong>
            <span>{activeUser().email}</span>
            <span class={`role-pill ${isSuperAdmin() ? 'super' : 'admin'}`}>
              {isSuperAdmin() ? 'SUPER ADMIN' : 'ADMIN / AGENT'}
            </span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <span class="nav-section-label">Menu Utama</span>
          <button
            class={`nav-btn ${adminView() === 'analytics' ? 'active' : ''}`}
            onClick={() => setAdminView('analytics')}
          >
            <SvgIcon.Chart />
            <span>Ringkasan Eksekutif</span>
          </button>

          <button
            class={`nav-btn ${adminView() === 'management' ? 'active' : ''}`}
            onClick={() => setAdminView('management')}
          >
            <SvgIcon.Building />
            <span>Manajemen Proyek</span>
          </button>

          <button
            class={`nav-btn ${adminView() === 'logs' ? 'active' : ''}`}
            onClick={() => setAdminView('logs')}
          >
            <SvgIcon.Activity />
            <span>Log Aktivitas</span>
            <span class="nav-counter">{(props.activityLogs || []).length}</span>
          </button>

          <Show when={isSuperAdmin()}>
            <span class="nav-section-label nav-section-spaced">
              Otoritas Super Admin
            </span>
            <button
              class={`nav-btn ${adminView() === 'knowledge' ? 'active' : ''}`}
              onClick={() => setAdminView('knowledge')}
            >
              <SvgIcon.ChatBot />
              <span>Knowledge Base AI</span>
            </button>
            <button
              class={`nav-btn ${adminView() === 'team' ? 'active' : ''}`}
              onClick={() => setAdminView('team')}
            >
              <SvgIcon.Users />
              <span>Kelola Tim & Akses</span>
              <span class="nav-counter">{(props.accounts || []).length}</span>
            </button>
          </Show>

          <div class="nav-divider"></div>

          <button class="nav-btn" onClick={() => props.setView?.('catalog')}>
            <SvgIcon.Globe />
            <span>Kembali ke Katalog</span>
          </button>

          <Show when={props.onLogout}>
            <button class="nav-btn danger-nav" onClick={props.onLogout}>
              <SvgIcon.LogOut />
              <span>Keluar Sesi</span>
            </button>
          </Show>
        </nav>

        <div class="sidebar-status-footer">
          <div class="status-indicator-row">
            <span class={`status-dot ${apiStatus()}`}></span>
            <span>
              Server: <strong>{statusLabel()}</strong>
            </span>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main class="main-workspace">
        <div class="dashboard-mobile-topbar">
          <button
            type="button"
            class="dashboard-burger-btn"
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Buka Menu Sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <span class="dashboard-mobile-title">JakUrban OS</span>
        </div>
        <Show when={adminView() === 'analytics'}>
          <div class="workspace-header">
            <div>
              <h1 class="page-title">Ringkasan Eksekutif</h1>
              <p class="page-subtitle">
                Metrik inventori properti, kunjungan katalog, interaksi asisten AI, dan aktivitas operasional terkini.
              </p>
            </div>
            <div class="header-actions">
              <button class="btn-ghost" onClick={() => setAdminView('logs')}>
                <SvgIcon.Activity /> Lihat Semua Log
              </button>
              <button class="btn-primary" onClick={() => setAdminView('management')}>
                <SvgIcon.Building /> Kelola Properti
              </button>
            </div>
          </div>

          {/* BARIS KPI UTAMA (4 KARTU TERPISAH) */}
          <div class="bento-kpi-row">
            <div class="bento-card">
              <div class="bento-card-top">
                <span class="bento-label">Total Proyek / Cluster</span>
                <div class="bento-icon-box"><SvgIcon.Building /></div>
              </div>
              <div class="bento-value">
                {(props.clusters || []).length}
                <span class="trend up">Aktif</span>
              </div>
              <p class="bento-desc">Tersinkronisasi dengan halaman katalog utama.</p>
            </div>

            <div class="bento-card">
              <div class="bento-card-top">
                <span class="bento-label">Total Tipe / Unit</span>
                <div class="bento-icon-box"><SvgIcon.Layers /></div>
              </div>
              <div class="bento-value">
                {(props.clusters || []).reduce((acc, p) => acc + (p.units?.length || 0), 0)}
              </div>
              <p class="bento-desc">Akumulasi tipe unit di seluruh cluster.</p>
            </div>

            <div class="bento-card">
              <div class="bento-card-top">
                <span class="bento-label">Kunjungan Katalog</span>
                <div class="bento-icon-box"><SvgIcon.Globe /></div>
              </div>
              <div class="bento-value">
                {props.analytics?.catalogViews || 0}
                <span class="trend up">
                  {totalVisitorProjectClicks() + totalVisitorUnitClicks()} Klik
                </span>
              </div>
              <p class="bento-desc">
                Kunjungan publik murni ({totalVisitorProjectClicks()} klik proyek & {totalVisitorUnitClicks()} klik unit).
              </p>
            </div>

            <div class="bento-card">
              <div class="bento-card-top">
                <span class="bento-label">Sesi & Interaksi Chat AI</span>
                <div class="bento-icon-box"><SvgIcon.ChatBot /></div>
              </div>
              <div class="bento-value">
                {props.analytics?.chatQuestionsCount || 0}
                <span class="trend up">RAG Aktif</span>
              </div>
              <p class="bento-desc">Total pertanyaan & konsultasi pengunjung ke asisten AI.</p>
            </div>
          </div>

          {/* BARIS ANALITIK DETAIL & LOG */}
          <div class="bento-grid bento-grid-spaced">
            <div class="bento-card col-span-2">
              <div class="bento-card-header-row">
                <div>
                  <span class="bento-label">Aktivitas Tim Terbaru</span>
                  <p class="bento-desc">Rekam jejak langsung dari Super Admin dan Admin.</p>
                </div>
                <button class="btn-sm-outline" onClick={() => setAdminView('logs')}>
                  Buka Audit Log
                </button>
              </div>

              <div class="mini-log-list">
                <For each={(props.activityLogs || []).slice(0, 4)}>
                  {(log) => (
                    <div class="mini-log-item">
                      <span class={getActionBadgeClass(log.action)}>{log.action}</span>
                      <div class="mini-log-body">
                        <strong>{log.actorName}</strong> melakukan perubahan pada{' '}
                        <span class="mini-log-target">{log.target}</span>
                        <div class="mini-log-sub">{log.details}</div>
                      </div>
                      <span class="mini-log-time">{log.timestamp}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>

            <div class="bento-card">
              <span class="bento-label">Estimasi Harga Cluster & Klik Pengunjung</span>
              <div class="leaderboard">
                <For each={(props.clusters || []).slice(0, 4)}>
                  {(proj) => (
                    <div class="leader-item">
                      <div>
                        <strong>{proj.name}</strong>
                        <span class="leader-sub">
                          {proj.priceRange || proj.price} • {(proj.units || []).length} Unit
                        </span>
                      </div>
                      <div class="metric">
                        {(props.analytics?.projectClicks || {})[proj.name] || 0} Klik
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </Show>

        <Show when={adminView() === 'management'}>
          <div class="workspace-header">
            <div>
              <h1 class="page-title">Manajemen Proyek</h1>
              <p class="page-subtitle">
                Kelola daftar project/cluster, galeri media, dan inventori unit. Semua perubahan tercatat di Log Aktivitas.
              </p>
            </div>
            <div class="header-actions">
              <button class="btn-ghost" onClick={loadProjectsFromBackend} disabled={isLoading()}>
                <SvgIcon.Refresh />
                <span>{isLoading() ? 'Memuat...' : 'Sinkronisasi API'}</span>
              </button>
              <button class="btn-primary" onClick={openAddProjectModal}>
                <SvgIcon.Plus />
                <span>Tambah Project</span>
              </button>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Project / Cluster</th>
                  <th>Media Galeri</th>
                  <th>Inventori Unit</th>
                  <th>Estimasi Harga & Spesifikasi</th>
                  <th class="text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={props.clusters}
                  fallback={
                    <tr>
                      <td colSpan="5" class="empty-table-cell">
                        {isLoading()
                          ? 'Sedang memuat data dari server...'
                          : 'Belum ada project properti. Klik "Tambah Project" untuk memulai.'}
                      </td>
                    </tr>
                  }
                >
                  {(project) => {
                    const units = () => project.units || [];
                    const photos = () => project.photos || (project.img ? [project.img] : []);
                    const videos = () => project.videos || [];
                    const isExpanded = () => !!expandedProjects()[project.id];

                    return (
                      <>
                        <tr class="project-row">
                          <td>
                            <div class="project-cell">
                              <button
                                class="expand-btn"
                                onClick={() => toggleExpandProject(project.id)}
                                title="Tampilkan Unit"
                              >
                                <Show when={isExpanded()} fallback={<SvgIcon.Plus />}>
                                  <SvgIcon.Minus />
                                </Show>
                              </button>
                              <img
                                src={photos()[0] || DEFAULT_THUMB_IMG}
                                alt={project.name}
                                class="project-thumb"
                              />
                              <div class="prop-info">
                                <strong>{project.name}</strong>
                                <span class="location-inline">
                                  <SvgIcon.MapPin /> {formatPublicLocation(project.location)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div class="media-badges">
                              <span class="media-pill">
                                <SvgIcon.Image /> {photos().length} Foto
                              </span>
                              <span class="media-pill">
                                <SvgIcon.Video /> {videos().length} Video
                              </span>
                            </div>
                          </td>
                          <td>
                            <div class="unit-summary">
                              <strong>{units().length} Tipe Unit</strong>
                              <span
                                class="unit-link"
                                onClick={() => toggleExpandProject(project.id)}
                              >
                                {isExpanded() ? 'Tutup rincian unit' : 'Lihat rincian unit'}
                              </span>
                            </div>
                          </td>
                          <td class="price-col">
                            <div>{project.priceRange || project.price || '-'}</div>
                            <div class="price-col-sub">
                              {project.bedsRange || '-'} KT • {project.bathsRange || '-'} KM • {project.carportRange || 1} Carport
                            </div>
                          </td>
                          <td class="td-actions">
                            <button
                              class="btn-sm-outline"
                              onClick={() => openEditProjectModal(project, true)}
                            >
                              <SvgIcon.Plus /> Unit
                            </button>
                            <button
                              class="btn-icon edit"
                              title="Edit Project & Media"
                              onClick={() => openEditProjectModal(project, false)}
                            >
                              <SvgIcon.Edit />
                            </button>
                            <button
                              class="btn-icon delete"
                              title="Hapus Project"
                              onClick={() => handleDeleteProject(project.id)}
                            >
                              <SvgIcon.Trash />
                            </button>
                          </td>
                        </tr>

                        <Show when={isExpanded()}>
                          <tr class="units-drawer-row">
                            <td colSpan="5">
                              <div class="units-drawer">
                                <div class="units-drawer-header">
                                  <span>
                                    Daftar Unit di <strong>{project.name}</strong> ({units().length})
                                  </span>
                                  <button
                                    class="btn-xs-primary"
                                    onClick={() => openEditProjectModal(project, true)}
                                  >
                                    <SvgIcon.Plus /> Tambah Unit Baru
                                  </button>
                                </div>

                                <Show
                                  when={units().length > 0}
                                  fallback={
                                    <div class="empty-units">
                                      Belum ada tipe unit di project ini. Klik "Tambah Unit Baru" untuk menambahkan.
                                    </div>
                                  }
                                >
                                  <div class="units-grid-list">
                                    <For each={units()}>
                                      {(u) => (
                                        <div class="unit-item-card">
                                          <div class="unit-item-main">
                                            <div>
                                              <div class="unit-item-title">
                                                <strong>{u.name}</strong>
                                                <span class={`badge ${getStatusColor(u.status)}`}>
                                                  {u.status || 'Tersedia'}
                                                </span>
                                              </div>
                                              <div class="unit-item-specs">
                                                <span>LT: {u.landArea || '-'} m²</span>
                                                <span>•</span>
                                                <span>LB: {u.buildArea || '-'} m²</span>
                                                <span>•</span>
                                                <span class="spec-with-icon">
                                                  <SvgIcon.Bed /> {u.beds} KT
                                                </span>
                                                <span>•</span>
                                                <span class="spec-with-icon">
                                                  <SvgIcon.Bath /> {u.baths} KM
                                                </span>
                                                <span>•</span>
                                                <span class="spec-with-icon">
                                                  <SvgIcon.Car /> {u.carport ?? 1} Carport
                                                </span>
                                              </div>
                                              <Show when={u.description}>
                                                <p class="unit-item-desc">{u.description}</p>
                                              </Show>
                                            </div>
                                            <div class="unit-item-right">
                                              <div class="unit-price">{formatCompactRupiah(u.rawPrice || u.price)}</div>
                                              <div class="unit-item-actions">
                                                <button
                                                  class="btn-text"
                                                  onClick={() => openEditProjectModal(project, false)}
                                                >
                                                  Kelola
                                                </button>
                                                <button
                                                  class="btn-text danger"
                                                  onClick={() =>
                                                    handleDeleteUnitFromTable(project, u.id)
                                                  }
                                                >
                                                  Hapus
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </For>
                                  </div>
                                </Show>
                              </div>
                            </td>
                          </tr>
                        </Show>
                      </>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </Show>

        <Show when={adminView() === 'logs'}>
          <div class="workspace-header">
            <div>
              <h1 class="page-title">Log Aktivitas Sistem</h1>
              <p class="page-subtitle">
                Transparansi operasional penuh — seluruh Super Admin dan Admin dapat memantau riwayat CRUD & autentikasi secara real-time.
              </p>
            </div>
            <div class="log-filter-pills">
              <For
                each={[
                  { key: 'ALL', label: `Semua (${(props.activityLogs || []).length})` },
                  { key: 'CRUD', label: 'Proyek & Unit' },
                  { key: 'TEAM', label: 'Tim & Akses' },
                  { key: 'AUTH', label: 'Sesi Login' }
                ]}
              >
                {(item) => (
                  <button
                    class={`filter-pill-btn ${logFilter() === item.key ? 'active' : ''}`}
                    onClick={() => {
                      setLogFilter(item.key);
                      setLogPage(1);
                    }}
                  >
                    {item.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* FILTER RANGE TANGGAL LOG AKTIVITAS */}
          <div class="log-date-filter-bar">
            <div class="log-date-field">
              <label>Dari Tanggal:</label>
              <input
                type="date"
                value={logDateFrom()}
                onInput={(e) => {
                  setLogDateFrom(e.currentTarget.value);
                  setLogPage(1);
                }}
              />
            </div>
            <div class="log-date-field">
              <label>Sampai Tanggal:</label>
              <input
                type="date"
                value={logDateTo()}
                onInput={(e) => {
                  setLogDateTo(e.currentTarget.value);
                  setLogPage(1);
                }}
              />
            </div>
            <Show when={logDateFrom() || logDateTo()}>
              <button
                type="button"
                class="btn-sm-outline"
                onClick={() => {
                  setLogDateFrom('');
                  setLogDateTo('');
                  setLogPage(1);
                }}
              >
                Reset Tanggal
              </button>
            </Show>
            <span class="log-count-summary">
              Menampilkan <strong>{filteredLogs().length}</strong> aktivitas
            </span>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Pelaku (User)</th>
                  <th>Aksi</th>
                  <th>Target Objek</th>
                  <th>Rincian Aktivitas</th>
                  <th class="text-right">Waktu</th>
                </tr>
              </thead>
              <tbody>
                <For
                  each={paginatedLogs()}
                  fallback={
                    <tr>
                      <td colSpan="5" class="empty-table-cell">
                        Belum ada aktivitas pada rentang tanggal atau kategori ini.
                      </td>
                    </tr>
                  }
                >
                  {(log) => (
                    <tr>
                      <td>
                        <div class="actor-cell">
                          <div class={`actor-avatar ${log.actorRole === 'SUPER_ADMIN' ? 'super' : ''}`}>
                            {getInitials(log.actorName)}
                          </div>
                          <div class="actor-info">
                            <strong>{log.actorName}</strong>
                            <div class="actor-sub">
                              <span class={`role-pill-sm ${log.actorRole === 'SUPER_ADMIN' ? 'super' : 'admin'}`}>
                                {log.actorRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                              </span>
                              <span>{log.actorEmail}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class={getActionBadgeClass(log.action)}>{log.action}</span>
                      </td>
                      <td>
                        <strong class="log-target-text">{log.target}</strong>
                      </td>
                      <td class="log-details-cell">{log.details}</td>
                      <td class="text-right log-time-cell">{log.timestamp}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>

            {/* PAGINATION LOG AKTIVITAS */}
            <Show when={filteredLogs().length > LOGS_PER_PAGE}>
              <div class="table-pagination-bar">
                <span class="pagination-info">
                  Halaman <strong>{logPage()}</strong> dari <strong>{totalLogPages()}</strong>
                </span>
                <div class="pagination-controls">
                  <button
                    type="button"
                    class="btn-sm-outline"
                    disabled={logPage() <= 1}
                    onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                  >
                    ← Sebelumnya
                  </button>
                  <For each={Array.from({ length: totalLogPages() }, (_, i) => i + 1)}>
                    {(pageNum) => (
                      <button
                        type="button"
                        class={`page-num-btn ${logPage() === pageNum ? 'active' : ''}`}
                        onClick={() => setLogPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    )}
                  </For>
                  <button
                    type="button"
                    class="btn-sm-outline"
                    disabled={logPage() >= totalLogPages()}
                    onClick={() => setLogPage((p) => Math.min(totalLogPages(), p + 1))}
                  >
                    Berikutnya →
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={adminView() === 'team' && isSuperAdmin()}>
          <div class="workspace-header">
            <div>
              <h1 class="page-title">Kelola Tim & Kredensial Akses</h1>
              <p class="page-subtitle">
                Buat akun Admin atau Agent baru secara instan tanpa perlu mereka registrasi mandiri.
              </p>
            </div>
          </div>

          <div class="team-management-grid">
            <div class="team-form-card">
              <div class="card-section-title">
                <div class="bento-icon-box"><SvgIcon.Key /></div>
                <div>
                  <h3>{editingAccountId() ? 'Edit Kredensial Akun' : 'Buat Kredensial Baru'}</h3>
                  <p>
                    {editingAccountId()
                      ? 'Perbarui data nama, email, password, atau level otoritas akun.'
                      : 'Akun yang dibuat bisa langsung login di halaman utama.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateAccount} class="credential-form">
                <div class="input-group">
                  <label>Nama Lengkap Admin / Agent</label>
                  <input
                    type="text"
                    placeholder="Cth: Budi Santoso"
                    value={newAccountForm.name}
                    onInput={(e) => setNewAccountForm('name', e.currentTarget.value)}
                    required
                  />
                </div>

                <div class="input-group">
                  <label>Jabatan / Divisi</label>
                  <input
                    type="text"
                    placeholder="Cth: Senior Marketing Agent"
                    value={newAccountForm.title}
                    onInput={(e) => setNewAccountForm('title', e.currentTarget.value)}
                  />
                </div>

                <div class="input-group">
                  <label>Email Login</label>
                  <input
                    type="email"
                    placeholder="budi@jakurban.com"
                    value={newAccountForm.email}
                    onInput={(e) => setNewAccountForm('email', e.currentTarget.value)}
                    required
                  />
                </div>

                <div class="input-group">
                  <label>Nomor WhatsApp Agent (Untuk URL Referral Unik)</label>
                  <input
                    type="text"
                    placeholder="Cth: 081234567890"
                    value={newAccountForm.phone}
                    onInput={(e) => setNewAccountForm('phone', e.currentTarget.value)}
                    required
                  />
                </div>

                <div class="input-group">
                  <label>Password Login</label>
                  <div class="password-generator-row">
                    <input
                      type="text"
                      placeholder="Masukkan atau generate password"
                      value={newAccountForm.password}
                      onInput={(e) => setNewAccountForm('password', e.currentTarget.value)}
                      required
                    />
                    <button
                      type="button"
                      class="btn-secondary"
                      onClick={generateRandomPassword}
                    >
                      Generate
                    </button>
                  </div>
                </div>

                <div class="input-group">
                  <label>Level Otoritas (Role)</label>
                  <select
                    value={newAccountForm.role}
                    onChange={(e) => setNewAccountForm('role', e.currentTarget.value)}
                  >
                    <option value="ADMIN">ADMIN / AGENT (Kelola Proyek, Unit & Lihat Log)</option>
                    <option value="SUPER_ADMIN">SUPER ADMIN (Akses Penuh + Kelola Tim)</option>
                  </select>
                </div>

                <div class="cred-form-actions">
                  <Show when={editingAccountId()}>
                    <button type="button" class="btn-ghost flex-1" onClick={handleCancelEditAccount}>
                      Batal Edit
                    </button>
                  </Show>
                  <button type="submit" class="btn-primary flex-2">
                    <Show when={editingAccountId()} fallback={<><SvgIcon.Plus /> Aktifkan Kredensial Akun</>}>
                      <SvgIcon.Edit /> Simpan Perubahan
                    </Show>
                  </button>
                </div>
              </form>
            </div>

            <div class="table-container">
              <div class="table-card-header">
                <div>
                  <h3>Daftar Akun Aktif ({(props.accounts || []).length})</h3>
                  <p>Salin kredensial untuk dibagikan langsung kepada tim Anda.</p>
                </div>
              </div>

              <table class="data-table">
                <thead>
                  <tr>
                    <th>Nama & Jabatan</th>
                    <th>Email & Password</th>
                    <th>Otoritas</th>
                    <th class="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={props.accounts || []}>
                    {(acc) => {
                      const isPassShown = () => !!visiblePasswords()[acc.id];
                      const isSelf = () =>
                        acc.email.toLowerCase() === activeUser().email?.toLowerCase();

                      return (
                        <tr>
                          <td>
                            <div class="actor-cell">
                              <div class={`actor-avatar ${acc.role === 'SUPER_ADMIN' ? 'super' : ''}`}>
                                {getInitials(acc.name)}
                              </div>
                              <div class="actor-info">
                                <strong>
                                  {acc.name} {isSelf() ? '(Anda)' : ''}
                                </strong>
                                <span>{acc.title || 'Internal Team'}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div class="cred-box">
                              <div class="cred-email">{acc.email}</div>
                              <div class="cred-pass-row">
                                <code>{isPassShown() ? acc.password : '••••••••'}</code>
                                <button
                                  type="button"
                                  class="icon-Action-tiny"
                                  onClick={() => togglePasswordVisibility(acc.id)}
                                  title={isPassShown() ? 'Sembunyikan' : 'Lihat Password'}
                                >
                                  <Show when={isPassShown()} fallback={<SvgIcon.Eye />}>
                                    <SvgIcon.EyeOff />
                                  </Show>
                                </button>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span class={`role-pill ${acc.role === 'SUPER_ADMIN' ? 'super' : 'admin'}`}>
                              <SvgIcon.Shield />
                              {acc.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : 'ADMIN / AGENT'}
                            </span>
                          </td>
                          <td class="td-actions">
                            <button
                              type="button"
                              class="btn-sm-outline"
                              onClick={() => copyAccountCredentials(acc)}
                              title="Salin Email & Password"
                            >
                              <Show when={copiedId() === acc.id} fallback={<><SvgIcon.Copy /> Salin</>}>
                                <SvgIcon.Check /> Tersalin
                              </Show>
                            </button>
                            <button
                              type="button"
                              class="btn-icon edit"
                              title="Edit Kredensial Akun"
                              onClick={() => handleStartEditAccount(acc)}
                            >
                              <SvgIcon.Edit />
                            </button>
                            <Show when={!isSelf()}>
                              <button
                                type="button"
                                class="btn-icon delete"
                                title="Cabut Akses Akun"
                                onClick={() => handleRemoveAccount(acc)}
                              >
                                <SvgIcon.Trash />
                              </button>
                              <button
                                type="button"
                                class="btn-sm-outline"
                                onClick={() => {
                                  const link = buildAgentReferralUrl(acc);
                                  navigator.clipboard?.writeText(link);
                                  alert(`Link khusus Agent ${acc.name} berhasil disalin:\n${link}\n\nKonsumen yang membuka link ini akan otomatis melihat nomor WA ${formatWaDisplay(acc.phone)} di halaman Property & Unit Detail.`);
                                }}
                                title="Salin URL Katalog Khusus Agent Ini"
                              >
                                🔗 Link URL Agent
                              </button>
                            </Show>
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>
        <Show when={adminView() === 'knowledge' && isSuperAdmin()}>
          <KnowledgeBaseManager addActivityLog={props.addActivityLog} />
        </Show>
      </main>

      <ProjectFormModal
        show={showProjectModal()}
        isEditing={isEditingProject()}
        isSaving={isSaving()}
        projectForm={projectForm}
        setProjectForm={setProjectForm}
        showUnitForm={showUnitForm()}
        setShowUnitForm={setShowUnitForm}
        onClose={closeProjectModal}
        onSubmit={handleSaveProject}
      />
    </div>
  );
}