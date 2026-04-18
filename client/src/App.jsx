import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

// Layouts
import AdminLayout   from './layouts/AdminLayout.jsx';
import CashierLayout from './layouts/CashierLayout.jsx';

// Pages
import Login             from './pages/Login.jsx';
import Dashboard         from './pages/admin/Dashboard.jsx';
import Products          from './pages/admin/Products.jsx';
import StockIn           from './pages/admin/StockIn.jsx';
import SalesLog          from './pages/admin/SalesLog.jsx';
import SalesReport       from './pages/admin/SalesReport.jsx';
import InventoryReport   from './pages/admin/InventoryReport.jsx';
import Settings          from './pages/admin/Settings.jsx';
import UserManagement    from './pages/admin/UserManagement.jsx';
import RecycleBin        from './pages/admin/RecycleBin.jsx';
import POS               from './pages/cashier/POS.jsx';
import DailySummary      from './pages/cashier/DailySummary.jsx';
import CashierSalesLog   from './pages/cashier/CashierSalesLog.jsx';

function RequireAuth({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/pos'} replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/pos'} replace /> : <Login />} />

      {/* Admin routes */}
      <Route path="/admin" element={<RequireAuth role="admin"><AdminLayout /></RequireAuth>}>
        <Route index         element={<Dashboard />} />
        <Route path="products"  element={<Products />} />
        <Route path="stock"     element={<StockIn />} />
        <Route path="sales"     element={<SalesLog />} />
        <Route path="reports/sales"      element={<SalesReport />} />
        <Route path="reports/inventory"  element={<InventoryReport />} />
        <Route path="settings"  element={<Settings />} />
        <Route path="users"       element={<UserManagement />} />
        <Route path="recycle-bin" element={<RecycleBin />} />
      </Route>

      {/* Cashier routes */}
      <Route path="/pos" element={<RequireAuth role="cashier"><CashierLayout /></RequireAuth>}>
        <Route index       element={<POS />} />
        <Route path="summary" element={<DailySummary />} />
        <Route path="sales-log" element={<CashierSalesLog />} />
      </Route>

      {/* Default redirect */}
      <Route path="*" element={
        user
          ? <Navigate to={user.role === 'admin' ? '/admin' : '/pos'} replace />
          : <Navigate to="/login" replace />
      } />
    </Routes>
  );
}
