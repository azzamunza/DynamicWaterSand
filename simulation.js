// Constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PARTICLE_SIZE = 4;
const GRID_WIDTH = Math.floor(CANVAS_WIDTH / PARTICLE_SIZE);
const GRID_HEIGHT = Math.floor(CANVAS_HEIGHT / PARTICLE_SIZE);

// Physics Constants
const PHYSICS_PARAMS = {
    SURFACE_TENSION_FACTOR: 2.0,  // Increased to allow taller clusters before splitting
    MERGE_DISTANCE: 3,  // Increased merge distance for better clustering
    ANGLE_OF_REPOSE: 35,
    SAND_FRICTION_MIN: 0.3,
    SAND_FRICTION_MAX: 0.5,
    SAND_MASS_MIN: 1.0,
    SAND_MASS_MAX: 1.5,
    GAP_SIZE: 0.8,
    WATER_DRAG: 0.95,
    BUBBLE_SEARCH_RADIUS: 3,
    BUOYANCY: 0.25,  // Increased for faster bubble rising
    SPREAD_FORCE: 0.2,  // Increased for better horizontal spreading
    COHESION: 0.1,  // Increased cohesion
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
        const gaps = [];
        
        // Look for gaps in both directions
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            if (dx === 0) continue;
            const searchX = x + dx;
            
            if (searchX >= 0 && searchX < this.gridWidth) {
                let gapQuality = 0;
                let hasPath = true;
                
                // Check if there's a clear vertical path and count empty cells
                for (let checkY = y + 1; checkY <= Math.min(y + 3, this.gridHeight - 1); checkY++) {
                    const cell = grid[checkY][searchX];
                    if (cell === PARTICLE_TYPES.EMPTY) {
                        gapQuality++;
                    } else if (cell === PARTICLE_TYPES.AIR) {
                        hasPath = false;
                        break;
                    } else if (this.isSand(cell)) {
                        hasPath = false;
                        break;
                    }
                }
                
                if (hasPath && gapQuality > 0) {
                    gaps.push({ x: searchX, quality: gapQuality, distance: Math.abs(dx) });
                }
            }
        }
        
        if (gaps.length > 0) {
            // Sort by quality (more empty cells = better gap) then by distance
            gaps.sort((a, b) => b.quality - a.quality || a.distance - b.distance);
            const bestGap = gaps[0];
            return { x: bestGap.x, y: targetY, type: 'gap' };
        }
        
        return null;
    }
    
    tryLateralSlide(grid, x, y, friction) {
        // Check slope on both sides - prefer downslope direction
        const leftHeight = this.getHeightBelow(grid, x - 1, y);
        const rightHeight = this.getHeightBelow(grid, x + 1, y);
        
        const directions = [];
        
        // Prefer the side with less sand (lower height)
        if (leftHeight < rightHeight) {
            directions.push({ dx: -1, priority: 1 });
            directions.push({ dx: 1, priority: 2 });
        } else {
            directions.push({ dx: 1, priority: 1 });
            directions.push({ dx: -1, priority: 2 });
        }
        
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
    
    getHeightBelow(grid, x, y) {
        if (x < 0 || x >= this.gridWidth) return 1000;  // Treat boundaries as very tall
        
        let height = 0;
        for (let dy = 1; dy < 10 && y + dy < this.gridHeight; dy++) {
            if (this.isSand(grid[y + dy][x])) {
                height++;
            } else if (grid[y + dy][x] === PARTICLE_TYPES.AIR) {
                // Air blocks count as barriers
                height += 5;
            } else {
                break;
            }
        }
        return height;
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
    
    applyAttraction(grid, x, y) {
        // Find nearby bubbles and move towards them for clustering
        let nearestBubble = null;
        let minDistance = Infinity;
        
        const searchRadius = 3;
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                const checkX = x + dx;
                const checkY = y + dy;
                
                if (checkX >= 0 && checkX < this.gridWidth && 
                    checkY >= 0 && checkY < this.gridHeight) {
                    
                    if (grid[checkY][checkX] === PARTICLE_TYPES.AIR) {
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance > 1.5 && distance < minDistance) {
                            minDistance = distance;
                            nearestBubble = { dx, dy };
                        }
                    }
                }
            }
        }
        
        if (nearestBubble && Math.random() < PHYSICS_PARAMS.COHESION) {
            // Move one step towards the nearest bubble
            const moveX = nearestBubble.dx > 0 ? 1 : (nearestBubble.dx < 0 ? -1 : 0);
            const moveY = nearestBubble.dy > 0 ? 1 : (nearestBubble.dy < 0 ? -1 : 0);
            
            // Prefer horizontal movement for spreading
            const newX = x + (Math.random() < 0.7 ? moveX : 0);
            const newY = y + (Math.random() < 0.3 ? moveY : 0);
            
            if (newX >= 0 && newX < this.gridWidth && 
                newY >= 0 && newY < this.gridHeight &&
                (newX !== x || newY !== y)) {
                return { x: newX, y: newY };
            }
        }
        
        return null;
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
        // Initialize entire grid with water
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                this.grid[y][x] = PARTICLE_TYPES.WATER;
            }
        }
        
        // Create 20% sand layer at the top
        const sandLayerHeight = Math.floor(GRID_HEIGHT * 0.20);
        
        // Distribute sand types (heavy, medium, light)
        const sandTypes = [
            PARTICLE_TYPES.SAND_HEAVY,
            PARTICLE_TYPES.SAND_MEDIUM,
            PARTICLE_TYPES.SAND_LIGHT
        ];
        
        // Fill top 20% with sand of varied densities
        for (let y = 0; y < sandLayerHeight; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                // Random sand type distribution
                const rand = Math.random();
                let sandType;
                if (rand < 0.4) {
                    sandType = PARTICLE_TYPES.SAND_HEAVY;
                } else if (rand < 0.75) {
                    sandType = PARTICLE_TYPES.SAND_MEDIUM;
                } else {
                    sandType = PARTICLE_TYPES.SAND_LIGHT;
                }
                
                this.grid[y][x] = sandType;
                
                // Initialize sand particle properties with varied friction and mass
                const friction = PHYSICS_PARAMS.SAND_FRICTION_MIN + 
                               Math.random() * (PHYSICS_PARAMS.SAND_FRICTION_MAX - PHYSICS_PARAMS.SAND_FRICTION_MIN);
                const mass = PHYSICS_PARAMS.SAND_MASS_MIN + 
                           Math.random() * (PHYSICS_PARAMS.SAND_MASS_MAX - PHYSICS_PARAMS.SAND_MASS_MIN);
                this.particleProps.setProperties(x, y, friction, mass);
            }
        }
        
        // Create bubble layer just below sand (at least 3 voxels high)
        const bubbleLayerStart = sandLayerHeight;
        const bubbleLayerHeight = Math.max(5, Math.floor(GRID_HEIGHT * 0.05)); // At least 5 voxels
        
        // Create multiple bubbles with tapered ends
        const numBubbles = Math.floor(GRID_WIDTH / 15); // Create several bubbles across the width
        const bubbleSpacing = Math.floor(GRID_WIDTH / (numBubbles + 1));
        
        for (let i = 0; i < numBubbles; i++) {
            const bubbleCenterX = bubbleSpacing * (i + 1);
            const bubbleCenterY = bubbleLayerStart + Math.floor(bubbleLayerHeight / 2);
            const bubbleWidth = 8 + Math.floor(Math.random() * 5); // 8-12 voxels wide
            const bubbleHeight = Math.max(3, bubbleLayerHeight - 2); // At least 3 voxels
            
            // Create bubble with tapered ends (elliptical shape)
            for (let dy = 0; dy < bubbleHeight; dy++) {
                const y = bubbleCenterY - Math.floor(bubbleHeight / 2) + dy;
                if (y < 0 || y >= GRID_HEIGHT) continue;
                
                // Calculate width at this height (tapered at top and bottom)
                const heightRatio = Math.abs(dy - bubbleHeight / 2) / (bubbleHeight / 2);
                const widthAtHeight = bubbleWidth * (1 - heightRatio * 0.3); // 30% taper
                
                for (let dx = -Math.floor(widthAtHeight / 2); dx <= Math.floor(widthAtHeight / 2); dx++) {
                    const x = bubbleCenterX + dx;
                    if (x >= 0 && x < GRID_WIDTH) {
                        this.grid[y][x] = PARTICLE_TYPES.AIR;
                    }
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
            
            // If sitting on sand, try to spread out for dune formation
            if (this.sandPhysics.isSand(below)) {
                const spreadMove = this.sandPhysics.tryLateralSlide(this.grid, x, y, props.friction * 0.5);
                if (spreadMove) {
                    newGrid[spreadMove.y][spreadMove.x] = particle;
                    newGrid[y][x] = PARTICLE_TYPES.EMPTY;
                    this.particleProps.moveProperties(x, y, spreadMove.x, spreadMove.y);
                    return;
                }
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
            
            // Bubble attraction - move towards nearby bubbles for clustering
            const attractionMove = this.bubblePhysics.applyAttraction(this.grid, x, y);
            if (attractionMove) {
                const target = this.grid[attractionMove.y][attractionMove.x];
                if (target === PARTICLE_TYPES.EMPTY || PARTICLE_DENSITY[target] > PARTICLE_DENSITY[PARTICLE_TYPES.AIR]) {
                    newGrid[attractionMove.y][attractionMove.x] = particle;
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
        
        // Draw non-bubble particles first
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const particle = this.grid[y][x];
                if (particle !== PARTICLE_TYPES.EMPTY && particle !== PARTICLE_TYPES.AIR) {
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
                    this.ctx.fillRect(px, py, PARTICLE_SIZE, PARTICLE_SIZE);
                }
            }
        }
        
        this.ctx.globalAlpha = 1.0;
        
        // Draw bubble clusters with outlines
        this.renderBubbleClusters();
    }
    
    renderBubbleClusters() {
        // Find all bubble clusters
        const clusters = this.bubbleManager.findClusters(this.grid);
        
        // Draw each cluster with outline
        for (const cluster of clusters) {
            // Skip very small clusters (single cells)
            if (cluster.size() < 2) continue;
            
            // Fill the bubble cluster interior
            this.ctx.fillStyle = PARTICLE_COLORS[PARTICLE_TYPES.AIR];
            this.ctx.globalAlpha = 0.75;
            
            for (const cellKey of cluster.cells) {
                const [x, y] = cellKey.split(',').map(Number);
                const px = x * PARTICLE_SIZE;
                const py = y * PARTICLE_SIZE;
                this.ctx.fillRect(px, py, PARTICLE_SIZE, PARTICLE_SIZE);
            }
            
            // Draw outline around cluster
            this.ctx.globalAlpha = 1.0;
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1.5;
            
            // Draw edges of the cluster
            for (const cellKey of cluster.cells) {
                const [x, y] = cellKey.split(',').map(Number);
                const px = x * PARTICLE_SIZE;
                const py = y * PARTICLE_SIZE;
                
                // Check each side and draw border if adjacent to non-bubble
                // Top
                if (y === 0 || this.grid[y - 1][x] !== PARTICLE_TYPES.AIR) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(px, py);
                    this.ctx.lineTo(px + PARTICLE_SIZE, py);
                    this.ctx.stroke();
                }
                // Bottom
                if (y === GRID_HEIGHT - 1 || this.grid[y + 1][x] !== PARTICLE_TYPES.AIR) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(px, py + PARTICLE_SIZE);
                    this.ctx.lineTo(px + PARTICLE_SIZE, py + PARTICLE_SIZE);
                    this.ctx.stroke();
                }
                // Left
                if (x === 0 || this.grid[y][x - 1] !== PARTICLE_TYPES.AIR) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(px, py);
                    this.ctx.lineTo(px, py + PARTICLE_SIZE);
                    this.ctx.stroke();
                }
                // Right
                if (x === GRID_WIDTH - 1 || this.grid[y][x + 1] !== PARTICLE_TYPES.AIR) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(px + PARTICLE_SIZE, py);
                    this.ctx.lineTo(px + PARTICLE_SIZE, py + PARTICLE_SIZE);
                    this.ctx.stroke();
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
