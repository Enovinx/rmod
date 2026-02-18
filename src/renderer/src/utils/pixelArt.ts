
export function seedFromString(str: string): number {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

// Simple seeded random generator
class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    // Returns number between 0 and 1
    next(): number {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    // Returns integer between min and max (inclusive min, exclusive max)
    nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min)) + min;
    }
}

export function generatePixelPattern(seed: number, colors: string[], width = 16, height = 16): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    const rng = new SeededRandom(seed);

    // Fill background with first color
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, width, height);

    // Draw random pixels
    // We want a symmetric pattern maybe? Or just random noise? 
    // Pixel art style usually implies some structure, but random noise with good colors works well for backgrounds.
    // Let's do a blocky noise pattern.

    const blockSize = 1; // 1 pixel blocks since we'll scale it up via CSS

    for (let x = 0; x < width; x += blockSize) {
        for (let y = 0; y < height; y += blockSize) {
            // Pick a color from the palette based on probability
            // Bias towards the first color (background) to not make it too busy
            const roll = rng.next();
            let colorIndex = 0;

            if (roll > 0.6) {
                colorIndex = rng.nextInt(1, colors.length);
            }

            if (colorIndex > 0) {
                ctx.fillStyle = colors[colorIndex];
                ctx.fillRect(x, y, blockSize, blockSize);
            }
        }
    }

    return canvas.toDataURL();
}

export function getThemeColors(): string[] {
    const style = getComputedStyle(document.documentElement);
    // Get colors that would work well for a pattern
    // Using accent colors and background variations
    const colors = [
        style.getPropertyValue('--bg-tertiary').trim() || '#1e293b',
        style.getPropertyValue('--accent-primary').trim() || '#3b82f6',
        style.getPropertyValue('--accent-secondary').trim() || '#60a5fa',
        style.getPropertyValue('--text-muted').trim() || '#94a3b8'
    ].filter(c => c && c !== 'initial'); // Filter out invalid colors

    return colors;
}
