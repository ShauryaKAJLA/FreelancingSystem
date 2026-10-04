import { createBrowserRouter, Navigate } from 'react-router'
import ProtectedRoute from './ProtectedRoute'
import AppShell from '../modules/shared/components/layout/AppShell'
import LandingPage from '../modules/landing/LandingPage'
import LoginPage from '../modules/auth/pages/LoginPage'
import RegisterPage from '../modules/auth/pages/RegisterPage'
import ClientDashboardPage from '../modules/client/pages/ClientDashboardPage'
import JobsListPage from '../modules/client/pages/JobsListPage'
import CreateJobPage from '../modules/client/pages/CreateJobPage'
import EditJobPage from '../modules/client/pages/EditJobPage'
import ClientJobDetailsPage from '../modules/client/pages/JobDetailsPage'
import FreelancersListPage from '../modules/client/pages/FreelancersListPage'
import FreelancerProfileViewPage from '../modules/client/pages/FreelancerProfileViewPage'
import ClientProfilePage from '../modules/client/pages/ClientProfilePage'
import ClientContractsListPage from '../modules/client/pages/ContractsListPage'
import ClientContractDetailsPage from '../modules/client/pages/ContractDetailsPage'
import FreelancerDashboardPage from '../modules/freelancer/pages/FreelancerDashboardPage'
import BrowseJobsPage from '../modules/freelancer/pages/BrowseJobsPage'
import FreelancerJobDetailsPage from '../modules/freelancer/pages/JobDetailsPage'
import MyBidsPage from '../modules/freelancer/pages/MyBidsPage'
import FreelancerContractsListPage from '../modules/freelancer/pages/ContractsListPage'
import FreelancerContractDetailsPage from '../modules/freelancer/pages/ContractDetailsPage'
import FreelancerProfilePage from '../modules/freelancer/pages/ProfilePage'
import ClientPaymentsListPage from '../modules/client/pages/PaymentsListPage'
import ClientPaymentDetailsPage from '../modules/client/pages/PaymentDetailsPage'
import FreelancerPaymentsListPage from '../modules/freelancer/pages/PaymentsListPage'
import FreelancerPaymentDetailsPage from '../modules/freelancer/pages/PaymentDetailsPage'
import AdminDashboardPage from '../modules/admin/pages/AdminDashboardPage'
import UsersListPage from '../modules/admin/pages/UsersListPage'
import UserDetailsPage from '../modules/admin/pages/UserDetailsPage'
import TransactionsPage from '../modules/admin/pages/TransactionsPage'
import AdminPaymentDetailsPage from '../modules/admin/pages/PaymentDetailsPage'
import AdminContractsListPage from '../modules/admin/pages/ContractsPage'
import AdminContractDetailsPage from '../modules/admin/pages/ContractDetailsPage'
import AdminReviewsPage from '../modules/admin/pages/ReviewsPage'
import ReportsPage from '../modules/admin/pages/ReportsPage'
import AdminProfilePage from '../modules/admin/pages/AdminProfilePage'
import AdminOpenJobsPage from '../modules/admin/pages/OpenJobsPage'
import LogsPage from '../modules/admin/pages/LogsPage'
import SkillsPage from '../modules/admin/pages/SkillsPage'
import NotificationsPage from '../modules/shared/notifications/NotificationsPage'
import MessagesPage from '../modules/messaging/pages/MessagesPage'

