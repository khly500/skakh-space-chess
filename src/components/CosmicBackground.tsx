import React, { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, useTexture, OrbitControls } from '@react-three/drei';

const EARTH_TEXTURE_URL = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

/**
 * Camera Parallax Synchronizer
 * Connects the foreground chessboard orbit camera with the background space canvas
 * so user drag and zoom creates a seamless 3D spatial panorama experience!
 */
function CameraParallaxSync() {
  useFrame(({ camera: bgCam }) => {
    const fg = (window as unknown as { __wizardChessCamera?: { x: number; y: number; z: number; targetX: number; targetY: number; targetZ: number } }).__wizardChessCamera;
    if (fg && typeof fg.x === 'number') {
      const dx = fg.x - (fg.targetX || 0);
      const dy = fg.y - (fg.targetY || 0.85);
      const dz = fg.z - (fg.targetZ || -0.15);
      const dist = Math.hypot(dx, dy, dz) || 1;

      // Map foreground camera angles into background space orientation with subtle astronomical parallax
      const targetBgDist = 18.0;
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;

      bgCam.position.set(nx * targetBgDist, ny * targetBgDist * 0.7, nz * targetBgDist);
      bgCam.lookAt(0, 0, -10);
    }
  });

  return null;
}

/**
 * Massive Realistic Earth with High-Res Blue Marble Texture & Axial Rotation
 */
function TexturedEarth() {
  const earthRef = useRef<THREE.Mesh>(null);
  const texture = useTexture(EARTH_TEXTURE_URL);

  useFrame((_, delta) => {
    if (earthRef.current) {
      // Slow, steady axial rotation
      earthRef.current.rotation.y += delta * 0.032;
    }
  });

  return (
    <mesh ref={earthRef} castShadow receiveShadow>
      <sphereGeometry args={[28.0, 64, 64]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.62}
        metalness={0.08}
      />
    </mesh>
  );
}

/**
 * Procedural Fallback Earth in case texture is loading or offline
 */
function FallbackEarth() {
  const earthRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.032;
    }
  });

  return (
    <mesh ref={earthRef}>
      <sphereGeometry args={[28.0, 48, 48]} />
      <meshStandardMaterial
        color="#154678"
        roughness={0.55}
        metalness={0.12}
        emissive="#061b36"
        emissiveIntensity={0.25}
      />
    </mesh>
  );
}

/**
 * Atmospheric Halo & Stratospheric Glow surrounding Earth
 */
function AtmosphereGlow() {
  const atmoRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (atmoRef.current) {
      atmoRef.current.rotation.y += delta * 0.022;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.038;
    }
  });

  return (
    <group>
      {/* Outer Atmospheric Radiant Glow */}
      <mesh ref={atmoRef}>
        <sphereGeometry args={[28.85, 64, 64]} />
        <meshStandardMaterial
          color="#5cc8ff"
          transparent
          opacity={0.20}
          roughness={0.08}
          metalness={0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Subtle cloud drift layer */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[28.2, 48, 48]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Dominant Earth Planetary System (Crust + Atmosphere)
 */
function MassiveEarthSystem() {
  return (
    <group
      position={[2, -16, -32]}
      rotation={[0.41, 0, 0.14]} // Earth's ~23.5 degree axial tilt
    >
      <Suspense fallback={<FallbackEarth />}>
        <TexturedEarth />
      </Suspense>
      <AtmosphereGlow />
    </group>
  );
}

/**
 * The Moon (القمر) with cratered lunar surface & independent orbital float
 */
function MoonBody() {
  const moonRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (moonRef.current) {
      moonRef.current.rotation.y += delta * 0.022;
    }
    if (groupRef.current) {
      // Gentle orbital bobbing in zero-gravity space
      groupRef.current.position.y = 13 + Math.sin(state.clock.elapsedTime * 0.4) * 0.7;
    }
  });

  return (
    <group ref={groupRef} position={[24, 13, -26]}>
      <mesh ref={moonRef} castShadow receiveShadow>
        <sphereGeometry args={[4.4, 48, 48]} />
        <meshStandardMaterial
          color="#cfd5dd"
          roughness={0.90}
          metalness={0.04}
        />
      </mesh>
    </group>
  );
}

