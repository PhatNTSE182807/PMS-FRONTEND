/** React Query cache keys, grouped by service so invalidation can target one service. */
export const queryKeys = {
  profile: {
    all: ['profile'] as const,
    me: () => [...queryKeys.profile.all, 'me'] as const,
    vehicles: () => [...queryKeys.profile.all, 'vehicles'] as const,
    vehicleTypes: () => [...queryKeys.profile.all, 'vehicle-types'] as const,
  },
}
