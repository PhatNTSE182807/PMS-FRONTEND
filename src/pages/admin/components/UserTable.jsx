const ROLE_CLASS = {
  Admin: 'role-badge--admin',
  Manager: 'role-badge--manager',
  Staff: 'role-badge--staff',
  User: 'role-badge--user',
};

/**
 * Presentational table of accounts. Columns: Name, Email, Phone, Role.
 * @param {{ users: Array<{id:string,userName?:string,fullName?:string,email?:string,phoneNumber?:string,role?:string}>, loading?: boolean }} props
 */
export default function UserTable({ users, loading = false }) {
  if (loading) {
    return <div className="acc-state" role="status">Loading accounts...</div>;
  }

  if (users.length === 0) {
    return <div className="acc-state">No accounts found.</div>;
  }

  return (
    <div className="acc-table-wrap">
      <table className="acc-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <div className="acc-name">{u.fullName || u.userName}</div>
                {u.fullName && <div className="acc-sub">@{u.userName}</div>}
              </td>
              <td>{u.email}</td>
              <td>{u.phoneNumber}</td>
              <td>
                <span className={`role-badge ${ROLE_CLASS[u.role] || ''}`}>{u.role}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
