export function getUserRoles(user) {
  if (!user) {
    return []
  }

  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return user.roles
  }

  if (typeof user.role === 'string' && user.role.trim()) {
    return [user.role]
  }

  return []
}

export function hasRole(user, role) {
  return getUserRoles(user).includes(role)
}

export function hasAnyRole(user, roles = []) {
  if (!Array.isArray(roles) || roles.length === 0) {
    return true
  }

  const userRoles = getUserRoles(user)
  return roles.some((role) => userRoles.includes(role))
}

export function getDefaultRoute(user) {
  // IMPORTANT: Keep salesman first.
  // Users can have both roles (admin + salesman), and they must be able to land on
  // /salesman to continue and save salesman progress. Do not switch this precedence.
  if (hasRole(user, 'salesman')) {
    return '/salesman'
  }

  if (hasRole(user, 'admin')) {
    return '/admin/stage1-plan-actual'
  }

  return '/login'
}
