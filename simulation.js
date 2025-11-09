// Constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PARTICLE_SIZE = 4;
const GRID_WIDTH = Math.floor(CANVAS_WIDTH / PARTICLE_SIZE);
const GRID_HEIGHT = Math.floor(CANVAS_HEIGHT / PARTICLE_SIZE);

// Particle types
const PARTICLE_TYPES = {
    EMPTY: 0,
    WATER: 1,
    SAND_HEAVY: 2,
    SAND_MEDIUM: 3,
    SAND_LIGHT: 4,
    AIR: 5
};

// Particle colors
const PARTICLE_COLORS = {
    [PARTICLE_TYPES.EMPTY]: '#1a1a2e',
    [PARTICLE_TYPES.WATER]: '#4a90e2',
    [PARTICLE_TYPES.SAND_HEAVY]: '#8b4513',
    [PARTICLE_TYPES.SAND_MEDIUM]: '#a0522d',
    [PARTICLE_TYPES.SAND_LIGHT]: '#daa520',
    [PARTICLE_TYPES.AIR]: '#e0e0e0'
};

// Particle densities (higher = heavier)
const PARTICLE_DENSITY = {
    [PARTICLE_TYPES.EMPTY]: 0,
    [PARTICLE_TYPES.WATER]: 1000,
    [PARTICLE_TYPES.SAND_HEAVY]: 2500,
    [PARTICLE_TYPES.SAND_MEDIUM]: 2200,
    [PARTICLE_TYPES.SAND_LIGHT]: 1900,
    [PARTICLE_TYPES.AIR]: 1
};

