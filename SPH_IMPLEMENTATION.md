# SPH-Based Fluid Dynamics Implementation

## Overview

This document describes the Smoothed Particle Hydrodynamics (SPH) implementation added to the bubble simulator to improve the realism of air-water interactions.

## Background

The previous implementation used a simple cellular automata approach with basic neighbor-based forces. While functional, it lacked the physical accuracy of real fluid dynamics. By implementing SPH principles from particle-based fluid simulation research, we now have a more realistic and physically accurate bubble simulation.

## SPH Fundamentals

Smoothed Particle Hydrodynamics (SPH) is a computational method used for simulating fluid flows. It represents the fluid as a collection of particles, where each particle carries physical properties (mass, velocity, density) and interacts with nearby particles through smoothing kernel functions.

### Key Principles

1. **Kernel Functions**: Mathematical functions that define how particles influence each other based on distance
2. **Density Calculation**: Each particle's density is computed from neighboring particles
3. **Pressure Forces**: Derived from density using an equation of state
4. **Viscosity**: Models internal friction within the fluid
5. **Surface Tension**: Acts at interfaces between different materials (air-water boundary)

## Implementation Details

### SPH Parameters

```typescript
const SPH_PARAMS = {
  H: 3.0,                        // Kernel smoothing radius (voxels)
  REST_DENSITY_WATER: 1000.0,    // Water rest density
  REST_DENSITY_AIR: 1.2,         // Air rest density
  GAS_STIFFNESS: 1000.0,         // Pressure stiffness constant
  VISCOSITY_WATER: 0.5,          // Water viscosity coefficient
  VISCOSITY_AIR: 0.01,           // Air viscosity coefficient
  SURFACE_TENSION_COEFF: 0.1,    // Surface tension strength
  GAMMA: 7.0,                    // Tait equation exponent
  PARTICLE_MASS: 1.0             // Mass per particle
};
```

### Kernel Functions

#### 1. Poly6 Kernel (Density Calculation)

Used for density computation. Provides smooth, symmetric influence based on distance.

```typescript
W(r, h) = (315 / (64π h^9)) × (h² - r²)³  for r < h
        = 0                                for r ≥ h
```

#### 2. Spiky Kernel Gradient (Pressure Forces)

Used for pressure force calculations. Designed to prevent particle clustering.

```typescript
∇W(r, h) = (-45 / (π h^6)) × (h - r)² × (r̂ / r)  for r < h
         = 0                                       for r ≥ h
```

#### 3. Viscosity Kernel Laplacian (Viscosity Forces)

Used for viscosity calculations. Provides smooth damping between particles.

```typescript
∇²W(r, h) = (45 / (π h^6)) × (h - r)  for r < h
          = 0                          for r ≥ h
```

### Physics Forces

#### 1. Density Calculation

For each particle i:
```
ρᵢ = Σⱼ mⱼ W(|rᵢ - rⱼ|, h)
```

Where:
- ρᵢ = density at particle i
- mⱼ = mass of neighboring particle j
- W = Poly6 kernel function
- h = smoothing radius

#### 2. Pressure Forces

Using the Tait equation of state:
```
p = k ((ρ/ρ₀)^γ - 1)
```

Pressure force on particle i:
```
Fᵢᵖʳᵉˢˢᵘʳᵉ = -Σⱼ mⱼ ((pᵢ + pⱼ) / (2ρⱼ)) ∇W(|rᵢ - rⱼ|, h)
```

Where:
- k = gas stiffness constant (controls compressibility)
- ρ₀ = rest density
- γ = pressure exponent (typically 7 for water)

#### 3. Viscosity Forces

Models internal friction:
```
Fᵢᵛⁱˢᶜ = μ Σⱼ mⱼ ((vⱼ - vᵢ) / ρⱼ) ∇²W(|rᵢ - rⱼ|, h)
```

Where:
- μ = viscosity coefficient
- vᵢ, vⱼ = velocities of particles i and j

#### 4. Surface Tension

Using the color field method at air-water interfaces:
```
cᵢ = Σⱼ (mⱼ / ρⱼ) × colorⱼ
n̂ᵢ = ∇cᵢ / |∇cᵢ|
κᵢ = -∇²cᵢ / |∇cᵢ|
Fᵢˢᵘʳᶠ = -σ κᵢ n̂ᵢ
```

Where:
- c = color field (0 for water, 1 for air)
- n̂ = surface normal
- κ = curvature
- σ = surface tension coefficient

## Improvements Over Previous Implementation

### Before (Cellular Automata)
- Simple neighbor-based convection forces
- No proper pressure modeling
- Basic surface tension approximation
- Limited physical accuracy

### After (SPH-Based)
- Physics-accurate pressure gradients from Tait equation
- Proper density-based force calculations
- Realistic viscosity modeling
- Surface tension via color field method at interfaces
- Velocity-driven voxel movement based on SPH forces

## Performance Considerations

- **Kernel Radius**: Set to 3.0 voxels for efficient neighbor search
- **Force Scaling**: Applied 0.01 scaling factor for numerical stability
- **Velocity Damping**: 0.9 damping factor prevents instabilities
- **Computational Complexity**: O(n × k) where k is average neighbors within kernel radius

## Visual Effects

The SPH implementation produces:

1. **Realistic Bubble Rising**: Driven by proper buoyancy and pressure forces
2. **Smooth Fluid Motion**: From viscosity calculations
3. **Natural Bubble Coalescence**: Due to surface tension at interfaces
4. **Physically Accurate Separation**: Based on density differences

## Future Enhancements

Possible improvements:
- Adaptive time stepping for better stability
- Spatial hashing for faster neighbor search
- Multi-phase flow with different viscosities
- Temperature-dependent viscosity
- Turbulence modeling

## References

1. Müller, M., Charypar, D., & Gross, M. (2003). "Particle-based fluid simulation for interactive applications." SCA '03.
2. Monaghan, J. J. (1992). "Smoothed particle hydrodynamics." Annual review of astronomy and astrophysics.
3. Morris, J. P. (2000). "Simulating surface tension with smoothed particle hydrodynamics."
4. Clavet, S., Beaudoin, P., & Poulin, P. (2005). "Particle-based viscoelastic fluid simulation."

## Testing

The implementation has been validated through:
- Visual inspection of bubble behavior
- Voxel count conservation (closed system)
- Parameter sweeps for stability
- Comparison with expected fluid dynamics behavior

## Conclusion

The SPH-based implementation significantly improves the physical realism of the bubble simulation while maintaining real-time performance. The use of established fluid dynamics principles from SPH literature ensures accurate and believable bubble-water interactions.
