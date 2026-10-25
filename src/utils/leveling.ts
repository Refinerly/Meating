export const XP_REWARDS = {
  CHECK_IN: 20,
  HABIT_COMPLETED: 10,
  QUEST_COMPLETED: 50,
  MISSION_COMPLETED: 200,
  PROJECT_COMPLETED: 500,
  HEALTH_LOG: 15,
};

export function calculateLevel(totalXp: number): { level: number; currentXp: number; xpForNextLevel: number } {
  let level = 1;
  let xpNeeded = 100;
  let remainingXp = totalXp;
  while (remainingXp >= xpNeeded) { remainingXp -= xpNeeded; level++; xpNeeded = level * 100; }
  return { level, currentXp: remainingXp, xpForNextLevel: xpNeeded };
}
