import { Navigate, Route, Routes } from 'react-router-dom';
import { FileBadge, GraduationCap, House, Settings, User, Users } from 'lucide-react';
import { DashboardShell, type ShellLink } from '../components/layout/DashboardShell';
import { AdminDashboard } from '../pages/admin/Dashboard';
import { AdminUsers } from '../pages/admin/Users';
import { AdminProfile } from '../pages/admin/Profile';
import { AdminSettings } from '../pages/admin/Settings';
import { UserDashboard } from '../pages/user/Dashboard';
import { UserProfile } from '../pages/user/Profile';
import { UserCertificates } from '../pages/user/Collections';
import { CoursesPage } from '../pages/user/Courses';
import { CourseNewPage } from '../pages/user/CourseNew';
import { CourseDetailPage } from '../pages/user/CourseDetail';
import { UserSettings } from '../pages/user/Settings';

const adminLinks: ShellLink[] = [
  { to: '/admin', label: 'Dashboard', icon: House },
  { to: '/admin/utilizadores', label: 'Utilizadores', icon: Users },
  { to: '/admin/perfil', label: 'Perfil', icon: User },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
];

const userLinks: ShellLink[] = [
  { to: '/app', label: 'Dashboard', icon: House },
  { to: '/app/cursos', label: 'Cursos', icon: GraduationCap },
  { to: '/app/certificados', label: 'Certificados', icon: FileBadge },
  { to: '/app/perfil', label: 'Perfil', icon: User },
  { to: '/app/definicoes', label: 'Definições', icon: Settings },
];


export function AdminRoutes() {
  return (
    <DashboardShell title="Administração" links={adminLinks} accountLinks={adminLinks.slice(2)} search="admin">
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="utilizadores" element={<AdminUsers />} />
        <Route path="perfil" element={<AdminProfile />} />
        <Route path="configuracoes" element={<AdminSettings />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </DashboardShell>
  );
}

export function UserRoutes() {
  return (
    <DashboardShell title="Meu painel" links={userLinks} accountLinks={userLinks.slice(3)} search="user">
      <Routes>
        <Route index element={<UserDashboard />} />
        <Route path="cursos" element={<CoursesPage />} />
        <Route path="cursos/novo" element={<CourseNewPage />} />
        <Route path="cursos/:id" element={<CourseDetailPage />} />
        <Route path="formacoes" element={<Navigate to="/app/cursos" replace />} />
        <Route path="certificados" element={<UserCertificates />} />
        <Route path="perfil" element={<UserProfile />} />
        <Route path="definicoes" element={<UserSettings />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </DashboardShell>
  );
}
