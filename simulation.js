// Constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PARTICLE_SIZE = 4;
const GRID_WIDTH = Math.floor(CANVAS_WIDTH / PARTICLE_SIZE);
const GRID_HEIGHT = Math.floor(CANVAS_HEIGHT / PARTICLE_SIZE);

// Physics Constants
const PHYSICS_PARAMS = {
    SURFACE_TENSION_FACTOR: 1.5,
    MERGE_DISTANCE: 2,
    ANGLE_OF_REPOSE: 35,
    SAND_FRICTION_MIN: 0.3,
    SAND_FRICTION_MAX: 0.5,
    SAND_MASS_MIN: 1.0,
    SAND_MASS_MAX: 1.5,
    GAP_SIZE: 0.8,
    WATER_DRAG: 0.95,
    BUBBLE_SEARCH_RADIUS: 3,
    BUOYANCY: 0.15,
    SPREAD_FORCE: 0.1,
    COHESION: 0.05,
    MAX_SLOPE_RATIO: 0.7
};

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

// Particle properties storage
class ParticleProperties {
    constructor() {
        this.friction = {};  // For sand particles
        this.mass = {};      // For sand particles
    }
    
    setProperties(x, y, friction, mass) {
        const key = `${x},${y}`;
        this.friction[key] = friction;
        this.mass[key] = mass;
    }
    
    getProperties(x, y) {
        const key = `${x},${y}`;
        return {
            friction: this.friction[key] || 0.4,
            mass: this.mass[key] || 1.2
        };
    }
    
    moveProperties(fromX, fromY, toX, toY) {
        const fromKey = `${fromX},${fromY}`;
        const toKey = `${toX},${toY}`;
        this.friction[toKey] = this.friction[fromKey];
        this.mass[toKey] = this.mass[fromKey];
        delete this.friction[fromKey];
        delete this.mass[fromKey];
    }
    
    deleteProperties(x, y) {
        const key = `${x},${y}`;
        delete this.friction[key];
        delete this.mass[key];
    }
}

// Bubble Cluster Class
class BubbleCluster {
    constructor(id) {
        this.id = id;
        this.cells = new Set(); // Set of "x,y" strings
        this.minX = Infinity;
        this.maxX = -Infinity;
        this.minY = Infinity;
        this.maxY = -Infinity;
    }
    
    addCell(x, y) {
        this.cells.add(`${x},${y}`);
        this.minX = Math.min(this.minX, x);
        this.maxX = Math.max(this.maxX, x);
        this.minY = Math.min(this.minY, y);
        this.maxY = Math.max(this.maxY, y);
    }
    
    getWidth() {
        return this.maxX - this.minX + 1;
    }
    
    getHeight() {
        return this.maxY - this.minY + 1;
    }
    
    getHeightWidthRatio() {
        const width = this.getWidth();
        return width > 0 ? this.getHeight() / width : 0;
    }
    
    getCenterX() {
        return (this.minX + this.maxX) / 2;
    }
    
    getCenterY() {
        return (this.minY + this.maxY) / 2;
    }
    
    size() {
        return this.cells.size;
    }
    
    hasCell(x, y) {
        return this.cells.has(`${x},${y}`);
    }
}

// Bubble Manager Class
class BubbleManager {
    constructor(gridWidth, gridHeight) {
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
        this.clusters = [];
        this.nextClusterId = 0;
    }
    
    findClusters(grid) {
        this.clusters = [];
        const visited = new Set();
        
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (grid[y][x] === PARTICLE_TYPES.AIR && !visited.has(`${x},${y}`)) {
                    const cluster = this.floodFill(grid, x, y, visited);
                    if (cluster.size() > 0) {
                        this.clusters.push(cluster);
                    }
                }
            }
        }
        
        return this.clusters;
    }
    
    floodFill(grid, startX, startY, visited) {
        const cluster = new BubbleCluster(this.nextClusterId++);
        const stack = [[startX, startY]];
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;
            
            if (visited.has(key)) continue;
            if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) continue;
            if (grid[y][x] !== PARTICLE_TYPES.AIR) continue;
            
            visited.add(key);
            cluster.addCell(x, y);
            
            // Check 4-connected neighbors
            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
        }
        
        return cluster;
    }
    
    shouldSplitCluster(cluster) {
        return cluster.getHeightWidthRatio() > PHYSICS_PARAMS.SURFACE_TENSION_FACTOR;
    }
    
    shouldMergeClusters(cluster1, cluster2) {
        const dx = cluster1.getCenterX() - cluster2.getCenterX();
        const dy = cluster1.getCenterY() - cluster2.getCenterY();
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= PHYSICS_PARAMS.MERGE_DISTANCE;
    }
}

