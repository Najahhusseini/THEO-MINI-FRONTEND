// lib/roles.ts
export type UserRole = 'owner' | 'admin' | 'manager' | 'head_housekeeping' | 'head_accounting' | 'head_kitchen' | 'head_bar' | 'head_waiter' | 'reservation_manager' | 'housekeeping' | 'frontdesk' | 'maintenance'

export const roleHierarchy = {
    owner: { level: 5, canManage: ['admin', 'manager', 'head_housekeeping', 'head_accounting', 'head_kitchen', 'head_bar', 'head_waiter', 'reservation_manager'] },
    admin: { level: 4, canManage: ['manager', 'head_housekeeping', 'head_accounting', 'head_kitchen', 'head_bar', 'head_waiter', 'reservation_manager'] },
    manager: { level: 3, canManage: ['head_housekeeping', 'head_accounting', 'head_kitchen', 'head_bar', 'head_waiter', 'reservation_manager'] },
    head_housekeeping: { level: 2, canManage: ['housekeeping'], department: 'housekeeping' },
    head_accounting: { level: 2, canManage: ['accounting'], department: 'accounting' },
    head_kitchen: { level: 2, canManage: ['kitchen'], department: 'kitchen' },
    head_bar: { level: 2, canManage: ['bar'], department: 'bar' },
    head_waiter: { level: 2, canManage: ['waiter'], department: 'waiter' },
    reservation_manager: { level: 2, canManage: ['frontdesk'], department: 'reservations' },
}

export function canManage(userRole: UserRole, targetRole: UserRole): boolean {
    const user = roleHierarchy[userRole]
    if (!user) return false
    return user.canManage?.includes(targetRole) || false
}

export function getDepartmentForRole(role: UserRole): string | null {
    return roleHierarchy[role]?.department || null
}