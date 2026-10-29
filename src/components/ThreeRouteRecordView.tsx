import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoutePoint } from '../types';

interface ThreeRouteRecordViewProps {
  points: RoutePoint[];
  mapId?: number | null;
  className?: string;
}

export const ThreeRouteRecordView: React.FC<ThreeRouteRecordViewProps> = ({
  points,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<RoutePoint[]>(points);
  pointsRef.current = points;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 400;
    let height = container.clientHeight || 120;

    // Detect software WebGL
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // 1. Three.js Scene & Perspective Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0e0a0d, 0.12);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 3.8, 5.8);
    camera.lookAt(0, 0, 0);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 3. 3D Tactical Hologram Radar Platform
    const platformGroup = new THREE.Group();
    scene.add(platformGroup);

    // Ground Grid (WoW Forged Bronze & Obsidian)
    const gridHelper = new THREE.GridHelper(8, 16, 0xc89b3c, 0x3d2716);
    gridHelper.position.y = -0.05;
    platformGroup.add(gridHelper);

    // Concentric Runic Rings
    const ringMat = new THREE.LineBasicMaterial({
      color: 0x785a28,
      transparent: true,
      opacity: 0.65,
    });
    [1.5, 2.8, 3.8].forEach((radius) => {
      const ringGeo = new THREE.BufferGeometry();
      const ringPts: THREE.Vector3[] = [];
      for (let a = 0; a <= 64; a++) {
        const theta = (a / 64) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
      }
      ringGeo.setFromPoints(ringPts);
      const ringLine = new THREE.Line(ringGeo, ringMat);
      platformGroup.add(ringLine);
    });

    // Sweeping Radar Beam Ray (Molten Gold Arcane Ray)
    const radarBeamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.02, 0),
      new THREE.Vector3(3.8, 0.02, 0),
    ]);
    const radarBeamMat = new THREE.LineBasicMaterial({
      color: 0xf0b232,
      transparent: true,
      opacity: 0.85,
    });
    const radarBeam = new THREE.Line(radarBeamGeo, radarBeamMat);
    platformGroup.add(radarBeam);

    // 4. Dynamic 3D Route Line & Nodes (Molten Gold Arcane Route)
    const maxLinePoints = 2000;
    const routePositions = new Float32Array(maxLinePoints * 3);
    const routeGeo = new THREE.BufferGeometry();
    routeGeo.setAttribute('position', new THREE.BufferAttribute(routePositions, 3));
    routeGeo.setDrawRange(0, 0);

    const routeMat = new THREE.LineBasicMaterial({
      color: 0xf0b232,
      linewidth: 2,
    });
    const routeLine = new THREE.Line(routeGeo, routeMat);
    platformGroup.add(routeLine);

    // Outer Glow Line for contrast
    const glowRouteMat = new THREE.LineBasicMaterial({
      color: 0x926e25,
      transparent: true,
      opacity: 0.55,
    });
    const glowRouteLine = new THREE.Line(routeGeo, glowRouteMat);
    glowRouteLine.position.y = 0.01;
    platformGroup.add(glowRouteLine);

    // 5. Current Player Beacon ("Ты здесь" - Horde Ruby & Gold)
    const playerBeaconGroup = new THREE.Group();
    platformGroup.add(playerBeaconGroup);

    // Central Sphere (Ruby Gemstone)
    const beaconSphereGeo = new THREE.SphereGeometry(0.1, 10, 10);
    const beaconSphereMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    const beaconSphere = new THREE.Mesh(beaconSphereGeo, beaconSphereMat);
    beaconSphere.position.y = 0.2;
    playerBeaconGroup.add(beaconSphere);

    // Vertical Holographic Light Shaft (Warm Gold)
    const shaftGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1.2, 0),
    ]);
    const shaftMat = new THREE.LineBasicMaterial({
      color: 0xf5d17f,
      transparent: true,
      opacity: 0.9,
    });
    const shaftLine = new THREE.Line(shaftGeo, shaftMat);
    playerBeaconGroup.add(shaftLine);

    // Crown flare
    const crownGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const crownMesh = new THREE.Mesh(crownGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    crownMesh.position.y = 1.2;
    playerBeaconGroup.add(crownMesh);

    // Ground expanding sonar ring (Ruby pulse)
    const groundSonarGeo = new THREE.RingGeometry(0.05, 0.08, 24);
    groundSonarGeo.rotateX(-Math.PI / 2);
    const groundSonarMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const groundSonarRing = new THREE.Mesh(groundSonarGeo, groundSonarMat);
    groundSonarRing.position.y = 0.02;
    playerBeaconGroup.add(groundSonarRing);

    // 6. Start / Spawn Marker
    const startMarkerGroup = new THREE.Group();
    const startGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const startMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const startMesh = new THREE.Mesh(startGeo, startMat);
    startMesh.position.y = 0.15;
    startMarkerGroup.add(startMesh);
    startMarkerGroup.visible = false;
    platformGroup.add(startMarkerGroup);

    // 7. Ambient Holographic Particles
    const particleCount = 45;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 7;
      pPos[i * 3 + 1] = Math.random() * 2;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 7;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
    });
    const pSystem = new THREE.Points(pGeo, pMat);
    scene.add(pSystem);

    // 8. Mouse interaction for subtle 3D tilt
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetTiltY = nx * 0.4;
      targetTiltX = -ny * 0.25;
    };

    const handlePointerLeave = () => {
      targetTiltX = 0;
      targetTiltY = 0;
    };

    container.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('mouseleave', handlePointerLeave);

    // 9. Continuous 60 FPS Render Loop with Three.js Clock
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();

      // Smooth camera tilt
      currentTiltX += (targetTiltX - currentTiltX) * 0.08;
      currentTiltY += (targetTiltY - currentTiltY) * 0.08;

      const camDist = 5.8;
      const camAngle = currentTiltY + Math.sin(elapsed * 0.2) * 0.08;
      const camHeight = 3.6 + currentTiltX * 2.5 + Math.sin(elapsed * 0.3) * 0.12;

      camera.position.x = Math.sin(camAngle) * camDist;
      camera.position.z = Math.cos(camAngle) * camDist;
      camera.position.y = camHeight;
      camera.lookAt(0, 0.2, 0);

      // Rotate radar sweep beam
      radarBeam.rotation.y = elapsed * 1.8;

      // Pulse Player Sonar Ground Ring
      const sonarScale = 1 + (elapsed * 2.5) % 3.5;
      groundSonarRing.scale.set(sonarScale, sonarScale, sonarScale);
      groundSonarMat.opacity = Math.max(0, 1 - (sonarScale - 1) / 3.5);

      // Player Beacon bobbing
      beaconSphere.position.y = 0.2 + Math.sin(elapsed * 4) * 0.03;

      // Update 3D Route Coordinates from points prop
      const pts = pointsRef.current;
      if (pts && pts.length > 0) {
        // Find bounding box to normalize into [-2.5 .. 2.5] 3D coordinates
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        pts.forEach(([x, y]) => {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        });

        const spanX = Math.max(0.0001, maxX - minX);
        const spanY = Math.max(0.0001, maxY - minY);
        const maxSpan = Math.max(spanX, spanY);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const targetScale = 4.8 / Math.max(maxSpan, 0.05);

        const count = Math.min(pts.length, maxLinePoints);
        const pos = routeGeo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < count; i++) {
          const px = (pts[i][0] - centerX) * targetScale;
          const pz = (pts[i][1] - centerY) * targetScale;
          pos.setXYZ(i, px, 0.04, pz);
        }
        pos.needsUpdate = true;
        routeGeo.setDrawRange(0, count);

        // Position Player Beacon at last point
        const lastIdx = count - 1;
        const lastX = (pts[lastIdx][0] - centerX) * targetScale;
        const lastZ = (pts[lastIdx][1] - centerY) * targetScale;
        playerBeaconGroup.position.set(lastX, 0, lastZ);
        playerBeaconGroup.visible = true;

        // Position Start Marker at first point
        const firstX = (pts[0][0] - centerX) * targetScale;
        const firstZ = (pts[0][1] - centerY) * targetScale;
        startMarkerGroup.position.set(firstX, 0, firstZ);
        startMarkerGroup.visible = count > 2;
      } else {
        routeGeo.setDrawRange(0, 0);
        playerBeaconGroup.position.set(0, 0, 0);
        playerBeaconGroup.visible = true;
        startMarkerGroup.visible = false;
      }

      // Floating data particles upward
      const pAttr = pGeo.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        let py = pAttr.getY(i) + 0.005;
        if (py > 2.2) py = 0;
        pAttr.setY(i, py);
      }
      pAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // 10. Resize Observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 400;
      const h = container.clientHeight || 120;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 11. Resource Disposal
    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('mouseleave', handlePointerLeave);
      resizeObserver.disconnect();

      gridHelper.dispose();
      ringMat.dispose();
      radarBeamGeo.dispose();
      radarBeamMat.dispose();
      routeGeo.dispose();
      routeMat.dispose();
      glowRouteMat.dispose();
      beaconSphereGeo.dispose();
      beaconSphereMat.dispose();
      shaftGeo.dispose();
      shaftMat.dispose();
      crownGeo.dispose();
      groundSonarGeo.dispose();
      groundSonarMat.dispose();
      startGeo.dispose();
      startMat.dispose();
      pGeo.dispose();
      pMat.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full rounded-xl overflow-hidden bg-[#01040a] select-none ${className}`}
    >
      {/* HUD Radar Overlays */}
      <div className="absolute top-1.5 left-2 text-[8.5px] font-mono text-cyan-400/90 font-bold tracking-wider z-10 pointer-events-none flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
        <span>3D ТАКТИЧЕСКИЙ РАДАР</span>
      </div>

      <div className="absolute bottom-1 right-2 text-[8px] font-mono text-cyan-300/60 font-semibold tracking-widest z-10 pointer-events-none">
        {points.length < 2 ? 'ОЖИДАНИЕ КООРДИНАТ...' : `${points.length} ТОЧЕК`}
      </div>
    </div>
  );
};
