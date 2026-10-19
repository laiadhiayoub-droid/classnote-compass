export function canAccessCommunity(userId: string | undefined, banned: boolean | null | undefined): boolean {
  return !!userId && banned === false;
}