// Sand Physics Class
class SandPhysics {
    constructor(gridWidth, gridHeight) {
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
    }
    
    // Find best path for sand particle considering obstacles
    findBestPath(grid, x, y, gravity, particleProps) {
        const nextY = y + gravity;
        
        if (nextY < 0 || nextY >= this.gridHeight) return null;
        
        // Try straight down first
        if (this.canMoveTo(grid, x, nextY)) {
            return { x, y: nextY, type: 'fall' };
        }
        
        // Multi-directional pathfinding - check both diagonals
        const directions = [
            { dx: -1, priority: Math.random() },
            { dx: 1, priority: Math.random() }
        ];
        
        // Sort by priority for randomness
        directions.sort((a, b) => a.priority - b.priority);
        
        for (const dir of directions) {
            const newX = x + dir.dx;
            if (newX >= 0 && newX < this.gridWidth) {
                if (this.canMoveTo(grid, newX, nextY)) {
                    return { x: newX, y: nextY, type: 'diagonal' };
                }
            }
        }
        
        // Search for gaps in bubble barriers
        const gap = this.findGapInBarrier(grid, x, y, nextY);
        if (gap) return gap;
        
        // Check if can slide laterally based on slope
        const lateralMove = this.tryLateralSlide(grid, x, y, particleProps.friction);
        if (lateralMove) return lateralMove;
        
        return null;
    }
    
    canMoveTo(grid, x, y) {
        if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) return false;
        return grid[y][x] === PARTICLE_TYPES.EMPTY;
    }
    
    findGapInBarrier(grid, x, y, targetY) {
        const searchRadius = PHYSICS_PARAMS.BUBBLE_SEARCH_RADIUS;
        
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            if (dx === 0) continue;
            const searchX = x + dx;
            
            if (searchX >= 0 && searchX < this.gridWidth) {
                let hasGap = true;
                
                // Check if there's a clear vertical path
                for (let checkY = y + 1; checkY <= targetY && checkY < this.gridHeight; checkY++) {
                    if (grid[checkY][searchX] !== PARTICLE_TYPES.EMPTY) {
                        hasGap = false;
                        break;
                    }
                }
                
                if (hasGap && this.canMoveTo(grid, searchX, targetY)) {
                    return { x: searchX, y: targetY, type: 'gap' };
                }
            }
        }
        
        return null;
    }
    
    tryLateralSlide(grid, x, y, friction) {
        // Check slope on both sides
        const directions = [
            { dx: -1, priority: Math.random() },
            { dx: 1, priority: Math.random() }
        ];
        
        directions.sort((a, b) => a.priority - b.priority);
        
        for (const dir of directions) {
            const newX = x + dir.dx;
            
            if (newX >= 0 && newX < this.gridWidth) {
                if (this.canMoveTo(grid, newX, y)) {
                    // Check if slope allows sliding (friction based)
                    const slope = this.calculateLocalSlope(grid, newX, y);
                    
                    if (slope < PHYSICS_PARAMS.MAX_SLOPE_RATIO && Math.random() > friction) {
                        return { x: newX, y, type: 'slide' };
                    }
                }
            }
        }
        
        return null;
    }
    
    calculateLocalSlope(grid, x, y) {
        // Check height difference in local area
        let leftHeight = 0;
        let rightHeight = 0;
        
        // Count sand particles below on left side
        for (let dy = 1; dy < 5 && y + dy < this.gridHeight; dy++) {
            if (x - 1 >= 0 && this.isSand(grid[y + dy][x - 1])) {
                leftHeight++;
            } else break;
        }
        
        // Count sand particles below on right side
        for (let dy = 1; dy < 5 && y + dy < this.gridHeight; dy++) {
            if (x + 1 < this.gridWidth && this.isSand(grid[y + dy][x + 1])) {
                rightHeight++;
            } else break;
        }
        
        const heightDiff = Math.abs(leftHeight - rightHeight);
        return heightDiff / 3.0; // Normalize
    }
    
    isSand(particleType) {
        return particleType === PARTICLE_TYPES.SAND_HEAVY ||
               particleType === PARTICLE_TYPES.SAND_MEDIUM ||
               particleType === PARTICLE_TYPES.SAND_LIGHT;
    }
    
    applyWaterDrag(velocity) {
        return velocity * PHYSICS_PARAMS.WATER_DRAG;
    }
}