class Simulation {
    constructor() {
        this.canvas = document.getElementById('simulationCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        
        this.grid = [];
        this.gravity = 1; // 1 for down, -1 for up
        this.bubbles = []; // Track air bubbles for merging
        
        this.initGrid();
        this.populateGrid();
        
        // Setup flip button
        document.getElementById('flipButton').addEventListener('click', () => this.flip());
        
        // Start animation
        this.animate();
    }
    
    initGrid() {
        this.grid = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            this.grid[y] = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                this.grid[y][x] = PARTICLE_TYPES.EMPTY;
            }
        }
    }
    
    populateGrid() {
        const totalCells = GRID_WIDTH * GRID_HEIGHT;
        const waterCount = Math.floor(totalCells * 0.80);
        const sandCount = Math.floor(totalCells * 0.15);
        const airCount = Math.floor(totalCells * 0.05);
        
        // Distribute sand types (heavy, medium, light)
        const sandHeavyCount = Math.floor(sandCount * 0.4);
        const sandMediumCount = Math.floor(sandCount * 0.35);
        const sandLightCount = sandCount - sandHeavyCount - sandMediumCount;
        
        const particles = [];
        
        // Add water
        for (let i = 0; i < waterCount; i++) {
            particles.push(PARTICLE_TYPES.WATER);
        }
        
        // Add sand of different densities
        for (let i = 0; i < sandHeavyCount; i++) {
            particles.push(PARTICLE_TYPES.SAND_HEAVY);
        }
        for (let i = 0; i < sandMediumCount; i++) {
            particles.push(PARTICLE_TYPES.SAND_MEDIUM);
        }
        for (let i = 0; i < sandLightCount; i++) {
            particles.push(PARTICLE_TYPES.SAND_LIGHT);
        }
        
        // Add air
        for (let i = 0; i < airCount; i++) {
            particles.push(PARTICLE_TYPES.AIR);
        }
        
        // Shuffle and place particles
        this.shuffle(particles);
        
        let index = 0;
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (index < particles.length) {
                    this.grid[y][x] = particles[index];
                    index++;
                }
            }
        }
    }
    
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    flip() {
        this.gravity *= -1;
        
        // Create flip animation effect
        const frame = document.querySelector('.picture-frame');
        frame.style.transform = 'rotateX(180deg)';
        setTimeout(() => {
            frame.style.transform = 'rotateX(0deg)';
        }, 600);
        
        frame.style.transition = 'transform 0.6s ease-in-out';
    }
    
    update() {
        const newGrid = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            newGrid[y] = [...this.grid[y]];
        }
        
        // Process particles based on gravity direction
        if (this.gravity > 0) {
            // Normal gravity - process bottom to top
            for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
                for (let x = 0; x < GRID_WIDTH; x++) {
                    this.updateParticle(x, y, newGrid);
                }
            }
        } else {
            // Inverted gravity - process top to bottom
            for (let y = 0; y < GRID_HEIGHT; y++) {
                for (let x = 0; x < GRID_WIDTH; x++) {
                    this.updateParticle(x, y, newGrid);
                }
            }
        }
        
        this.grid = newGrid;
        this.mergeBubbles();
    }
    
    updateParticle(x, y, newGrid) {
        const particle = this.grid[y][x];
        
        if (particle === PARTICLE_TYPES.EMPTY) return;
        
        const nextY = y + this.gravity;
        
        // Check boundaries
        if (nextY < 0 || nextY >= GRID_HEIGHT) return;
        
        const below = this.grid[nextY][x];
        const belowDensity = PARTICLE_DENSITY[below];
        const particleDensity = PARTICLE_DENSITY[particle];
        
        // Particle should sink/rise based on density difference
        const shouldMove = (this.gravity > 0 && particleDensity > belowDensity) ||
                          (this.gravity < 0 && particleDensity < belowDensity);
        
        if (shouldMove) {
            // Try to move straight down/up
            if (below === PARTICLE_TYPES.EMPTY || belowDensity < particleDensity) {
                newGrid[nextY][x] = particle;
                newGrid[y][x] = below;
                return;
            }
            
            // Try diagonal movement for liquids and sand
            if (particle !== PARTICLE_TYPES.AIR || Math.random() > 0.7) {
                const direction = Math.random() < 0.5 ? -1 : 1;
                const diagX = x + direction;
                
                if (diagX >= 0 && diagX < GRID_WIDTH) {
                    const diag = this.grid[nextY][diagX];
                    const diagDensity = PARTICLE_DENSITY[diag];
                    
                    if (diag === PARTICLE_TYPES.EMPTY || diagDensity < particleDensity) {
                        newGrid[nextY][diagX] = particle;
                        newGrid[y][x] = PARTICLE_TYPES.EMPTY;
                        return;
                    }
                }
            }
        }
        
        // Water spreads horizontally
        if (particle === PARTICLE_TYPES.WATER && Math.random() > 0.5) {
            const direction = Math.random() < 0.5 ? -1 : 1;
            const sideX = x + direction;
            
            if (sideX >= 0 && sideX < GRID_WIDTH) {
                const side = this.grid[y][sideX];
                if (side === PARTICLE_TYPES.EMPTY) {
                    newGrid[y][sideX] = particle;
                    newGrid[y][x] = PARTICLE_TYPES.EMPTY;
                }
            }
        }
        
        // Air bubbles rise and move randomly
        if (particle === PARTICLE_TYPES.AIR) {
            // Try to rise/sink based on gravity
            if (belowDensity > particleDensity) {
                newGrid[nextY][x] = particle;
                newGrid[y][x] = below;
                return;
            }
            
            // Random horizontal movement for bubbles
            if (Math.random() > 0.6) {
                const direction = Math.random() < 0.5 ? -1 : 1;
                const sideX = x + direction;
                
                if (sideX >= 0 && sideX < GRID_WIDTH) {
                    const side = this.grid[y][sideX];
                    if (side === PARTICLE_TYPES.EMPTY || PARTICLE_DENSITY[side] > particleDensity) {
                        newGrid[y][sideX] = particle;
                        newGrid[y][x] = side;
                    }
                }
            }
        }
    }
    
    mergeBubbles() {
        // Detect and merge adjacent air bubbles
        for (let y = 0; y < GRID_HEIGHT - 1; y++) {
            for (let x = 0; x < GRID_WIDTH - 1; x++) {
                if (this.grid[y][x] === PARTICLE_TYPES.AIR) {
                    // Check if adjacent cells also have air
                    const right = this.grid[y][x + 1];
                    const down = this.grid[y + 1][x];
                    
                    // Surface tension - bubbles attract each other with some probability
                    if (right !== PARTICLE_TYPES.AIR && right !== PARTICLE_TYPES.EMPTY && Math.random() > 0.95) {
                        // Look for nearby air to merge
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                const ny = y + dy;
                                const nx = x + dx;
                                if (ny >= 0 && ny < GRID_HEIGHT && nx >= 0 && nx < GRID_WIDTH) {
                                    if (this.grid[ny][nx] === PARTICLE_TYPES.AIR && (dx !== 0 || dy !== 0)) {
                                        // Pull bubbles together
                                        if (Math.random() > 0.5) {
                                            const tempY = Math.floor((y + ny) / 2);
                                            const tempX = Math.floor((x + nx) / 2);
                                            if (this.grid[tempY][tempX] !== PARTICLE_TYPES.AIR) {
                                                const temp = this.grid[tempY][tempX];
                                                this.grid[tempY][tempX] = PARTICLE_TYPES.AIR;
                                                this.grid[y][x] = temp;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = PARTICLE_COLORS[PARTICLE_TYPES.EMPTY];
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Draw particles
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const particle = this.grid[y][x];
                if (particle !== PARTICLE_TYPES.EMPTY) {
                    this.ctx.fillStyle = PARTICLE_COLORS[particle];
                    
                    // Add slight transparency to water for realism
                    if (particle === PARTICLE_TYPES.WATER) {
                        this.ctx.globalAlpha = 0.85;
                    } else {
                        this.ctx.globalAlpha = 1.0;
                    }
                    
                    // Draw particle
                    const px = x * PARTICLE_SIZE;
                    const py = y * PARTICLE_SIZE;
                    
                    // Make air bubbles circular
                    if (particle === PARTICLE_TYPES.AIR) {
                        this.ctx.beginPath();
                        this.ctx.arc(px + PARTICLE_SIZE / 2, py + PARTICLE_SIZE / 2, PARTICLE_SIZE / 2, 0, Math.PI * 2);
                        this.ctx.fill();
                    } else {
                        this.ctx.fillRect(px, py, PARTICLE_SIZE, PARTICLE_SIZE);
                    }
                }
            }
        }
        
        this.ctx.globalAlpha = 1.0;
    }
    
    animate() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize simulation when page loads
window.addEventListener('load', () => {
    new Simulation();
});
