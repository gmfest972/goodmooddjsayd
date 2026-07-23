import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function ParticleField() {
  const pointsRef = useRef();
  const groupRef = useRef();

  const [positions, colors] = useMemo(() => {
    const count = 1800;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c1 = new THREE.Color("#FF5A1F");
    const c2 = new THREE.Color("#C81E3A");
    for (let i = 0; i < count; i++) {
      // Spherical distribution biased outward
      const r = 3 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      pos[i * 3 + 2] = r * Math.cos(phi);

      const mix = Math.random();
      const c = c1.clone().lerp(c2, mix);
      col[i * 3]     = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return [pos, col];
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current || !groupRef.current) return;
    const t = state.clock.getElapsedTime();
    // gentle constant rotation
    groupRef.current.rotation.y += delta * 0.05;
    groupRef.current.rotation.x = Math.sin(t * 0.15) * 0.15;

    // mouse parallax
    const { x, y } = state.pointer;
    groupRef.current.position.x += (x * 0.6 - groupRef.current.position.x) * 0.05;
    groupRef.current.position.y += (-y * 0.4 - groupRef.current.position.y) * 0.05;

    // pulsating positions on y
    const arr = pointsRef.current.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] += Math.sin(t * 0.5 + i) * 0.0025;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={colors.length / 3}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.045}
          vertexColors
          transparent
          opacity={0.9}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default function Hero3DCanvas() {
  return (
    <div className="absolute inset-0" data-testid="hero-3d-canvas">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 0, 5]} intensity={2} color="#FF5A1F" />
        <ParticleField />
      </Canvas>
    </div>
  );
}
