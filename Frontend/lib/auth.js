export function saveToken(token, role) {
  localStorage.setItem("traffic_token", token)
  localStorage.setItem("traffic_role", role)
}

export function clearToken() {
  localStorage.removeItem("traffic_token")
  localStorage.removeItem("traffic_role")
}

export function getToken() {
  return localStorage.getItem("traffic_token")
}

export function getRole() {
  return localStorage.getItem("traffic_role")
}

export function getAuthHeaders() {
  const token = getToken()
  return token ? { Authorization: "Bearer " + token } : {}
}
