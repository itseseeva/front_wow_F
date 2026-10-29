import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Language } from '../utils/i18n';

interface ThreeTerrainSceneProps {
  progress: number; // 0 to 1
  stageName: string;
  className?: string;
  language?: Language;
}

export const ThreeTerrainScene: React.FC<ThreeTerrainSceneProps> = ({
  progress,
  stageName,
  className = '',
  language = 'ru',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 360;
    let height = container.clientHeight || 115;

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

    // 1. Scene & Camera (WoW Dark Fantasy Obsidian Altar)
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x141115, 0.08);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 4.3, 8.0);
    camera.lookAt(0, 0.35, 0);

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

    // 3. Procedural 3D Undulating Wireframe Terrain (Carved Obsidian with Gold Veins)
    const terrainCols = 32;
    const terrainRows = 24;
    const planeGeo = new THREE.PlaneGeometry(16, 12, terrainCols, terrainRows);
    planeGeo.rotateX(-Math.PI / 2);

    const posAttr = planeGeo.attributes.position;
    const originalHeights = new Float32Array(posAttr.count);

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);

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
      color: 0x5a3e1b,
      transparent: true,
      opacity: 0.85,
    });
    const terrainMesh = new THREE.LineSegments(terrainWireGeo, terrainWireMat);
    terrainMesh.position.y = -0.6;
    scene.add(terrainMesh);

    // 4. Hero 3D Wireframe Fantasy Spruce Tree (Obstacle 1)
    // Center at x = -0.8, z = 0.2. Base cone radius is 1.25.
    // Leaves boundary on -X is x = -0.8 - 1.25 = -2.05.
    // Leaves boundary on +Z is z = 0.2 + 1.25 = 1.45.
    const treePos = new THREE.Vector3(-0.8, -0.6, 0.2);
    const treeGroup = new THREE.Group();
    treeGroup.position.copy(treePos);

    const trunkGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.7, 8);
    const trunkWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(trunkGeo),
      new THREE.LineBasicMaterial({ color: 0x785a28, transparent: true, opacity: 0.9 })
    );
    trunkWire.position.y = 0.35;
    treeGroup.add(trunkWire);

    const cone1Geo = new THREE.ConeGeometry(1.25, 1.1, 14, 2);
    const cone1Wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(cone1Geo),
      new THREE.LineBasicMaterial({ color: 0xc89b3c, transparent: true, opacity: 0.95 })
    );
    cone1Wire.position.y = 1.0;
    treeGroup.add(cone1Wire);

    const cone2Geo = new THREE.ConeGeometry(0.95, 0.95, 12, 2);
    const cone2Wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(cone2Geo),
      new THREE.LineBasicMaterial({ color: 0xf0b232, transparent: true, opacity: 0.95 })
    );
    cone2Wire.position.y = 1.6;
    treeGroup.add(cone2Wire);

    const cone3Geo = new THREE.ConeGeometry(0.65, 0.85, 10, 2);
    const cone3Wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(cone3Geo),
      new THREE.LineBasicMaterial({ color: 0xf5d17f, transparent: true, opacity: 1.0 })
    );
    cone3Wire.position.y = 2.15;
    treeGroup.add(cone3Wire);

    const starGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xfff0a6 });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    starMesh.position.y = 2.6;
    treeGroup.add(starMesh);

    const scanRingGeo = new THREE.RingGeometry(0.2, 0.24, 24);
    scanRingGeo.rotateX(Math.PI / 2);
    const scanRingMat = new THREE.MeshBasicMaterial({
      color: 0xf0b232,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const scanRingMesh = new THREE.Mesh(scanRingGeo, scanRingMat);
    treeGroup.add(scanRingMesh);
    scene.add(treeGroup);

    // 5. Background Fantasy Trees
    const bgTree1 = new THREE.Group();
    bgTree1.position.set(0.7, -0.45, -1.8);
    bgTree1.scale.set(0.65, 0.65, 0.65);
    const bgCone1Geo = new THREE.ConeGeometry(1.1, 1.8, 10, 2);
    const bgCone1 = new THREE.LineSegments(
      new THREE.WireframeGeometry(bgCone1Geo),
      new THREE.LineBasicMaterial({ color: 0x785a28, transparent: true, opacity: 0.7 })
    );
    bgCone1.position.y = 1.0;
    bgTree1.add(bgCone1);
    scene.add(bgTree1);

    const bgTree2 = new THREE.Group();
    bgTree2.position.set(-2.6, -0.5, -1.2);
    bgTree2.scale.set(0.5, 0.5, 0.5);
    const bgCone2Geo = new THREE.ConeGeometry(1.0, 1.6, 8, 2);
    const bgCone2 = new THREE.LineSegments(
      new THREE.WireframeGeometry(bgCone2Geo),
      new THREE.LineBasicMaterial({ color: 0x5a4422, transparent: true, opacity: 0.6 })
    );
    bgCone2.position.y = 0.9;
    bgTree2.add(bgCone2);
    scene.add(bgTree2);

    // 6. 3D Wireframe Runic Fantasy Shrine / House (Obstacle 2)
    // House center: x = 1.4, z = 0.2. Base width = 1.3 -> Left wall is at x = 0.75.
    const housePos = new THREE.Vector3(1.4, -0.4, 0.2);
    const houseGroup = new THREE.Group();
    houseGroup.position.copy(housePos);

    const houseBoxGeo = new THREE.BoxGeometry(1.3, 0.8, 1.0, 2, 2, 2);
    const houseBoxWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(houseBoxGeo),
      new THREE.LineBasicMaterial({ color: 0xc89b3c, transparent: true, opacity: 0.9 })
    );
    houseBoxWire.position.y = 0.4;
    houseGroup.add(houseBoxWire);

    const roofShape = new THREE.Shape();
    roofShape.moveTo(-0.7, 0);
    roofShape.lineTo(0, 0.55);
    roofShape.lineTo(0.7, 0);
    roofShape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 1.1, bevelEnabled: false });
    roofGeo.center();
    const roofWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(roofGeo),
      new THREE.LineBasicMaterial({ color: 0xf0b232, transparent: true, opacity: 0.95 })
    );
    roofWire.position.y = 1.05;
    houseGroup.add(roofWire);

    const barnGeo = new THREE.BoxGeometry(0.8, 0.5, 0.6, 1, 1, 1);
    const barnWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(barnGeo),
      new THREE.LineBasicMaterial({ color: 0x926e25, transparent: true, opacity: 0.75 })
    );
    barnWire.position.set(0.4, 0.25, 0.9);
    houseGroup.add(barnWire);
    scene.add(houseGroup);

    // 7. Arcane Runic Obelisks / Beacons
    const beaconMat = new THREE.LineBasicMaterial({ color: 0xc89b3c });
    const beaconSphereGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const beaconPulseMat = new THREE.MeshBasicMaterial({ color: 0xf0b232 });

    const beacon1 = new THREE.Group();
    beacon1.position.set(-3.2, -0.6, 0.6);
    const b1LineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1.4, 0),
    ]);
    const b1Line = new THREE.Line(b1LineGeo, beaconMat);
    const b1Head = new THREE.Mesh(beaconSphereGeo, beaconPulseMat);
    b1Head.position.y = 1.4;
    beacon1.add(b1Line, b1Head);
    scene.add(beacon1);

    const beacon2 = new THREE.Group();
    beacon2.position.set(3.2, -0.6, 0.4);
    const b2LineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1.6, 0),
    ]);
    const b2Line = new THREE.Line(b2LineGeo, beaconMat);
    const b2HeadMat = new THREE.MeshBasicMaterial({ color: 0xfff0a6 });
    const b2Head = new THREE.Mesh(beaconSphereGeo, b2HeadMat);
    b2Head.position.y = 1.6;
    beacon2.add(b2Line, b2Head);
    scene.add(beacon2);

    // Goal Waypoint Finish Flag / Emerald Rune Ring
    const goalFlag = new THREE.Group();
    goalFlag.position.set(3.0, -0.4, 0.4);
    const goalRingGeo = new THREE.RingGeometry(0.25, 0.32, 20);
    goalRingGeo.rotateX(Math.PI / 2);
    const goalRingMat = new THREE.MeshBasicMaterial({
      color: 0x2ecc71,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const goalRingMesh = new THREE.Mesh(goalRingGeo, goalRingMat);
    goalFlag.add(goalRingMesh);
    scene.add(goalFlag);

    // 8. Dynamic Arcane Ray Line
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(3.2, 1.0, 0.4),
      new THREE.Vector3(1.4, 0.4, 0.2),
    ]);
    const laserMat = new THREE.LineBasicMaterial({ color: 0xf5d17f });
    const laserLine = new THREE.Line(laserGeo, laserMat);
    scene.add(laserLine);

    const flareGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const flareMat = new THREE.MeshBasicMaterial({ color: 0xfff0a6 });
    const flareMesh = new THREE.Mesh(flareGeo, flareMat);
    scene.add(flareMesh);

    // 9. 3D Closed Route Trajectory Loop (Molten Gold Arcane Thread)
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
      color: 0xc89b3c,
      transparent: true,
      opacity: 0.85,
    });
    const loopLine = new THREE.LineLoop(loopGeo, loopMat);
    scene.add(loopLine);

    // Golden Mana Orb
    const energyOrbGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const energyOrbMat = new THREE.MeshBasicMaterial({ color: 0xf0b232 });
    const energyOrb = new THREE.Mesh(energyOrbGeo, energyOrbMat);
    scene.add(energyOrb);

    // 10. Floating Golden Arcane Embers
    const particleCount = 65;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 12;
      particlePositions[i * 3 + 1] = Math.random() * 3 - 0.5;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 8;

      particleVelocities[i * 3] = (Math.random() - 0.5) * 0.004;
      particleVelocities[i * 3 + 1] = 0.006 + Math.random() * 0.008;
      particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.004;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xf5d17f,
      size: 0.06,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // =========================================================================
    // 11. ARCANE RUNIC GOLEM OGRE MODEL (WoW Dark Fantasy)
    // =========================================================================
    const ogreGroup = new THREE.Group();
    ogreGroup.scale.set(0.68, 0.68, 0.68);

    const ogreWireMat = new THREE.LineBasicMaterial({
      color: 0xf5d17f,
      transparent: true,
      opacity: 0.95,
    });
    const ogreCoreMat = new THREE.MeshBasicMaterial({
      color: 0x2a1818,
      transparent: true,
      opacity: 0.55,
    });

    // A. Torso
    const torsoGeo = new THREE.BoxGeometry(0.75, 0.65, 0.5, 2, 2, 2);
    const torsoWire = new THREE.LineSegments(new THREE.WireframeGeometry(torsoGeo), ogreWireMat);
    const torsoCore = new THREE.Mesh(torsoGeo, ogreCoreMat);
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 0.62;
    torsoGroup.add(torsoWire, torsoCore);
    ogreGroup.add(torsoGroup);

    // B. Head with Ogre Horn & Jaw
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.05, 0.08);

    const headGeo = new THREE.BoxGeometry(0.42, 0.38, 0.4, 2, 2, 2);
    const headWire = new THREE.LineSegments(new THREE.WireframeGeometry(headGeo), ogreWireMat);
    const headCore = new THREE.Mesh(headGeo, ogreCoreMat);
    headGroup.add(headWire, headCore);

    // Horn (Golden Runic Horn)
    const hornGeo = new THREE.ConeGeometry(0.09, 0.3, 6);
    hornGeo.rotateX(Math.PI / 4);
    const hornMat = new THREE.MeshBasicMaterial({ color: 0xf0b232 });
    const hornMesh = new THREE.Mesh(hornGeo, hornMat);
    hornMesh.position.set(0, 0.22, 0.2);
    headGroup.add(hornMesh);

    // Eyes (Ruby Red Glowing Eyes)
    const eyeGeo = new THREE.SphereGeometry(0.045, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.11, 0.04, 0.21);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.11, 0.04, 0.21);
    headGroup.add(eyeL, eyeR);

    ogreGroup.add(headGroup);

    // C. Spinning Stun Stars Group
    const stunGroup = new THREE.Group();
    stunGroup.position.set(0, 1.48, 0);
    const starCount = 3;
    const stunStarMeshes: THREE.Mesh[] = [];
    const stunStarGeo = new THREE.OctahedronGeometry(0.075);
    const stunStarMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

    for (let i = 0; i < starCount; i++) {
      const star = new THREE.Mesh(stunStarGeo, stunStarMat);
      stunGroup.add(star);
      stunStarMeshes.push(star);
    }
    ogreGroup.add(stunGroup);
    stunGroup.visible = false;

    // D. Arms & Spiked Cyber Club
    const armGeo = new THREE.BoxGeometry(0.2, 0.52, 0.22);
    const armWireGeo = new THREE.WireframeGeometry(armGeo);

    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.46, 0.85, 0);
    const leftArmWire = new THREE.LineSegments(armWireGeo, ogreWireMat);
    leftArmWire.position.y = -0.22;
    leftArmGroup.add(leftArmWire);
    ogreGroup.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.46, 0.85, 0);
    const rightArmWire = new THREE.LineSegments(armWireGeo, ogreWireMat);
    rightArmWire.position.y = -0.22;
    rightArmGroup.add(rightArmWire);

    const clubGroup = new THREE.Group();
    clubGroup.position.set(0.12, -0.38, 0.16);

    const clubHandleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.65, 6);
    const clubHandleMat = new THREE.LineBasicMaterial({ color: 0x785a28 });
    const clubHandle = new THREE.LineSegments(new THREE.WireframeGeometry(clubHandleGeo), clubHandleMat);

    const clubHeadGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.45, 8);
    const clubHeadMat = new THREE.MeshBasicMaterial({ color: 0xf0b232, wireframe: true });
    const clubHead = new THREE.Mesh(clubHeadGeo, clubHeadMat);
    clubHead.position.y = 0.22;

    clubGroup.add(clubHandle, clubHead);
    rightArmGroup.add(clubGroup);
    ogreGroup.add(rightArmGroup);

    // E. Heavy Stomping Legs
    const legGeo = new THREE.BoxGeometry(0.24, 0.52, 0.26);
    const legWireGeo = new THREE.WireframeGeometry(legGeo);

    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.2, 0.45, 0);
    const leftLegWire = new THREE.LineSegments(legWireGeo, ogreWireMat);
    leftLegWire.position.y = -0.25;
    leftLegGroup.add(leftLegWire);
    ogreGroup.add(leftLegGroup);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.2, 0.45, 0);
    const rightLegWire = new THREE.LineSegments(legWireGeo, ogreWireMat);
    rightLegWire.position.y = -0.25;
    rightLegGroup.add(rightLegWire);
    ogreGroup.add(rightLegGroup);

    // Holographic Ground Aura Under Ogre (WoW Horde Ruby Rune Ring)
    const ogreAuraGeo = new THREE.RingGeometry(0.35, 0.42, 16);
    ogreAuraGeo.rotateX(Math.PI / 2);
    const ogreAuraMat = new THREE.MeshBasicMaterial({
      color: 0xdc2626,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const ogreAuraMesh = new THREE.Mesh(ogreAuraGeo, ogreAuraMat);
    ogreAuraMesh.position.y = 0.02;
    ogreGroup.add(ogreAuraMesh);

    scene.add(ogreGroup);

    // =========================================================================
    // 12. SPLINES & PATHS
    // =========================================================================

    // A. Detour Path to House (Phase 1):
    // Starts where ogre recovers from tree impact (-2.25, 0.2),
    // steps cleanly out around the front of the tree canopy (z = 1.7 > 1.45),
    // then charges towards the house corner at (0.68, 0.55)!
    const treeDetourPoints = [
      new THREE.Vector3(-2.25, -0.45, 0.2),
      new THREE.Vector3(-1.8, -0.45, 1.2),
      new THREE.Vector3(-0.8, -0.45, 1.7),  // CLEARLY outside tree cone foliage!
      new THREE.Vector3(0.1, -0.45, 1.5),
      new THREE.Vector3(0.68, -0.45, 0.55), // Impacts front corner of cottage!
    ];
    const treeDetourCurve = new THREE.CatmullRomCurve3(treeDetourPoints, false);

    // Return Path from house back to start (-3.2, 0.2)
    const returnDetourPoints = [
      new THREE.Vector3(0.35, -0.45, 0.95), // Stun recoil from house
      new THREE.Vector3(-0.1, -0.45, 1.6),
      new THREE.Vector3(-0.8, -0.45, 1.7),  // Steers around tree on way back too!
      new THREE.Vector3(-1.8, -0.45, 1.2),
      new THREE.Vector3(-2.6, -0.45, 0.4),
      new THREE.Vector3(-3.2, -0.45, 0.2),
    ];
    const returnDetourCurve = new THREE.CatmullRomCurve3(returnDetourPoints, false);

    // B. Smart Nav Loop (Phase 2, >= 75%):
    // Closed continuous loop that gracefully circles around all foliage and houses!
    const smartNavLoopPoints = [
      new THREE.Vector3(-3.0, -0.45, 0.4),
      new THREE.Vector3(-2.1, -0.44, 1.35),
      new THREE.Vector3(-0.8, -0.44, 1.75), // Generous clearance around tree!
      new THREE.Vector3(0.4, -0.44, 1.55),
      new THREE.Vector3(1.4, -0.44, 1.6),  // Generous clearance around cottage!
      new THREE.Vector3(2.4, -0.44, 1.05),
      new THREE.Vector3(3.0, -0.42, 0.4),  // Waypoint beacon
      new THREE.Vector3(2.6, -0.44, -0.7), // Sweeps behind house
      new THREE.Vector3(1.2, -0.44, -1.0),
      new THREE.Vector3(-0.1, -0.44, -0.9),
      new THREE.Vector3(-1.8, -0.44, -0.7),
    ];
    const smartNavLoopCurve = new THREE.CatmullRomCurve3(smartNavLoopPoints, true);

    const smartNavPts = smartNavLoopCurve.getPoints(80);
    const smartNavGeo = new THREE.BufferGeometry().setFromPoints(smartNavPts);
    const smartNavMat = new THREE.LineDashedMaterial({
      color: 0xf0b232,
      dashSize: 0.25,
      gapSize: 0.12,
      transparent: true,
      opacity: 0.0,
    });
    const smartNavLine = new THREE.Line(smartNavGeo, smartNavMat);
    smartNavLine.computeLineDistances();
    scene.add(smartNavLine);

    // 13. Pointer Tilt Interaction
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

    // 14. BUTTERY SMOOTH 60 FPS ANIMATION LOOP
    let animationFrameId: number;
    const clock = new THREE.Clock();

    let walkPhase = 0;
    let ogreSimTime = 0;
    let smartNavLapTime = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = Math.min(0.05, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      ogreSimTime += delta;

      const currentProgress = progressRef.current;
      const isSmartPhase = currentProgress >= 0.75;

      // Smooth camera interpolation
      currentRotY += (targetRotY - currentRotY) * 0.06;
      currentRotX += (targetRotX - currentRotX) * 0.06;

      const camRadius = 8.0;
      const baseCamAngle = Math.sin(elapsed * 0.3) * 0.12 + currentRotY;
      const baseCamHeight = 4.2 + Math.sin(elapsed * 0.45) * 0.18 + currentRotX * 3.0;

      camera.position.x = Math.sin(baseCamAngle) * camRadius;
      camera.position.z = Math.cos(baseCamAngle) * camRadius;
      camera.position.y = baseCamHeight;
      camera.lookAt(0, 0.35, 0);

      // Living Wave Motion on Terrain Mesh
      const pAttr = planeGeo.attributes.position;
      for (let i = 0; i < pAttr.count; i++) {
        const vx = pAttr.getX(i);
        const vz = pAttr.getZ(i);
        const wave = Math.sin(vx * 0.8 + elapsed * 1.5) * Math.cos(vz * 0.8 + elapsed * 1.2) * 0.07;
        pAttr.setY(i, originalHeights[i] + wave);
      }
      pAttr.needsUpdate = true;

      // Tree Hover & Scan Ring Cycle
      treeGroup.position.y = -0.6 + Math.sin(elapsed * 1.8) * 0.04;
      const scanT = (Math.sin(elapsed * 2.2) + 1) / 2;
      scanRingMesh.position.y = 0.5 + scanT * 1.9;
      const ringScale = 1.2 - scanT * 0.7;
      scanRingMesh.scale.set(ringScale, ringScale, ringScale);

      // House subtle hover
      houseGroup.position.y = -0.4 + Math.cos(elapsed * 1.5) * 0.03;

      // Laser sweeping
      const targetLaserX = 1.4 + Math.sin(elapsed * 2.2) * 0.8;
      const targetLaserY = 0.4 + Math.cos(elapsed * 1.9) * 0.3;
      const targetLaserZ = 0.2 + Math.sin(elapsed * 1.4) * 0.5;

      const laserPosAttr = laserGeo.attributes.position;
      laserPosAttr.setXYZ(1, targetLaserX, targetLaserY, targetLaserZ);
      laserPosAttr.needsUpdate = true;

      flareMesh.position.set(targetLaserX, targetLaserY, targetLaserZ);
      flareMesh.scale.setScalar(0.9 + Math.sin(elapsed * 8) * 0.3);

      // Traveling Energy orb
      const orbT = (elapsed * 0.25) % 1;
      const orbPos = curve.getPointAt(orbT);
      energyOrb.position.copy(orbPos);

      // Ascending Particles
      const pPos = particleGeo.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        let py = pPos.getY(i) + particleVelocities[i * 3 + 1];
        if (py > 3.2) {
          py = -0.6;
        }
        pPos.setY(i, py);
        pPos.setX(i, pPos.getX(i) + particleVelocities[i * 3]);
        pPos.setZ(i, pPos.getZ(i) + particleVelocities[i * 3 + 2]);
      }
      pPos.needsUpdate = true;

      // =======================================================================
      // OGRE ANIMATION KINEMATICS & COLLISION LOGIC
      // =======================================================================
      if (!isSmartPhase) {
        // --- PHASE 1: < 75% -> TREE COLLISION, DETOUR AROUND TREE, HOUSE COLLISION ---
        smartNavMat.opacity = 0.0;
        goalRingMat.color.setHex(0x0ea5e9);

        const totalCycle = 11.0;
        const subTime = ogreSimTime % totalCycle;

        // Tree collision edge:
        // Tree center is at x = -0.8, z = 0.2. Cone base radius = 1.25.
        // Ogre impacts outer triangular canopy leaves at x = -1.82!
        const treeFoliageEdgeX = -1.82;
        const treeStartZ = 0.2;

        if (subTime < 4.2) {
          // --- STAGE 1: RUN & BONK INTO TREE LEAVES (0.0s - 4.2s) ---
          if (subTime < 1.8) {
            // Charges towards tree
            const t = subTime / 1.8;
            const curX = -3.2 + t * (treeFoliageEdgeX - -3.2);
            ogreGroup.position.set(curX, -0.45, treeStartZ);
            ogreGroup.rotation.set(0, Math.PI / 2, 0);

            walkPhase += delta * 12;
            stunGroup.visible = false;
            eyeMat.color.setHex(0x38bdf8);

            leftLegGroup.rotation.x = Math.sin(walkPhase) * 0.65;
            rightLegGroup.rotation.x = -Math.sin(walkPhase) * 0.65;
            leftArmGroup.rotation.x = -Math.sin(walkPhase) * 0.55;
            rightArmGroup.rotation.x = Math.sin(walkPhase) * 0.55;
            torsoGroup.position.y = 0.62 + Math.abs(Math.sin(walkPhase)) * 0.04;
            torsoGroup.rotation.x = 0.18;
            clubGroup.rotation.z = 0.25;
            headGroup.rotation.set(0, 0, 0);
          } else if (subTime < 3.4) {
            // BONK! TREE IMPACT & RECOIL BOUNCE BACK!
            const stunT = (subTime - 1.8) / 1.6;
            stunGroup.visible = true;
            eyeMat.color.setHex(0xfbbf24);

            const recoilDisp = Math.sin(Math.min(1.0, stunT * 1.8) * Math.PI) * 0.43;
            ogreGroup.position.set(treeFoliageEdgeX - recoilDisp, -0.52, treeStartZ);

            torsoGroup.rotation.x = -0.42;
            torsoGroup.position.y = 0.52;
            leftLegGroup.rotation.x = -0.55;
            rightLegGroup.rotation.x = -0.55;
            leftArmGroup.rotation.x = 0.25;
            rightArmGroup.rotation.x = -0.15;
            clubGroup.rotation.z = 1.15;

            headGroup.rotation.z = Math.sin(elapsed * 15) * 0.22;
            headGroup.rotation.y = Math.cos(elapsed * 11) * 0.18;

            for (let s = 0; s < starCount; s++) {
              const starAngle = elapsed * 8 + (s * Math.PI * 2) / starCount;
              stunStarMeshes[s].position.set(
                Math.cos(starAngle) * 0.32,
                Math.sin(elapsed * 10 + s) * 0.06,
                Math.sin(starAngle) * 0.32
              );
              stunStarMeshes[s].rotation.y = elapsed * 10;
              stunStarMeshes[s].rotation.x = elapsed * 7;
            }
          } else {
            // Stands up from tree collision
            const recoverT = (subTime - 3.4) / 0.8;
            stunGroup.visible = false;
            eyeMat.color.setHex(0x38bdf8);

            torsoGroup.rotation.x = -0.42 * (1 - recoverT);
            torsoGroup.position.y = 0.52 + recoverT * 0.1;
            headGroup.rotation.set(0, 0, 0);
            clubGroup.rotation.z = 1.15 * (1 - recoverT);
            leftLegGroup.rotation.x = -0.55 * (1 - recoverT);
            rightLegGroup.rotation.x = -0.55 * (1 - recoverT);
            ogreGroup.position.set(-2.25, -0.45, treeStartZ);
          }
        } else if (subTime < 8.6) {
          // --- STAGE 2: DETOUR AROUND TREE LEAVES & CRASH INTO HOUSE (4.2s - 8.6s) ---
          const houseSubTime = subTime - 4.2;

          if (houseSubTime < 2.8) {
            // DETOUR AROUND TREE: Follows treeDetourCurve cleanly bypassing all branches!
            const t = houseSubTime / 2.8;
            const pos = treeDetourCurve.getPointAt(t);
            const tangent = treeDetourCurve.getTangentAt(t);

            ogreGroup.position.copy(pos);
            const lookAngle = Math.atan2(tangent.x, tangent.z);
            ogreGroup.rotation.set(0, lookAngle, 0);

            walkPhase += delta * 12.5;
            stunGroup.visible = false;
            eyeMat.color.setHex(0x38bdf8);

            leftLegGroup.rotation.x = Math.sin(walkPhase) * 0.65;
            rightLegGroup.rotation.x = -Math.sin(walkPhase) * 0.65;
            leftArmGroup.rotation.x = -Math.sin(walkPhase) * 0.55;
            rightArmGroup.rotation.x = Math.sin(walkPhase) * 0.55;
            torsoGroup.position.y = 0.62 + Math.abs(Math.sin(walkPhase)) * 0.04;
            torsoGroup.rotation.x = 0.18;
            clubGroup.rotation.z = 0.25;
            headGroup.rotation.set(0, 0, 0);
          } else if (houseSubTime < 4.4) {
            // BONK! HOUSE WALL/CORNER IMPACT & RECOIL!
            const stunT = (houseSubTime - 2.8) / 1.6;
            stunGroup.visible = true;
            eyeMat.color.setHex(0xfbbf24);

            const hitPos = treeDetourPoints[treeDetourPoints.length - 1]; // (0.68, -0.45, 0.55)
            const recoilDisp = Math.sin(Math.min(1.0, stunT * 1.8) * Math.PI) * 0.38;
            // Recoil backwards along incident angle
            ogreGroup.position.set(hitPos.x - recoilDisp * 0.8, -0.52, hitPos.z + recoilDisp * 0.5);

            torsoGroup.rotation.x = -0.45;
            torsoGroup.position.y = 0.52;
            leftLegGroup.rotation.x = -0.6;
            rightLegGroup.rotation.x = -0.6;
            leftArmGroup.rotation.x = 0.3;
            rightArmGroup.rotation.x = -0.2;
            clubGroup.rotation.z = 1.2;

            headGroup.rotation.z = Math.sin(elapsed * 16) * 0.24;
            headGroup.rotation.y = Math.cos(elapsed * 12) * 0.2;

            for (let s = 0; s < starCount; s++) {
              const starAngle = elapsed * 8 + (s * Math.PI * 2) / starCount;
              stunStarMeshes[s].position.set(
                Math.cos(starAngle) * 0.32,
                Math.sin(elapsed * 10 + s) * 0.06,
                Math.sin(starAngle) * 0.32
              );
              stunStarMeshes[s].rotation.y = elapsed * 10;
              stunStarMeshes[s].rotation.x = elapsed * 7;
            }
          }
        } else {
          // --- STAGE 3: STAND UP & SMOOTHLY TROT BACK VIA DETOUR (8.6s - 11.0s) ---
          const returnSubTime = subTime - 8.6;
          stunGroup.visible = false;
          eyeMat.color.setHex(0x38bdf8);

          const t = Math.min(1.0, returnSubTime / 2.4);
          const pos = returnDetourCurve.getPointAt(t);
          const tangent = returnDetourCurve.getTangentAt(t);

          ogreGroup.position.copy(pos);
          const lookAngle = Math.atan2(tangent.x, tangent.z);
          ogreGroup.rotation.set(0, lookAngle, 0);

          walkPhase += delta * 10.5;
          leftLegGroup.rotation.x = Math.sin(walkPhase) * 0.5;
          rightLegGroup.rotation.x = -Math.sin(walkPhase) * 0.5;
          leftArmGroup.rotation.x = -Math.sin(walkPhase) * 0.45;
          rightArmGroup.rotation.x = Math.sin(walkPhase) * 0.45;

          torsoGroup.rotation.x = 0.1;
          torsoGroup.position.y = 0.62 + Math.abs(Math.sin(walkPhase)) * 0.03;
          headGroup.rotation.set(0, 0, 0);
          clubGroup.rotation.z = 0.25;
        }
      } else {
        // --- PHASE 2: SMART CONTINUOUS RUNNING AT 60 FPS (>= 75% PROGRESS) ---
        // Runs continuously every frame without any stop-frames or freezes!
        stunGroup.visible = false;
        eyeMat.color.setHex(0x34d399); // green navmesh eyes
        smartNavMat.opacity = 0.85;

        // Continuous smooth time-based loop progress (runs full lap every ~5.8 seconds)
        smartNavLapTime += delta * 0.17;
        const lapT = smartNavLapTime % 1.0;

        const isFinished = currentProgress >= 0.99;

        if (!isFinished) {
          // BUTTERY SMOOTH CONTINUOUS PATROL RUN
          goalRingMat.color.setHex(0x34d399);

          const pos = smartNavLoopCurve.getPointAt(lapT);
          const tangent = smartNavLoopCurve.getTangentAt(lapT);

          ogreGroup.position.copy(pos);

          const lookAngle = Math.atan2(tangent.x, tangent.z);
          ogreGroup.rotation.set(0, lookAngle, 0);

          // Continuous fluid leg cycle (smooth 60 fps stride synced to delta)
          walkPhase += delta * 12.0;
          leftLegGroup.rotation.x = Math.sin(walkPhase) * 0.6;
          rightLegGroup.rotation.x = -Math.sin(walkPhase) * 0.6;
          leftArmGroup.rotation.x = -Math.sin(walkPhase) * 0.5;
          rightArmGroup.rotation.x = Math.sin(walkPhase) * 0.5;

          torsoGroup.rotation.x = 0.14;
          torsoGroup.position.y = 0.62 + Math.abs(Math.sin(walkPhase)) * 0.04;
          headGroup.rotation.set(0, 0, 0);
          clubGroup.rotation.z = 0.3;
        } else {
          // VICTORY POSE AT THE DESTINATION BEACON WHEN 100% READY!
          ogreGroup.position.set(3.0, -0.42, 0.4);
          ogreGroup.rotation.set(0, -Math.PI / 4, 0);

          torsoGroup.rotation.x = -0.1;
          torsoGroup.position.y = 0.64;
          leftLegGroup.rotation.set(0, 0, -0.2);
          rightLegGroup.rotation.set(0, 0, 0.2);

          // Triumphant club cheer
          rightArmGroup.rotation.x = -1.4;
          rightArmGroup.rotation.z = -0.4;
          clubGroup.rotation.z = -0.6 + Math.sin(elapsed * 6) * 0.2;
          leftArmGroup.rotation.x = -0.8;
          headGroup.rotation.x = -0.2;

          goalRingMat.color.setHex(0x10b981);
          goalRingMesh.scale.setScalar(1.0 + Math.sin(elapsed * 8) * 0.25);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // 15. Resize Observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 115;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 16. Resource Cleanup
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
      bgCone1Geo.dispose();
      bgCone2Geo.dispose();
      houseBoxGeo.dispose();
      roofGeo.dispose();
      barnGeo.dispose();
      beaconSphereGeo.dispose();
      b1LineGeo.dispose();
      b2LineGeo.dispose();
      goalRingGeo.dispose();
      laserGeo.dispose();
      flareGeo.dispose();
      loopGeo.dispose();
      energyOrbGeo.dispose();
      particleGeo.dispose();
      torsoGeo.dispose();
      headGeo.dispose();
      hornGeo.dispose();
      eyeGeo.dispose();
      stunStarGeo.dispose();
      armGeo.dispose();
      armWireGeo.dispose();
      clubHandleGeo.dispose();
      clubHeadGeo.dispose();
      legGeo.dispose();
      legWireGeo.dispose();
      ogreAuraGeo.dispose();
      smartNavGeo.dispose();

      // Materials
      terrainWireMat.dispose();
      scanRingMat.dispose();
      beaconMat.dispose();
      beaconPulseMat.dispose();
      b2HeadMat.dispose();
      goalRingMat.dispose();
      laserMat.dispose();
      flareMat.dispose();
      loopMat.dispose();
      energyOrbMat.dispose();
      particleMat.dispose();
      ogreWireMat.dispose();
      ogreCoreMat.dispose();
      hornMat.dispose();
      eyeMat.dispose();
      stunStarMat.dispose();
      clubHandleMat.dispose();
      clubHeadMat.dispose();
      ogreAuraMat.dispose();
      smartNavMat.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [language]);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-[115px] sm:h-[125px] rounded-xl overflow-hidden bg-[#0c090c] border-2 border-[#5a4422] shadow-[inset_0_0_35px_rgba(0,0,0,0.95)] ${className}`}
    >
      {/* Top HUD Badges */}
      <div className="absolute top-2 left-2.5 text-[9px] sm:text-[9.5px] font-fantasy text-[#f5d17f] font-bold tracking-wider z-20 drop-shadow-[0_0_8px_rgba(240,178,50,0.7)] pointer-events-none flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444] animate-ping inline-block" />
        <span>
          {stageName === 'models'
            ? language === 'en'
              ? `ZONE OBJECTS: ${Math.round(progress * 100)}%`
              : `ОБЪЕКТЫ ЗОНЫ: ${Math.round(progress * 100)}%`
            : stageName === 'tiles'
            ? language === 'en'
              ? `ZONE MAP: ${Math.round(progress * 100)}%`
              : `КАРТА ЗОНЫ: ${Math.round(progress * 100)}%`
            : language === 'en'
            ? `NAVMESH: ${Math.round(progress * 100)}%`
            : `НАВМЕШ ЗОНЫ: ${Math.round(progress * 100)}%`}
        </span>
      </div>

      <div className="absolute top-2 right-2.5 text-[8.5px] sm:text-[9px] font-fantasy text-[#f5d17f]/80 font-bold tracking-widest z-20 pointer-events-none">
        {language === 'en' ? 'OGRE 3D SIMULATION' : 'СИМУЛЯЦИЯ ОГРА 3D'}
      </div>
    </div>
  );
};
