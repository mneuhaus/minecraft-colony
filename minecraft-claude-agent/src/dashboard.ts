import { startDashboardServer } from './runtime/dashboardServer.js';

const PORT = Number(process.env.DASHBOARD_PORT || 4242);

startDashboardServer(PORT);
