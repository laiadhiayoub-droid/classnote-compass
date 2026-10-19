export function onboardingKey(userId: string) { return `has_seen_onboarding:${userId}`; }
export function shouldShowOnboarding(userId: string | undefined, roles: readonly string[] | undefined, named: boolean, seen: boolean) {
  return !!userId && !!roles?.includes("student") && !roles.includes("admin") && named && !seen;
}