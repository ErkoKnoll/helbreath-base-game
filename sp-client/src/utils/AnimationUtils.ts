/**
 * Calculates the animation duration in milliseconds based on frame count and frame rate.
 *
 * @param frameCount - Number of frames in the animation
 * @param frameRate - Animation frame rate (frames per second)
 * @returns Animation duration in milliseconds
 */
export function calculateAnimationDuration(frameCount: number, frameRate: number): number {
    return (frameCount / frameRate) * 1000;
}

/**
 * Calculates the frame rate (frames per second) needed to play an animation within a given duration.
 * Inverse of calculateAnimationDuration.
 *
 * @param frameCount - Number of frames in the animation
 * @param durationMs - Desired duration in milliseconds
 * @returns Frame rate (frames per second)
 */
export function calculateFrameRateFromDuration(frameCount: number, durationMs: number): number {
    return (frameCount * 1000) / durationMs;
}
