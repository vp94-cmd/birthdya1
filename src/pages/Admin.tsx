import AdminPanel from '../components/AdminPanel';

export default function AdminPage() {
  return (
    <div className="min-h-screen">
      <AdminPanel isOpen={true} onClose={() => window.history.back()} />
    </div>
  );
}