// Bubble Physics Class
class BubblePhysics {
    constructor(gridWidth, gridHeight) {
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;
    }
    
    applyBuoyancy(grid, x, y, gravity) {
        // Bubbles rise with buoyancy force
        const riseY = y - gravity;
        
        if (riseY >= 0 && riseY < this.gridHeight) {
            const above = grid[riseY][x];
            if (above !== PARTICLE_TYPES.EMPTY && PARTICLE_DENSITY[above] > PARTICLE_DENSITY[PARTICLE_TYPES.AIR]) {
                if (Math.random() < PHYSICS_PARAMS.BUOYANCY) {
                    return { x, y: riseY };
                }
            }
        }
        
        return null;
    }
    
    applySpreadForce(grid, cluster, x, y) {
        // If cluster is too tall, spread horizontally
        if (!cluster || cluster.getHeightWidthRatio() <= PHYSICS_PARAMS.SURFACE_TENSION_FACTOR) {
            return null;
        }
        
        // Spread outward from center
        const centerX = cluster.getCenterX();
        const direction = x < centerX ? -1 : 1;
        const newX = x + direction;
        
        if (newX >= 0 && newX < this.gridWidth) {
            const target = grid[y][newX];
            if (target === PARTICLE_TYPES.EMPTY || PARTICLE_DENSITY[target] > PARTICLE_DENSITY[PARTICLE_TYPES.AIR]) {
                if (Math.random() < PHYSICS_PARAMS.SPREAD_FORCE) {
                    return { x: newX, y };
                }
            }
        }
        
        return null;
    }
    
    maintainGap(grid, x, y) {
        // Ensure minimum spacing between bubbles
        let tooClose = false;
        
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                
                const checkX = x + dx;
                const checkY = y + dy;
                
                if (checkX >= 0 && checkX < this.gridWidth && 
                    checkY >= 0 && checkY < this.gridHeight) {
                    
                    if (grid[checkY][checkX] === PARTICLE_TYPES.AIR) {
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance < PHYSICS_PARAMS.GAP_SIZE) {
                            tooClose = true;
                            break;
                        }
                    }
                }
            }
            if (tooClose) break;
        }
        
        return tooClose;
    }
}

class Simulation {
    constructor() {
        this.canvas = document.getElementById('simulationCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        
        this.grid = [];
        this.gravity = 1; // 1 for down, -1 for up
        
        // Initialize physics systems
        this.particleProps = new ParticleProperties();
        this.bubbleManager = new BubbleManager(GRID_WIDTH, GRID_HEIGHT);
        this.sandPhysics = new SandPhysics(GRID_WIDTH, GRID_HEIGHT);
        this.bubblePhysics = new BubblePhysics(GRID_WIDTH, GRID_HEIGHT);
        this.clusters = [];
        
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
                    const particle = particles[index];
                    this.grid[y][x] = particle;
                    
                    // Initialize sand particle properties
                    if (particle === PARTICLE_TYPES.SAND_HEAVY ||
                        particle === PARTICLE_TYPES.SAND_MEDIUM ||
                        particle === PARTICLE_TYPES.SAND_LIGHT) {
                        const friction = PHYSICS_PARAMS.SAND_FRICTION_MIN + 
                                       Math.random() * (PHYSICS_PARAMS.SAND_FRICTION_MAX - PHYSICS_PARAMS.SAND_FRICTION_MIN);
                        const mass = PHYSICS_PARAMS.SAND_MASS_MIN + 
                                   Math.random() * (PHYSICS_PARAMS.SAND_MASS_MAX - PHYSICS_PARAMS.SAND_MASS_MIN);
                        this.particleProps.setProperties(x, y, friction, mass);
                    }
                    
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
        // Find bubble clusters
        this.clusters = this.bubbleManager.findClusters(this.grid);
        
        const newGrid = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            newGrid[y] = [...this.grid[y]];
        }
        
        // Create cluster map for quick lookup
        const clusterMap = {};
        for (const cluster of this.clusters) {
            for (const cellKey of cluster.cells) {
                clusterMap[cellKey] = cluster;
            }
        }
        
        // Process particles based on gravity direction
        if (this.gravity > 0) {
            // Normal gravity - process bottom to top
            for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
                for (let x = 0; x < GRID_WIDTH; x++) {
                    this.updateParticle(x, y, newGrid, clusterMap);
                }
            }
        } else {
            // Inverted gravity - process top to bottom
            for (let y = 0; y < GRID_HEIGHT; y++) {
                for (let x = 0; x < GRID_WIDTH; x++) {
                    this.updateParticle(x, y, newGrid, clusterMap);
                }
            }
        }
        
