import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const ThreeWaypointOrb: React.FC<{ className?: string }> = ({ className = '' }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const size = Math.min(container.clientWidth || 36, container.clientHeight || 36);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
    camera.position.set(0, 0, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Inner Glowing Core (WoW Horde Ruby Core)
    const coreGeo = new THREE.IcosahedronGeometry(0.38, 1);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xdc2626, wireframe: true });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // Outer Gyro Ring 1 (Polished Gold Ring)
    const ring1Geo = new THREE.TorusGeometry(0.65, 0.02, 8, 32);
    const ring1Mat = new THREE.MeshBasicMaterial({ color: 0xf0b232, transparent: true, opacity: 0.9 });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    scene.add(ring1);

    // Outer Gyro Ring 2 (Antique Bronze/Gold Ring)
    const ring2Geo = new THREE.TorusGeometry(0.78, 0.02, 8, 32);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0xc89b3c, transparent: true, opacity: 0.85 });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = Math.PI / 2.5;
    scene.add(ring2);

    let frameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      coreMesh.rotation.x = elapsed * 0.8;
      coreMesh.rotation.y = elapsed * 1.2;

      ring1.rotation.x = elapsed * 1.4;
      ring1.rotation.y = elapsed * 0.6;

      ring2.rotation.y = -elapsed * 1.1;
      ring2.rotation.z = elapsed * 0.8;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      coreGeo.dispose();
      coreMat.dispose();
      ring1Geo.dispose();
      ring1Mat.dispose();
      ring2Geo.dispose();
      ring2Mat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className={`w-9 h-9 shrink-0 flex items-center justify-center ${className}`} />;
};
