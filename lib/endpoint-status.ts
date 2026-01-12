/**
 * Utility functions for computing endpoint status based on last seen time
 */

export type EndpointStatus = "online" | "offline" | "disconnected"

/**
 * Compute the actual endpoint status based on when it was last seen
 * 
 * Rules:
 * - Online: Last seen within 5 minutes
 * - Offline: Last seen between 5 minutes and 24 hours ago
 * - Disconnected: Last seen more than 24 hours ago or never seen
 */
export function computeEndpointStatus(lastSeenAt: string | null): EndpointStatus {
  if (!lastSeenAt) {
    return "disconnected"
  }

  const now = new Date()
  const lastSeen = new Date(lastSeenAt)
  const diffMs = now.getTime() - lastSeen.getTime()
  const diffMinutes = diffMs / (1000 * 60)

  // Online if seen in last 5 minutes
  if (diffMinutes <= 5) {
    return "online"
  }

  // Offline if seen between 5 minutes and 24 hours
  if (diffMinutes <= 24 * 60) {
    return "offline"
  }

  // Disconnected if not seen for more than 24 hours
  return "disconnected"
}

/**
 * Add computed status to an endpoint object
 */
export function withComputedStatus<T extends { last_seen_at: string | null; status: string }>(
  endpoint: T
): T & { computed_status: EndpointStatus } {
  return {
    ...endpoint,
    computed_status: computeEndpointStatus(endpoint.last_seen_at),
  }
}

/**
 * Add computed status to an array of endpoints
 */
export function withComputedStatuses<T extends { last_seen_at: string | null; status: string }>(
  endpoints: T[]
): Array<T & { computed_status: EndpointStatus }> {
  return endpoints.map(withComputedStatus)
}