        this.grid = newGrid;
    }
    
    updateParticle(x, y, newGrid, clusterMap) {
        const particle = this.grid[y][x];
        
        if (particle === PARTICLE_TYPES.EMPTY) return;
        
        const nextY = y + this.gravity;
        
        // Check boundaries
        if (nextY < 0 || nextY >= GRID_HEIGHT) return;
        
        const below = this.grid[nextY][x];
        const belowDensity = PARTICLE_DENSITY[below];
        const particleDensity = PARTICLE_DENSITY[particle];
        
        // Handle SAND particles with advanced physics
        if (particle === PARTICLE_TYPES.SAND_HEAVY ||
            particle === PARTICLE_TYPES.SAND_MEDIUM ||
            particle === PARTICLE_TYPES.SAND_LIGHT) {
            
            const props = this.particleProps.getProperties(x, y);
            
            // Sand cannot pass through air bubbles - they are solid barriers
            if (below === PARTICLE_TYPES.AIR) {
                // Try to slide laterally off the bubble
                const lateralMove = this.sandPhysics.tryLateralSlide(this.grid, x, y, props.friction);
                if (lateralMove) {
                    newGrid[lateralMove.y][lateralMove.x] = particle;
                    newGrid[y][x] = PARTICLE_TYPES.EMPTY;
                    this.particleProps.moveProperties(x, y, lateralMove.x, lateralMove.y);
                }
                return;
            }
            
            // Try to find best path (multi-directional pathfinding)
            const move = this.sandPhysics.findBestPath(this.grid, x, y, this.gravity, props);
            if (move) {
                const target = this.grid[move.y][move.x];
                newGrid[move.y][move.x] = particle;
                newGrid[y][x] = target;
                this.particleProps.moveProperties(x, y, move.x, move.y);
                return;
            }
        }
        
        // Handle AIR bubbles with advanced physics
        else if (particle === PARTICLE_TYPES.AIR) {
            const cluster = clusterMap[`${x},${y}`];
            
            // Apply buoyancy - bubbles rise
            const buoyancyMove = this.bubblePhysics.applyBuoyancy(this.grid, x, y, this.gravity);
            if (buoyancyMove) {
                const target = this.grid[buoyancyMove.y][buoyancyMove.x];
                newGrid[buoyancyMove.y][buoyancyMove.x] = particle;
                newGrid[y][x] = target;
                return;
            }
            
            // Apply spreading force if cluster is too tall
            const spreadMove = this.bubblePhysics.applySpreadForce(this.grid, cluster, x, y);
            if (spreadMove) {
                const target = this.grid[spreadMove.y][spreadMove.x];
                if (target === PARTICLE_TYPES.EMPTY || PARTICLE_DENSITY[target] > PARTICLE_DENSITY[PARTICLE_TYPES.AIR]) {
                    newGrid[spreadMove.y][spreadMove.x] = particle;
                    newGrid[y][x] = target;
                    return;
                }
            }
            
            // Natural rising for bubbles
            if (belowDensity > particleDensity && below !== PARTICLE_TYPES.AIR) {
                newGrid[nextY][x] = particle;
                newGrid[y][x] = below;
                return;
            }
        }
        
        // Handle WATER particles
        else if (particle === PARTICLE_TYPES.WATER) {
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
                
                // Try diagonal movement
                if (Math.random() > 0.7) {
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
            if (Math.random() > 0.5) {
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
