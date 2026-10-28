import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeTerrainSceneProps {
  progress: number; // 0 to 1
  stageName: string;
  className?: string;
}

export const ThreeTerrainScene: React.FC<ThreeTerrainSceneProps> = ({
  progress,
  stageName,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 360;
    let height = container.clientHeight || 105;

    // Detect software WebGL to balance rendering features
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

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02050e, 0.08);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 4.2, 7.8);
    camera.lookAt(0, 0.4, 0);

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

    // 3. Procedural 3D Undulating Wireframe Terrain
    const terrainCols = 32;
    const terrainRows = 24;
    const planeGeo = new THREE.PlaneGeometry(16, 12, terrainCols, terrainRows);
    planeGeo.rotateX(-Math.PI / 2);

    const posAttr = planeGeo.attributes.position;
    const originalHeights = new Float32Array(posAttr.count);

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);

      // Procedural terrain elevation: rolling hills with valley in center
      const distFromCenter = Math.sqrt(vx * vx + vz * vz);
      const hill1 = Math.sin(vx * 0.7) * Math.cos(vz * 0.6) * 0.45;
      const hill2 = Math.sin(vx * 1.4 + 1.2) * 0.2;
      const valley = Math.exp(-distFromCenter * 0.4) * -0.3;
      const heightVal = hill1 + hill2 + valley;

      posAttr.setY(i, heightVal);
      originalHeights[i] = heightVal;
    }
    planeGeo.computeVertexNormals();

    const terrainWireGeo = new THREE.WireframeGeometry(planeGeo);
    const terrainWireMat = new THREE.LineBasicMaterial({
      color: 0x0a3b54,
      transparent: true,
      opacity: 0.85,
    });
    const terrainMesh = new THREE.LineSegments(terrainWireGeo, terrainWireMat);
    terrainMesh.position.y = -0.6;
    scene.add(terrainMesh);

    // 4. Hero 3D Wireframe Spruce Tree (Group of stacked wireframe cones & trunk)
    const treeGroup = new THREE.Group();
    treeGroup.position.set(-0.8, -0.6, 0.2);

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.7, 8);
    const trunkWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(trunkGeo),
      new THREE.LineBasicMaterial({ color: 0x0891b2, transparent: true, opacity: 0.9 })
    );
    trunkWire.position.y = 0.35;
    treeGroup.add(trunkWire);

    // Bottom cone tier
    const cone1Geo = new THREE.ConeGeometry(1.25, 1.1, 14, 2);
    const cone1Wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(cone1Geo),
      new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95 })
    );
    cone1Wire.position.y = 1.0;
    treeGroup.add(cone1Wire);

    // Middle cone tier
    const cone2Geo = new THREE.ConeGeometry(0.95, 0.95, 12, 2);
    const cone2Wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(cone2Geo),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 })
    );
    cone2Wire.position.y = 1.6;
    treeGroup.add(cone2Wire);

    // Top cone tier
    const cone3Geo = new THREE.ConeGeometry(0.65, 0.85, 10, 2);
    const cone3Wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(cone3Geo),
      new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 1.0 })
    );
    cone3Wire.position.y = 2.15;
    treeGroup.add(cone3Wire);

    // Tree Crown Star Node
    const starGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    starMesh.position.y = 2.6;
    treeGroup.add(starMesh);

    // Dynamic 3D Scanning Ring along the tree
    const scanRingGeo = new THREE.RingGeometry(0.2, 0.24, 24);
    scanRingGeo.rotateX(Math.PI / 2);
    const scanRingMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const scanRingMesh = new THREE.Mesh(scanRingGeo, scanRingMat);
    treeGroup.add(scanRingMesh);

    scene.add(treeGroup);

    // 5. Background 3D Wireframe Fir Trees
    const bgTree1 = new THREE.Group();
    bgTree1.position.set(0.7, -0.45, -1.8);
    bgTree1.scale.set(0.65, 0.65, 0.65);
    const bgCone1 = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.ConeGeometry(1.1, 1.8, 10, 2)),
      new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.7 })
    );
    bgCone1.position.y = 1.0;
    bgTree1.add(bgCone1);
    scene.add(bgTree1);

    const bgTree2 = new THREE.Group();
    bgTree2.position.set(-2.6, -0.5, -1.2);
    bgTree2.scale.set(0.5, 0.5, 0.5);
    const bgCone2 = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.ConeGeometry(1.0, 1.6, 8, 2)),
      new THREE.LineBasicMaterial({ color: 0x0369a1, transparent: true, opacity: 0.6 })
    );
    bgCone2.position.y = 0.9;
    bgTree2.add(bgCone2);
    scene.add(bgTree2);

    // 6. 3D Wireframe Cottage / House
    const houseGroup = new THREE.Group();
    houseGroup.position.set(1.4, -0.4, 0.2);

    // Base Box walls
    const houseBoxGeo = new THREE.BoxGeometry(1.3, 0.8, 1.0, 2, 2, 2);
    const houseBoxWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(houseBoxGeo),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 })
    );
    houseBoxWire.position.y = 0.4;
    houseGroup.add(houseBoxWire);

    // Triangular Roof
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-0.7, 0);
    roofShape.lineTo(0, 0.55);
    roofShape.lineTo(0.7, 0);
    roofShape.closePath();

    const roofExtrudeSettings = {
      depth: 1.1,
      bevelEnabled: false,
    };
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, roofExtrudeSettings);
    roofGeo.center();
    const roofWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(roofGeo),
      new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95 })
    );
    roofWire.position.y = 1.05;
    houseGroup.add(roofWire);

    // Secondary structure nearby
    const barnGeo = new THREE.BoxGeometry(0.8, 0.5, 0.6, 1, 1, 1);
    const barnWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(barnGeo),
      new THREE.LineBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.75 })
    );
    barnWire.position.set(0.4, 0.25, 0.9);
    houseGroup.add(barnWire);

    scene.add(houseGroup);

    // 7. 3D Beacons / Laser LiDAR Towers
    const beaconMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
    const beaconSphereGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const beaconPulseMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });

    // Left Beacon (x: -3.2, z: 0.6)
    const beacon1 = new THREE.Group();
    beacon1.position.set(-3.2, -0.6, 0.6);
    const b1Line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.4, 0)]),
      beaconMat
    );
    const b1Head = new THREE.Mesh(beaconSphereGeo, beaconPulseMat);
    b1Head.position.y = 1.4;
    beacon1.add(b1Line, b1Head);
    scene.add(beacon1);

    // Right LiDAR Tower (x: 3.2, z: 0.4)
    const beacon2 = new THREE.Group();
    beacon2.position.set(3.2, -0.6, 0.4);
    const b2Line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.6, 0)]),
      beaconMat
    );
    const b2Head = new THREE.Mesh(beaconSphereGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    b2Head.position.y = 1.6;
    beacon2.add(b2Line, b2Head);
    scene.add(beacon2);

    // 8. Dynamic 3D LiDAR Laser Ray Line
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(3.2, 1.0, 0.4),
      new THREE.Vector3(1.4, 0.4, 0.2),
    ]);
    const laserMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      linewidth: 2,
    });
    const laserLine = new THREE.Line(laserGeo, laserMat);
    scene.add(laserLine);

    // Laser Contact Point Flare
    const flareGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const flareMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const flareMesh = new THREE.Mesh(flareGeo, flareMat);
    scene.add(flareMesh);

    // 9. 3D Closed Route Trajectory Loop
    const curvePoints = [
      new THREE.Vector3(-3.0, -0.4, 0.6),
      new THREE.Vector3(-2.0, -0.3, 1.4),
      new THREE.Vector3(-0.6, -0.4, 1.6),
      new THREE.Vector3(1.0, -0.3, 1.4),
      new THREE.Vector3(2.6, -0.4, 0.8),
      new THREE.Vector3(2.8, -0.4, -0.4),
      new THREE.Vector3(1.8, -0.3, -1.0),
      new THREE.Vector3(0.0, -0.3, -0.8),
      new THREE.Vector3(-1.8, -0.4, -0.4),
    ];
    const curve = new THREE.CatmullRomCurve3(curvePoints, true);
    const loopPts = curve.getPoints(90);

    const loopGeo = new THREE.BufferGeometry().setFromPoints(loopPts);
    const loopMat = new THREE.LineBasicMaterial({
      color: 0x0891b2,
      transparent: true,
      opacity: 0.7,
    });
    const loopLine = new THREE.LineLoop(loopGeo, loopMat);
    scene.add(loopLine);

    // 3D Traveling Energy Orb along the curve
    const energyOrbGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const energyOrbMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    const energyOrb = new THREE.Mesh(energyOrbGeo, energyOrbMat);
    scene.add(energyOrb);

    const energyOrb2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    scene.add(energyOrb2);

    // 10. 3D Holographic Floating Data Particles
    const particleCount = 75;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 12;
      particlePositions[i * 3 + 1] = Math.random() * 3 - 0.5;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 8;

      particleVelocities[i * 3] = (Math.random() - 0.5) * 0.004;
      particleVelocities[i * 3 + 1] = 0.006 + Math.random() * 0.008; // upward drift
      particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.004;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x22d3ee,
      size: 0.06,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 11. Mouse tracking for smooth continuous 3D tilt
    let targetRotY = 0;
    let targetRotX = 0;
    let currentRotY = 0;
    let currentRotX = 0;

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetRotY = nx * 0.45;
      targetRotX = -ny * 0.25;
    };

    const handlePointerLeave = () => {
      targetRotY = 0;
      targetRotX = 0;
    };

    container.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('mouseleave', handlePointerLeave);

    // 12. Silky-Smooth 60 FPS Render Loop (Clock-based, zero stuttering or loop resets)
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth camera interpolation
      currentRotY += (targetRotY - currentRotY) * 0.06;
      currentRotX += (targetRotX - currentRotX) * 0.06;

      const camRadius = 7.8;
      const baseCamAngle = Math.sin(elapsed * 0.3) * 0.12 + currentRotY;
      const baseCamHeight = 4.0 + Math.sin(elapsed * 0.45) * 0.18 + currentRotX * 3.0;

      camera.position.x = Math.sin(baseCamAngle) * camRadius;
      camera.position.z = Math.cos(baseCamAngle) * camRadius;
      camera.position.y = baseCamHeight;
      camera.lookAt(0, 0.4, 0);

      // Living Wave Motion on Terrain Mesh (flowing continuously)
      const pAttr = planeGeo.attributes.position;
      for (let i = 0; i < pAttr.count; i++) {
        const vx = pAttr.getX(i);
        const vz = pAttr.getZ(i);
        const wave = Math.sin(vx * 0.8 + elapsed * 1.5) * Math.cos(vz * 0.8 + elapsed * 1.2) * 0.08;
        pAttr.setY(i, originalHeights[i] + wave);
      }
      pAttr.needsUpdate = true;

      // Tree Hover & Scan Ring Cycle
      treeGroup.position.y = -0.6 + Math.sin(elapsed * 1.8) * 0.04;
      const scanT = (Math.sin(elapsed * 2.2) + 1) / 2; // 0 to 1
      scanRingMesh.position.y = 0.5 + scanT * 1.9;
      const ringScale = 1.2 - scanT * 0.7;
      scanRingMesh.scale.set(ringScale, ringScale, ringScale);

      // House subtle hover
      houseGroup.position.y = -0.4 + Math.cos(elapsed * 1.5) * 0.03;

      // LiDAR Scanner Turret: smooth harmonic sweeping
      const sweepAngle = Math.sin(elapsed * 1.8) * 0.45;
      const targetLaserX = 1.4 + Math.sin(elapsed * 2.2) * 0.8;
      const targetLaserY = 0.4 + Math.cos(elapsed * 1.9) * 0.3;
      const targetLaserZ = 0.2 + Math.sin(elapsed * 1.4) * 0.5;

      const laserPosAttr = laserGeo.attributes.position;
      laserPosAttr.setXYZ(1, targetLaserX, targetLaserY, targetLaserZ);
      laserPosAttr.needsUpdate = true;

      flareMesh.position.set(targetLaserX, targetLaserY, targetLaserZ);
      flareMesh.scale.setScalar(0.9 + Math.sin(elapsed * 8) * 0.3);

      // Traveling Energy Packets along the route curve
      const orbT = (elapsed * 0.25) % 1;
      const orbPos = curve.getPointAt(orbT);
      energyOrb.position.copy(orbPos);

      const orb2T = (elapsed * 0.25 + 0.5) % 1;
      const orb2Pos = curve.getPointAt(orb2T);
      energyOrb2.position.copy(orb2Pos);

      // Ascending Hologram Particles
      const pPos = particleGeo.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        let py = pPos.getY(i) + particleVelocities[i * 3 + 1];
        if (py > 3.2) {
          py = -0.6; // wrap seamlessly at bottom
        }
        pPos.setY(i, py);
        pPos.setX(i, pPos.getX(i) + particleVelocities[i * 3]);
        pPos.setZ(i, pPos.getZ(i) + particleVelocities[i * 3 + 2]);
      }
      pPos.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // 13. Responsive Resize Observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 170;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 14. Proper Resource Disposal on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('mouseleave', handlePointerLeave);
      resizeObserver.disconnect();

      // Geometries
      planeGeo.dispose();
      terrainWireGeo.dispose();
      trunkGeo.dispose();
      cone1Geo.dispose();
      cone2Geo.dispose();
      cone3Geo.dispose();
      starGeo.dispose();
      scanRingGeo.dispose();
      houseBoxGeo.dispose();
      roofGeo.dispose();
      barnGeo.dispose();
      beaconSphereGeo.dispose();
      laserGeo.dispose();
      flareGeo.dispose();
      loopGeo.dispose();
      energyOrbGeo.dispose();
      particleGeo.dispose();

      // Materials
      terrainWireMat.dispose();
      scanRingMat.dispose();
      beaconMat.dispose();
      beaconPulseMat.dispose();
      laserMat.dispose();
      flareMat.dispose();
      loopMat.dispose();
      energyOrbMat.dispose();
      particleMat.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-[105px] sm:h-[120px] rounded-xl overflow-hidden bg-[#02050e] border border-cyan-900/60 shadow-[inset_0_0_35px_rgba(0,0,0,0.95)] ${className}`}
    >
      {/* HUD Info Badges Overlaid on top of real 3D canvas */}
      <div className="absolute top-2 left-2.5 text-[9px] sm:text-[9.5px] font-mono text-cyan-400 font-semibold tracking-wider z-20 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)] pointer-events-none flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
        <span>
          {stageName === 'models'
            ? `ОБЪЕКТЫ ЗОНЫ: ${Math.round(progress * 100)}%`
            : stageName === 'tiles'
            ? `КАРТА ЗОНЫ: ${Math.round(progress * 100)}%`
            : `НАВМЕШ ЗОНЫ: ${Math.round(progress * 100)}%`}
        </span>
      </div>

      <div className="absolute top-2 right-2.5 text-[8.5px] sm:text-[9px] font-mono text-cyan-300/70 font-semibold tracking-widest z-20 pointer-events-none">
        ДЕРЕВЬЯ И СТРОЕНИЯ [3D WEBGL]
      </div>
    </div>
  );
};
