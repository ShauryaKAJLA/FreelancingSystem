import { Link, useSearchParams } from 'react-router'
import { useGetUsersQuery } from '../adminApi'
import PageHeader from '../../shared/components/layout/PageHeader'
import Select from '../../shared/components/ui/Select'
import Input from '../../shared/components/ui/Input'
import Pagination from '../../shared/components/ui/Pagination'
import { useListParams } from '../../shared/hooks/useListParams'
import Table from '../../shared/components/ui/Table'
import Badge from '../../shared/components/ui/Badge'
import Spinner from '../../shared/components/ui/Spinner'
import ErrorState from '../../shared/components/ui/ErrorState'
import EmptyState from '../../shared/components/ui/EmptyState'
import { formatDate } from '../../shared/utils/format'

export default function UsersListPage() {
  const [searchParams] = useSearchParams()
  const { filters, params, setFilter, setPage } = useListParams({ role: '', status: searchParams.get('status') ?? '', search: '' })
  const { data, isLoading, isFetching, isError } = useGetUsersQuery(params)
  const users = data?.rows

  return (
    <div>
      <PageHeader title="Users" description="All registered accounts across the platform."
                  actions={
                    <div className="flex items-center gap-2">
                      <Input value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Search name or email" aria-label="Search users" className="w-56" />
                      <Select value={filters.role} onChange={(e) => setFilter('role', e.target.value)} className="w-40">
                        <option value="">All roles</option>
                        <option value="Admin">Admin</option>
                        <option value="Client">Client</option>
                        <option value="Freelancer">Freelancer</option>
                      </Select>
                      <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="w-36">
                        <option value="">Status</option>
                        <option value="Active">Active</option>
                        <option value="Flagged">Flagged</option>
                      </Select>
                    </div>
                  } />
      {isLoading && <Spinner />}
      {isError && <ErrorState />}
      {users && (
        <Table
          rowKey="userId"
          rows={users}
          emptyState={<EmptyState title="No users" description="No users match these filters." />}
          columns={[
            { key: 'name', header: 'Name', render: (r) => <Link to={`/admin/users/${r.userId}`} className="font-medium text-indigo-600 hover:underline">{r.name}</Link> },
            { key: 'email', header: 'Email' },
            { key: 'role', header: 'Role' },
            { key: 'createdAt', header: 'Joined', render: (r) => formatDate(r.createdAt) },
            { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
          ]}
        />
      )}
      {data && <Pagination meta={data.meta} onPageChange={setPage} isFetching={isFetching} />}
    </div>
  )
}
