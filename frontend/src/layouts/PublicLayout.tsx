import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Toaster richColors closeButton position="top-right" />
    </div>
  );
}