/**
 * Mars - The Red Planet (كوكب المريخ) with rust-crimson terrain & orbital motion
 */
function MarsBody() {
  const marsRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (marsRef.current) {
      marsRef.current.rotation.y += delta * 0.028;
    }
    if (groupRef.current) {
      groupRef.current.position.x = -28 + Math.cos(state.clock.elapsedTime * 0.3) * 1.1;
      groupRef.current.position.y = 15 + Math.sin(state.clock.elapsedTime * 0.25) * 0.6;
    }
  });

  return (
    <group ref={groupRef} position={[-28, 15, -38]} rotation={[0.44, 0, 0]}>
      <mesh ref={marsRef}>
        <sphereGeometry args={[5.6, 48, 48]} />
        <meshStandardMaterial
          color="#c1440e"
          roughness={0.82}
          metalness={0.08}
          emissive="#2d0d02"
          emissiveIntensity={0.12}
        />
      </mesh>
    </group>
  );
}

/**
 * Saturn / Ringed Gas Giant (كوكب زحل الحلقي في الأفق البعيد)
 */
function RingedPlanet() {
  const planetRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (planetRef.current) {
      planetRef.current.rotation.y += delta * 0.018;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.012;
    }
  });

  return (
    <group position={[-42, -8, -55]} rotation={[0.48, 0.2, 0.35]}>
      {/* Gas Giant Sphere */}
      <mesh ref={planetRef}>
        <sphereGeometry args={[6.2, 48, 48]} />
        <meshStandardMaterial
          color="#e0b978"
          roughness={0.65}
          metalness={0.1}
          emissive="#2e210a"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Planetary Ring System */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.8, 14.2, 64]} />
        <meshStandardMaterial
          color="#d1b280"
          transparent
          opacity={0.75}
          roughness={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * Living Animated Starfield (تدوير بطيء ومستمر للنجوم)
 */
function LivingStarfield() {
  const starsGroupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (starsGroupRef.current) {
      // Continuous slow rotation makes deep space feel alive and dynamic
      starsGroupRef.current.rotation.y += delta * 0.007;
      starsGroupRef.current.rotation.x += delta * 0.002;
    }
  });

  return (
    <group ref={starsGroupRef}>
      <Stars
        radius={240}
        depth={90}
        count={9800}
        factor={6.8}
        saturation={0.8}
        fade
        speed={1.4}
      />
    </group>
  );
}

/**
 * Deep Space Exploration Canvas
 * Combines:
 * - OrbitControls for flexible interactive exploration
 * - Real-time camera parallax linked to chessboard navigation
 * - Dominant Earth with realistic Blue Marble map & atmospheric glow
 * - The Moon, Mars, and Saturn in independent orbits
 * - Dynamic living starfield motion
 * - Dramatic solar lighting with day/night terminator shadows
 */
export default function CosmicBackground() {
  return (
    <div id="space-stars-bg" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 2, 18], fov: 52, near: 0.1, far: 1000 }}
        style={{ pointerEvents: 'none' }}
        gl={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={['#000000']} />

        {/* OrbitControls for camera control with safe bounds */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.06}
          minDistance={5.0}
          maxDistance={32.0}
          enablePan={false}
        />

        {/* Sync background perspective with chessboard camera */}
        <CameraParallaxSync />

        {/* Powerful Dramatic Sunlight casting cinematic day/night terminator shadows */}
        <directionalLight
          position={[65, 30, 25]}
          intensity={4.8}
          color="#fffcf0"
          castShadow={false}
        />

        {/* Deep space ambient light for realistic dark side contrast */}
        <ambientLight intensity={0.14} color="#051025" />

        {/* Secondary distant cosmic teal rim light */}
        <directionalLight
          position={[-40, -20, -20]}
          intensity={0.65}
          color="#00e5ff"
        />

        {/* Slowly Rotating Living Starfield */}
        <LivingStarfield />

        {/* Majestic Cosmic Bodies in the Background */}
        <MassiveEarthSystem />
        <MoonBody />
        <MarsBody />
        <RingedPlanet />
      </Canvas>
    </div>
  );
}
