import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface OgreRunnerSceneProps {
  isRunning: boolean;
  speedMultiplier?: number;
  onProgress?: (progress: number) => void;
  onCollision?: (obstacleName: string) => void;
}

export const OgreRunnerScene: React.FC<OgreRunnerSceneProps> = ({
  isRunning,
  speedMultiplier = 1,
  onProgress,
  onCollision,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isRunningRef = useRef(isRunning);
  const speedRef = useRef(speedMultiplier);
  const onProgressRef = useRef(onProgress);
  const onCollisionRef = useRef(onCollision);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    speedRef.current = speedMultiplier;
  }, [speedMultiplier]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    onCollisionRef.current = onCollision;
  }, [onCollision]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL Guard (r160+)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 2. Scene & Camera
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, width / height, 10, 3000);
    camera.position.set(220, 720, 720);
    camera.lookAt(220, 0, -20);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Studio Environment map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Lighting
    const dirLight = new THREE.DirectionalLight(0xfff3e0, 2.4);
    dirLight.position.set(250, 800, 350);
    dirLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 100;
      dirLight.shadow.camera.far = 1800;
      const d = 600;
      dirLight.shadow.camera.left = -d;
      dirLight.shadow.camera.right = d;
      dirLight.shadow.camera.top = d;
      dirLight.shadow.camera.bottom = -d;
      dirLight.shadow.bias = -0.0005;
    }
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0x526075, 0x161a22, 1.2);
    scene.add(hemiLight);

    const amberKey = new THREE.PointLight(0xf5b041, 1.8, 900);
    amberKey.position.set(200, 180, 0);
    scene.add(amberKey);

    // 4. Closed 3D Curve mapped exactly to the yellow route trajectory
    const routePoints: THREE.Vector3[] = [
      new THREE.Vector3(15, 0, 45),     // P1: Left lobe peak
      new THREE.Vector3(75, 0, -35),    // P2
      new THREE.Vector3(125, 0, -35),   // P3
      new THREE.Vector3(205, 0, -75),   // P4
      new THREE.Vector3(225, 0, -155),  // P5: Obstacle 1: Домик (House)
      new THREE.Vector3(255, 0, -215),  // P6
      new THREE.Vector3(345, 0, -255),  // P7: Top ridge
      new THREE.Vector3(425, 0, -215),  // P8
      new THREE.Vector3(455, 0, -75),   // P9: Downhill
      new THREE.Vector3(445, 0, 85),    // P10: Obstacle 2: Камушек (Rock)
      new THREE.Vector3(485, 0, 155),   // P11
      new THREE.Vector3(465, 0, 245),   // P12: Obstacle 3: Дерево (Pine Tree)
      new THREE.Vector3(385, 0, 265),   // P13: South bend
      new THREE.Vector3(295, 0, 225),   // P14
      new THREE.Vector3(215, 0, 205),   // P15
      new THREE.Vector3(145, 0, 145),   // P16
      new THREE.Vector3(55, 0, 135),    // P17
      new THREE.Vector3(-5, 0, 95),     // P18
    ];

    const routeCurve = new THREE.CatmullRomCurve3(routePoints, true, 'centripetal', 0.4);

    // Common PBR Materials
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5a3e28,
      roughness: 0.85,
      metalness: 0.05,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x3e4249,
      roughness: 0.9,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x7c2d12,
      roughness: 0.65,
    });
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.95,
      metalness: 0.1,
    });
    const pineBarkMat = new THREE.MeshStandardMaterial({
      color: 0x3d2817,
      roughness: 0.9,
    });
    const pineNeedlesMat = new THREE.MeshStandardMaterial({
      color: 0x1c3822,
      roughness: 0.8,
    });
    const starGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.9,
    });

    // =========================================================================
    // GLOWING YELLOW ROUTE LINE IN 3D (The Ogre runs directly on this yellow path!)
    // =========================================================================
    const trackGeom = new THREE.TubeGeometry(routeCurve, 220, 2.4, 8, true);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0xf5b041,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.4,
      roughness: 0.25,
      metalness: 0.3,
    });
    const trackMesh = new THREE.Mesh(trackGeom, trackMat);
    scene.add(trackMesh);

    // Outer soft golden bloom
    const glowTrackGeom = new THREE.TubeGeometry(routeCurve, 220, 6.2, 8, true);
    const glowTrackMat = new THREE.MeshBasicMaterial({
      color: 0xf5b041,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const glowTrackMesh = new THREE.Mesh(glowTrackGeom, glowTrackMat);
    scene.add(glowTrackMesh);

    // Directional Chevrons along the yellow line
    for (let t = 0.04; t < 0.98; t += 0.08) {
      const p = routeCurve.getPointAt(t);
      const tangent = routeCurve.getTangentAt(t).normalize();
      const chevron = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 7.5, 4),
        new THREE.MeshBasicMaterial({ color: 0xfff4cc })
      );
      chevron.position.copy(p);
      chevron.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      scene.add(chevron);
    }

    // Waypoint Golden Rings
    const waypointT = [0.12, 0.32, 0.42, 0.6, 0.78, 0.92];
    for (const wt of waypointT) {
      const p = routeCurve.getPointAt(wt);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(6.5, 1.3, 8, 20),
        new THREE.MeshBasicMaterial({ color: 0xffeedd })
      );
      ring.position.copy(p);
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
    }

    // =========================================================================
    // OBSTACLE 1: Домик (Tavern House) at t ≈ 0.22
    // =========================================================================
    const houseGroup = new THREE.Group();
    const housePos = routeCurve.getPointAt(0.22);
    houseGroup.position.copy(housePos);
    houseGroup.position.x += 16;
    houseGroup.position.z -= 10;

    const houseBase = new THREE.Mesh(new THREE.BoxGeometry(36, 22, 28), woodMat);
    houseBase.position.y = 11;
    houseBase.castShadow = !isSoftwareGl;
    houseBase.receiveShadow = !isSoftwareGl;
    houseGroup.add(houseBase);

    const foundation = new THREE.Mesh(new THREE.BoxGeometry(40, 5, 32), stoneMat);
    foundation.position.y = 2.5;
    houseGroup.add(foundation);

    const roofGeom = new THREE.ConeGeometry(26, 16, 4);
    roofGeom.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = 27;
    roof.scale.set(1.1, 1, 1.4);
    roof.castShadow = !isSoftwareGl;
    houseGroup.add(roof);

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(6, 22, 6), stoneMat);
    chimney.position.set(10, 24, -5);
    houseGroup.add(chimney);

    scene.add(houseGroup);

    // =========================================================================
    // OBSTACLE 2: Камушек (3D Rock / Boulder) at t ≈ 0.48
    // =========================================================================
    const rockGroup = new THREE.Group();
    const rockPos = routeCurve.getPointAt(0.48);
    rockGroup.position.copy(rockPos);
    rockGroup.position.x += 8;
    rockGroup.position.z += 6;

    // Chunky faceted rock
    const rockGeom = new THREE.DodecahedronGeometry(13, 1);
    // Displace vertices slightly for organic boulder look
    const posAttr = rockGeom.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      posAttr.setXYZ(
        i,
        vx * (0.85 + (i % 5) * 0.06),
        vy * (0.7 + (i % 3) * 0.1),
        vz * (0.9 + (i % 4) * 0.05)
      );
    }
    rockGeom.computeVertexNormals();

    const boulderMesh = new THREE.Mesh(rockGeom, rockMat);
    boulderMesh.position.y = 7;
    boulderMesh.rotation.set(0.3, 0.8, -0.2);
    boulderMesh.castShadow = !isSoftwareGl;
    boulderMesh.receiveShadow = !isSoftwareGl;
    rockGroup.add(boulderMesh);

    scene.add(rockGroup);

    // =========================================================================
    // OBSTACLE 3: Дерево (Pine Tree) at t ≈ 0.68
    // =========================================================================
    const pineGroup = new THREE.Group();
    const pinePos = routeCurve.getPointAt(0.68);
    pineGroup.position.copy(pinePos);
    pineGroup.position.x += 14;
    pineGroup.position.z += 8;

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 42, 8), pineBarkMat);
    trunk.position.y = 21;
    trunk.rotation.z = 0.07;
    trunk.castShadow = !isSoftwareGl;
    pineGroup.add(trunk);

    const pineTier1 = new THREE.Mesh(new THREE.ConeGeometry(22, 20, 7), pineNeedlesMat);
    pineTier1.position.y = 28;
    pineTier1.castShadow = !isSoftwareGl;
    pineGroup.add(pineTier1);

    const pineTier2 = new THREE.Mesh(new THREE.ConeGeometry(17, 18, 7), pineNeedlesMat);
    pineTier2.position.y = 41;
    pineTier2.castShadow = !isSoftwareGl;
    pineGroup.add(pineTier2);

    const pineTier3 = new THREE.Mesh(new THREE.ConeGeometry(12, 16, 7), pineNeedlesMat);
    pineTier3.position.y = 52;
    pineTier3.castShadow = !isSoftwareGl;
    pineGroup.add(pineTier3);

    scene.add(pineGroup);

    // =========================================================================
    // 3D WARCRAFT OGRE RUNNER (Runs directly on yellow line)
    // =========================================================================
    const ogreRoot = new THREE.Group();

    const ogreSkinMat = new THREE.MeshStandardMaterial({
      color: 0x486b3b,
      roughness: 0.75,
      metalness: 0.05,
    });
    const ogreIronMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.4,
      metalness: 0.85,
    });
    const ogreLeatherMat = new THREE.MeshStandardMaterial({
      color: 0x3f2214,
      roughness: 0.8,
    });
    const ogreTuskMat = new THREE.MeshStandardMaterial({
      color: 0xfaf5e4,
      roughness: 0.3,
    });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(16, 18, 12), ogreSkinMat);
    torso.position.y = 18;
    torso.castShadow = !isSoftwareGl;
    ogreRoot.add(torso);

    // Belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(17, 4, 13), ogreLeatherMat);
    belt.position.y = 11;
    ogreRoot.add(belt);

    // Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 29, 2);

    const head = new THREE.Mesh(new THREE.BoxGeometry(11, 10, 11), ogreSkinMat);
    headGroup.add(head);

    const helmet = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 12), ogreIronMat);
    helmet.position.y = 4;
    headGroup.add(helmet);

    // Horns
    const hornGeom = new THREE.ConeGeometry(2, 7, 5);
    const leftHorn = new THREE.Mesh(hornGeom, ogreTuskMat);
    leftHorn.position.set(-6.5, 6, 0);
    leftHorn.rotation.z = Math.PI / 3;
    headGroup.add(leftHorn);

    const rightHorn = new THREE.Mesh(hornGeom, ogreTuskMat);
    rightHorn.position.set(6.5, 6, 0);
    rightHorn.rotation.z = -Math.PI / 3;
    headGroup.add(rightHorn);

    // Tusks
    const tuskGeom = new THREE.ConeGeometry(1.2, 4.5, 4);
    const leftTusk = new THREE.Mesh(tuskGeom, ogreTuskMat);
    leftTusk.position.set(-3, -3, 6);
    leftTusk.rotation.x = -Math.PI / 5;
    headGroup.add(leftTusk);

    const rightTusk = new THREE.Mesh(tuskGeom, ogreTuskMat);
    rightTusk.position.set(3, -3, 6);
    rightTusk.rotation.x = -Math.PI / 5;
    headGroup.add(rightTusk);

    ogreRoot.add(headGroup);

    // Spiked Pauldron
    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(7, 6, 9), ogreIronMat);
    pauldron.position.set(-10, 26, 0);
    ogreRoot.add(pauldron);

    // Arms
    const leftArm = new THREE.Group();
    leftArm.position.set(-10, 22, 0);
    const leftBicep = new THREE.Mesh(new THREE.BoxGeometry(5.5, 12, 5.5), ogreSkinMat);
    leftBicep.position.y = -6;
    leftArm.add(leftBicep);
    ogreRoot.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(10, 22, 0);
    const rightBicep = new THREE.Mesh(new THREE.BoxGeometry(5.5, 12, 5.5), ogreSkinMat);
    rightBicep.position.y = -6;
    rightArm.add(rightBicep);

    const clubHandle = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 18, 6), woodMat);
    clubHandle.position.set(0, -11, 5);
    clubHandle.rotation.x = Math.PI / 2.2;
    rightArm.add(clubHandle);

    const clubHead = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 8), ogreIronMat);
    clubHead.position.set(0, -11, 14);
    rightArm.add(clubHead);
    ogreRoot.add(rightArm);

    // Legs
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-5, 10, 0);
    const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6), ogreLeatherMat);
    leftThigh.position.y = -6;
    leftLeg.add(leftThigh);
    ogreRoot.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(5, 10, 0);
    const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6), ogreLeatherMat);
    rightThigh.position.y = -6;
    rightLeg.add(rightThigh);
    ogreRoot.add(rightLeg);

    // Dazed Stars
    const starsGroup = new THREE.Group();
    starsGroup.position.set(0, 42, 2);
    starsGroup.visible = false;
    const starGeom = new THREE.OctahedronGeometry(2.5, 0);
    const star1 = new THREE.Mesh(starGeom, starGoldMat);
    star1.position.set(6, 0, 0);
    starsGroup.add(star1);
    const star2 = new THREE.Mesh(starGeom, starGoldMat);
    star2.position.set(-6, 0, 0);
    starsGroup.add(star2);
    const star3 = new THREE.Mesh(starGeom, starGoldMat);
    star3.position.set(0, 0, 6);
    starsGroup.add(star3);
    ogreRoot.add(starsGroup);

    // Soft Shadow
    const shadowGeo = new THREE.PlaneGeometry(24, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.2;
    ogreRoot.add(contactShadow);

    scene.add(ogreRoot);

    // 5. Animation Loop & State Machine
    let routeProgress = 0.05;
    let state: 'RUNNING' | 'CRASH_HOUSE' | 'TRIP_ROCK' | 'BUMP_TREE' = 'RUNNING';
    let stateTimer = 0;
    let lastTime = performance.now();
    let frameId = 0;
    let houseShake = 0;
    let treeShake = 0;

    const tick = (now: number) => {
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Obstacle shake animations
      if (houseShake > 0) {
        houseGroup.position.x = housePos.x + 16 + (Math.random() - 0.5) * houseShake * 3;
        houseShake = Math.max(0, houseShake - delta * 2.5);
      } else {
        houseGroup.position.x = housePos.x + 16;
      }

      if (treeShake > 0) {
        pineGroup.rotation.z = Math.sin(now * 0.035) * treeShake * 0.3;
        treeShake = Math.max(0, treeShake - delta * 2);
      } else {
        pineGroup.rotation.z = 0;
      }

      if (state === 'RUNNING') {
        starsGroup.visible = false;
        const runSpeed = 0.04 * speedRef.current;
        routeProgress += delta * runSpeed;
        if (routeProgress >= 1) {
          routeProgress = 1;
          onProgressRef.current?.(100);
        } else {
          onProgressRef.current?.(Math.round(routeProgress * 100));
        }

        // 1. Crash into House (Домик) at t ≈ 0.215
        if (routeProgress >= 0.215 && routeProgress <= 0.228) {
          state = 'CRASH_HOUSE';
          stateTimer = 1.4;
          houseShake = 1.0;
          onCollisionRef.current?.('Домик');
        }
        // 2. Trip over Rock (Камушек) at t ≈ 0.475
        else if (routeProgress >= 0.475 && routeProgress <= 0.488) {
          state = 'TRIP_ROCK';
          stateTimer = 1.2;
          onCollisionRef.current?.('Камушек');
        }
        // 3. Bump into Tree (Дерево) at t ≈ 0.675
        else if (routeProgress >= 0.675 && routeProgress <= 0.688) {
          state = 'BUMP_TREE';
          stateTimer = 1.4;
          treeShake = 1.0;
          onCollisionRef.current?.('Дерево');
        }

        // Running kinematics along the route curve
        const currentPos = routeCurve.getPointAt(routeProgress);
        const lookAheadProgress = (routeProgress + 0.01) % 1;
        const forwardPos = routeCurve.getPointAt(lookAheadProgress);

        ogreRoot.position.copy(currentPos);
        ogreRoot.lookAt(forwardPos.x, currentPos.y, forwardPos.z);

        const runCycle = now * 0.012 * speedRef.current;
        leftLeg.rotation.x = Math.sin(runCycle) * 0.75;
        rightLeg.rotation.x = -Math.sin(runCycle) * 0.75;
        leftArm.rotation.x = -Math.sin(runCycle) * 0.7;
        rightArm.rotation.x = Math.sin(runCycle) * 0.7;

        torso.position.y = 18 + Math.abs(Math.sin(runCycle * 2)) * 3;
        headGroup.rotation.y = Math.sin(runCycle) * 0.15;
      } else if (state === 'CRASH_HOUSE') {
        // Crash into House: recoil back, stars above head
        stateTimer -= delta;
        starsGroup.visible = true;
        starsGroup.rotation.y += delta * 6;

        ogreRoot.rotation.y += delta * 1.5;
        torso.position.y = 14 + Math.sin(now * 0.01) * 2;
        leftArm.rotation.z = -1.2;
        rightArm.rotation.z = 1.2;
        headGroup.rotation.x = -0.4;

        if (stateTimer <= 0) {
          state = 'RUNNING';
          routeProgress = 0.235;
        }
      } else if (state === 'TRIP_ROCK') {
        // Trip over Rock: stumble forward, wave arms, regain balance
        stateTimer -= delta;
        torso.position.y = 13;
        headGroup.rotation.x = 0.5; // Leaning forward
        leftArm.rotation.x = 1.5;
        rightArm.rotation.x = 1.5;

        if (stateTimer <= 0) {
          state = 'RUNNING';
          routeProgress = 0.495;
        }
      } else if (state === 'BUMP_TREE') {
        // Bump Tree: rub forehead, funny head wobble
        stateTimer -= delta;
        starsGroup.visible = true;
        starsGroup.rotation.y += delta * 5;

        torso.position.y = 12;
        rightArm.rotation.x = 1.8; // Hand to head
        headGroup.rotation.z = Math.sin(now * 0.01) * 0.3;

        if (stateTimer <= 0) {
          state = 'RUNNING';
          routeProgress = 0.695;
        }
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
    />
  );
};
