import React, { useMemo } from "react";

interface LearningStreakProps {
    streakDays: number;
    activeDays: string[]; // Days that are active in the streak (e.g., ['M', 'T', 'S_0', 'S_6'])
}

export default function LearningStreak({ streakDays, activeDays }: LearningStreakProps) {
    // Get current day in IST
    const getCurrentDayInIST = useMemo(() => {
        // Create a date in IST (UTC+5:30)
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
        const istDate = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
        return istDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    }, []);

    // All days of week for reference
    const allDaysOfWeek = ["S", "M", "T", "W", "T", "F", "S"];
    const allDayIdentifiers = ["S_0", "M", "T", "W", "T", "F", "S_6"];

    // Reorder days to put current day in the middle (4th position)
    const { daysOfWeek, dayToIdentifierMap } = useMemo(() => {
        const currentDayIndex = getCurrentDayInIST;

        // Calculate days before and after to create a balanced view with current day in center
        let reorderedDays = [];
        let reorderedIdentifiers = [];

        // Add 3 days before the current day
        for (let i = 3; i > 0; i--) {
            const index = (currentDayIndex - i + 7) % 7;
            reorderedDays.push(allDaysOfWeek[index]);
            reorderedIdentifiers.push(allDayIdentifiers[index]);
        }

        // Add current day
        reorderedDays.push(allDaysOfWeek[currentDayIndex]);
        reorderedIdentifiers.push(allDayIdentifiers[currentDayIndex]);

        // Add 3 days after the current day
        for (let i = 1; i <= 3; i++) {
            const index = (currentDayIndex + i) % 7;
            reorderedDays.push(allDaysOfWeek[index]);
            reorderedIdentifiers.push(allDayIdentifiers[index]);
        }

        return {
            daysOfWeek: reorderedDays,
            dayToIdentifierMap: reorderedIdentifiers
        };
    }, [getCurrentDayInIST]);

    // List of energizing emojis
    const energizing_emojis = [
        "🚀", "💪", "🔥", "⚡", "🌟", "🏆", "💯", "🎉", "👏", "🌈", "💥", "🎯", "🏅", "✨"
    ];

    // Generate a random emoji from the list if streak is at least 1 day
    const randomEmoji = useMemo(() => {
        if (streakDays >= 1) {
            const randomIndex = Math.floor(Math.random() * energizing_emojis.length);
            return energizing_emojis[randomIndex];
        }
        return null;
    }, [streakDays]);

    // Function to check if a day is active based on index
    const isDayActive = (index: number): boolean => {
        // If the day is in the future (after the current day at index 3), it should never be active
        if (index > 3) {
            return false;
        }

        // Get the identifier for this position
        const identifier = dayToIdentifierMap[index];
        return activeDays.includes(identifier);
    };

    return (
        <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/10 backdrop-blur-sm rounded-xl border border-yellow-800/30 overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/20 px-6 py-4 border-b border-yellow-800/30">
                <div className="flex items-center">
                    <div className="bg-yellow-600/20 p-2 rounded-lg mr-3">
                        <div className="w-5 h-5 text-yellow-400">🔥</div>
                    </div>
                    <h3 className="text-xl font-light text-white">Learning Streak</h3>
                </div>
            </div>

            <div className="p-6">
                <div className="text-center mb-6">
                    <div className="text-4xl font-light mb-2 text-white flex items-center justify-center">
                        <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                            {streakDays}
                        </span>
                        <span className="ml-2 text-white">Day{streakDays === 1 ? "" : "s"}</span>
                        {randomEmoji && <span className="ml-3 text-2xl" role="img" aria-label="Energizing emoji">{randomEmoji}</span>}
                    </div>
                    <p className="text-yellow-400/80 text-sm">Keep the momentum going!</p>
                </div>

                <div className="flex justify-between w-full space-x-2">
                    {daysOfWeek.map((day, index) => (
                        <div
                            key={index}
                            className={`
                                flex-1 h-10 flex items-center justify-center rounded-lg font-medium text-sm transition-all duration-200
                                ${isDayActive(index)
                                    ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-black shadow-lg"
                                    : "bg-gray-800/50 text-gray-400 border border-gray-700"}
                                ${index === 3 ? "ring-2 ring-yellow-500/50 ring-offset-2 ring-offset-gray-900" : ""}
                            `}
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {streakDays > 0 && (
                    <div className="mt-4 text-center">
                        <p className="text-xs text-gray-400">
                            Amazing work! You're building a great learning habit.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
} 