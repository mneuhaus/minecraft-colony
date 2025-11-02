import { Bot } from 'mineflayer';

export interface TimeOfDayInfo {
  time: number; // Minecraft ticks (0-24000)
  time_of_day: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night' | 'midnight';
  is_day: boolean;
  is_night: boolean;
  is_safe_time: boolean; // true during day, false at night (when mobs spawn)
  minecraft_time: string; // Human-readable time (e.g., "07:00", "13:30")
  ticks_until_night: number | null; // null if already night
  ticks_until_day: number | null; // null if already day
}

/**
 * Detect current time of day in Minecraft world
 *
 * Minecraft time system:
 * - 0 ticks = 06:00 (dawn)
 * - 6000 ticks = 12:00 (noon)
 * - 12000 ticks = 18:00 (dusk)
 * - 18000 ticks = 00:00 (midnight)
 * - 24000 ticks = 06:00 (dawn again)
 *
 * Day/night cycle:
 * - Day: 0-12000 ticks (06:00-18:00) - safe, no hostile mobs
 * - Night: 12000-24000 ticks (18:00-06:00) - dangerous, hostile mobs spawn
 *
 * Following "blind bot" principle:
 * - Returns exact tick count
 * - Provides human-readable time
 * - Indicates safety status
 * - Calculates time until day/night transitions
 */
export async function detectTimeOfDay(bot: Bot): Promise<string> {
  // Get current time in ticks (0-24000)
  const time = bot.time.timeOfDay;

  // Determine time of day category
  let timeOfDay: TimeOfDayInfo['time_of_day'];
  if (time < 1000) {
    timeOfDay = 'dawn';
  } else if (time < 5000) {
    timeOfDay = 'morning';
  } else if (time < 7000) {
    timeOfDay = 'noon';
  } else if (time < 11000) {
    timeOfDay = 'afternoon';
  } else if (time < 13000) {
    timeOfDay = 'dusk';
  } else if (time < 17000) {
    timeOfDay = 'night';
  } else {
    timeOfDay = 'midnight';
  }

  // Day vs night (for mob spawning)
  const isDay = time < 12000; // 06:00-18:00

  // Safe time (no hostile mob spawning)
  const isSafeTime = isDay;

  // Convert ticks to Minecraft time (HH:MM format)
  // Minecraft time: 0 ticks = 06:00
  const minecraftHour = Math.floor((time / 1000) + 6) % 24;
  const minecraftMinute = Math.floor(((time % 1000) / 1000) * 60);
  const minecraftTime = `${minecraftHour.toString().padStart(2, '0')}:${minecraftMinute.toString().padStart(2, '0')}`;

  // Calculate time until transitions
  let ticksUntilNight: number | null = null;
  let ticksUntilDay: number | null = null;

  if (isDay) {
    // Currently day, calculate ticks until night (18:00 = 12000 ticks)
    ticksUntilNight = 12000 - time;
  } else {
    // Currently night, calculate ticks until day (06:00 = 24000/0 ticks)
    ticksUntilDay = 24000 - time;
  }

  // Convert ticks to real-time seconds (20 ticks = 1 second)
  const secondsUntilNight = ticksUntilNight !== null ? Math.floor(ticksUntilNight / 20) : null;
  const secondsUntilDay = ticksUntilDay !== null ? Math.floor(ticksUntilDay / 20) : null;

  // Format human-readable durations
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Build response
  const lines = [
    `Current time: ${minecraftTime} (${time} ticks)`,
    `Time of day: ${timeOfDay}`,
    `Day/Night: ${isDay ? 'DAY' : 'NIGHT'}`,
    `Status: ${isSafeTime ? '✓ SAFE (no hostile mobs)' : '✗ DANGEROUS (hostile mobs spawning)'}`,
  ];

  if (ticksUntilNight !== null && secondsUntilNight !== null) {
    lines.push(`Time until night: ${formatDuration(secondsUntilNight)} (${ticksUntilNight} ticks)`);

    // Warning if night is approaching
    if (secondsUntilNight <= 120) { // 2 minutes or less
      lines.push(`⚠️  WARNING: Night approaching! Seek shelter soon.`);
    }
  }

  if (ticksUntilDay !== null && secondsUntilDay !== null) {
    lines.push(`Time until day: ${formatDuration(secondsUntilDay)} (${ticksUntilDay} ticks)`);
  }

  return lines.join('\n');
}
