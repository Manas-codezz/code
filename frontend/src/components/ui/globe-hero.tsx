"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import React, { useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

interface DotGlobeHeroProps {
  rotationSpeed?: number;
  globeRadius?: number;
  className?: string;
  children?: React.ReactNode;
}

const Globe: React.FC<{
  rotationSpeed: number;
  radius: number;
}> = ({ rotationSpeed, radius }) => {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += rotationSpeed;
      groupRef.current.rotation.x += rotationSpeed * 0.3;
      groupRef.current.rotation.z += rotationSpeed * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshBasicMaterial
          color="#a393bf"
          transparent
          opacity={0.22}
          wireframe
        />
      </mesh>
    </group>
  );
};

const DotGlobeHero = React.forwardRef<
  HTMLDivElement,
  DotGlobeHeroProps
>(({
  rotationSpeed = 0.005,
  globeRadius = 1,
  className,
  children,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "relative w-full min-h-screen bg-canvas text-ink overflow-hidden selection:bg-accent/30 selection:text-white",
        className
      )}
      {...props}
    >
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen">
        {children}
      </div>
      
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Canvas>
          <PerspectiveCamera makeDefault position={[0, 0, 3]} fov={75} />
          <ambientLight intensity={0.7} />
          <pointLight position={[10, 10, 10]} intensity={1.5} color="#a393bf" />
          <pointLight position={[-10, -10, -10]} intensity={0.8} color="#c3dac3" />
          
          <Globe
            rotationSpeed={rotationSpeed}
            radius={globeRadius}
          />
        </Canvas>
      </div>
    </div>
  );
});

DotGlobeHero.displayName = "DotGlobeHero";

export { DotGlobeHero, type DotGlobeHeroProps };