const clientNav = [
  { to: '/client/dashboard', label: 'Overview', end: true },
  { to: '/client/jobs', label: 'My Jobs' },
  { to: '/client/freelancers', label: 'Find Freelancers' },
  { to: '/client/contracts', label: 'Contracts' },
  { to: '/client/payments', label: 'Payments' },
  { to: '/client/profile', label: 'Profile' },
  { to: '/messages', label: 'Messages', badge: '2' },
]
const freelancerNav = [
  { to: '/freelancer/dashboard', label: 'Overview', end: true },
  { to: '/freelancer/jobs', label: 'Browse Jobs' },
  { to: '/freelancer/bids', label: 'My Bids' },
  { to: '/freelancer/contracts', label: 'Contracts' },
  { to: '/freelancer/payments', label: 'Payments' },
  { to: '/freelancer/profile', label: 'Profile' },
  { to: '/freelancer/messages', label: 'Messages', badge: '2' },
]
const adminNav = [
  { to: '/admin/dashboard', label: 'Overview', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/contracts', label: 'Contracts' },
  { to: '/admin/transactions', label: 'Transactions' },
  { to: '/admin/reviews', label: 'Reviews' },
  { to: '/admin/reports', label: 'Review Conflicts' },
  { to: '/admin/skills', label: 'Skills' },
  { to: '/admin/logs', label: 'System Logs' },
  { to: '/admin/profile', label: 'Profile' },
  { to: '/admin/messages', label: 'Messages', badge: '2' },
]

const shell = (navItems, element) => <AppShell navItems={navItems}>{element}</AppShell>

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: <ProtectedRoute allowedRole="Client" />,
    children: [
      { path: '/messages', element: shell(clientNav, <MessagesPage />) },
      { path: '/client/dashboard', element: shell(clientNav, <ClientDashboardPage />) },
      { path: '/client/jobs', element: shell(clientNav, <JobsListPage />) },
      { path: '/client/jobs/new', element: shell(clientNav, <CreateJobPage />) },
      { path: '/client/jobs/:jobId', element: shell(clientNav, <ClientJobDetailsPage />) },
      { path: '/client/jobs/:jobId/edit', element: shell(clientNav, <EditJobPage />) },
      { path: '/client/freelancers', element: shell(clientNav, <FreelancersListPage />) },
      { path: '/client/freelancers/:freelancerId', element: shell(clientNav, <FreelancerProfileViewPage />) },
      { path: '/client/contracts', element: shell(clientNav, <ClientContractsListPage />) },
      { path: '/client/contracts/:contractId', element: shell(clientNav, <ClientContractDetailsPage />) },
      { path: '/client/payments', element: shell(clientNav, <ClientPaymentsListPage />) },
      { path: '/client/payments/:paymentId', element: shell(clientNav, <ClientPaymentDetailsPage />) },
      { path: '/client/profile', element: shell(clientNav, <ClientProfilePage />) },
      { path: '/client/notifications', element: shell(clientNav, <NotificationsPage />) },
    ],
  },
  {
    element: <ProtectedRoute allowedRole="Freelancer" />,
    children: [
      { path: '/freelancer/dashboard', element: shell(freelancerNav, <FreelancerDashboardPage />) },
      { path: '/freelancer/jobs', element: shell(freelancerNav, <BrowseJobsPage />) },
      { path: '/freelancer/jobs/:jobId', element: shell(freelancerNav, <FreelancerJobDetailsPage />) },
      { path: '/freelancer/bids', element: shell(freelancerNav, <MyBidsPage />) },
      { path: '/freelancer/contracts', element: shell(freelancerNav, <FreelancerContractsListPage />) },
      { path: '/freelancer/contracts/:contractId', element: shell(freelancerNav, <FreelancerContractDetailsPage />) },
      { path: '/freelancer/payments', element: shell(freelancerNav, <FreelancerPaymentsListPage />) },
      { path: '/freelancer/payments/:paymentId', element: shell(freelancerNav, <FreelancerPaymentDetailsPage />) },
      { path: '/freelancer/profile', element: shell(freelancerNav, <FreelancerProfilePage />) },
      { path: '/freelancer/messages', element: shell(freelancerNav, <MessagesPage />) },
      { path: '/freelancer/notifications', element: shell(freelancerNav, <NotificationsPage />) },
    ],
  },
  {
    element: <ProtectedRoute allowedRole="Admin" />,
    children: [
      { path: '/admin/dashboard', element: shell(adminNav, <AdminDashboardPage />) },
      { path: '/admin/jobs', element: shell(adminNav, <AdminOpenJobsPage />) },
      { path: '/admin/users', element: shell(adminNav, <UsersListPage />) },
      { path: '/admin/users/:userId', element: shell(adminNav, <UserDetailsPage />) },
      { path: '/admin/contracts', element: shell(adminNav, <AdminContractsListPage />) },
      { path: '/admin/contracts/:contractId', element: shell(adminNav, <AdminContractDetailsPage />) },
      { path: '/admin/transactions', element: shell(adminNav, <TransactionsPage />) },
      { path: '/admin/payments/:paymentId', element: shell(adminNav, <AdminPaymentDetailsPage />) },
      { path: '/admin/reviews', element: shell(adminNav, <AdminReviewsPage />) },
      { path: '/admin/reports', element: shell(adminNav, <ReportsPage />) },
      { path: '/admin/skills', element: shell(adminNav, <SkillsPage />) },
      { path: '/admin/logs', element: shell(adminNav, <LogsPage />) },
      { path: '/admin/profile', element: shell(adminNav, <AdminProfilePage />) },
      { path: '/admin/messages', element: shell(adminNav, <MessagesPage />) },
      { path: '/admin/notifications', element: shell(adminNav, <NotificationsPage />) },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
])
