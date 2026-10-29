import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RotateCcw, ZoomIn, ZoomOut, Compass, Eye, EyeOff, Radio } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface Tactical3DMapSceneProps {
  isRouteLoading: boolean;
  isRouteVisible: boolean;
  speedMultiplier?: number;
  onProgress?: (progress: number) => void;
  onCollision?: (obstacleName: string) => void;
  theme?: 'dark' | 'light';
  language?: 'ru' | 'en';
}

// Procedural elevation function for smooth tactical mountains and plateaus (Zero pits or holes)
export function getTerrainHeight(x: number, z: number): number {
  const nx = x * 0.0022;
  const nz = z * 0.0022;

  // Gentle rolling foundation (always smooth and positive)
  let h = (Math.sin(nx * 2.2 + 0.8) * Math.cos(nz * 2.0) + 1.0) * 16;

  // Scenic, smooth mountain ridges on perimeter (smooth ridged multifractal)
  const n1 = Math.sin(nx * 4.5 + nz * 3.0) * Math.cos(nx * 3.2 - nz * 3.8);
  const ridge = 1.0 - Math.abs(n1);
  h += Math.pow(ridge, 2.5) * 55;

  // Soft secondary hills
  const n2 = Math.cos(nx * 6.0 - nz * 2.5) * Math.sin(nz * 5.5);
  h += Math.max(0, n2) * 22;

  // Gentle micro-relief for texture (no sharp holes)
  h += (Math.sin(nx * 12.0) * Math.cos(nz * 11.0) + 1.0) * 2.5;

  // Smooth circular boundary fade
  const distFromCenter = Math.sqrt(x * x + z * z) / 850;
  const edgeDamp = Math.max(0, 1.0 - Math.pow(Math.min(1.0, distFromCenter), 3.0));

  // Strictly non-negative: absolute zero pits/holes, smooth navigable terrain
  return Math.max(2.0, h * edgeDamp);
}

export const Tactical3DMapScene: React.FC<Tactical3DMapSceneProps> = ({
  isRouteLoading,
  isRouteVisible,
  speedMultiplier = 1,
  onProgress,
  onCollision,
  theme = 'dark',
  language = 'ru',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isRu = language === 'ru';

  // Interactive HUD telemetry state
  const [telemetry, setTelemetry] = useState<{ x: number; z: number; alt: number }>({
    x: 220,
    z: 45,
    alt: 88,
  });
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showWireframeGrid, setShowWireframeGrid] = useState<boolean>(true);

  // References for animation loop
  const isRouteLoadingRef = useRef(isRouteLoading);
  const isRouteVisibleRef = useRef(isRouteVisible);
  const speedRef = useRef(speedMultiplier);
  const onProgressRef = useRef(onProgress);
  const onCollisionRef = useRef(onCollision);
  const autoRotateRef = useRef(autoRotate);
  const showGridRef = useRef(showWireframeGrid);
  const resetCameraRef = useRef<() => void>(() => {});
  const zoomByRef = useRef<(delta: number) => void>(() => {});

  useEffect(() => {
    isRouteLoadingRef.current = isRouteLoading;
  }, [isRouteLoading]);

  useEffect(() => {
    isRouteVisibleRef.current = isRouteVisible;
  }, [isRouteVisible]);

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
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    showGridRef.current = showWireframeGrid;
  }, [showWireframeGrid]);

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

    // 2. Scene & Atmospheric Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0f12);
    scene.fog = new THREE.FogExp2(0x0d0f12, 0.0009);

    // 3. Perspective Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 10, 4500);
    const initialCamPos = new THREE.Vector3(260, 780, 780);
    const initialTarget = new THREE.Vector3(260, 20, -10);
    camera.position.copy(initialCamPos);
    camera.lookAt(initialTarget);

    // 4. Modern Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      alpha: false,
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 5. OrbitControls for free interactive manipulation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.copy(initialTarget);
    controls.maxPolarAngle = Math.PI / 2.15; // Don't go below ground level
    controls.minPolarAngle = Math.PI / 7.5;  // Top view limit
    controls.minDistance = 300;
    controls.maxDistance = 1600;
    controls.enablePan = true;
    controls.panSpeed = 0.8;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 1.0;

    resetCameraRef.current = () => {
      camera.position.copy(initialCamPos);
      controls.target.copy(initialTarget);
      controls.update();
    };

    zoomByRef.current = (delta: number) => {
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.addScaledVector(dir, delta);
      controls.update();
    };

    // Mandatory RoomEnvironment Reflection Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 6. Tactical Lighting Setup
    // Warm key directional light (side grazing light revealing mountain relief & casting long shadows)
    const sunLight = new THREE.DirectionalLight(0xffecd2, 2.2);
    sunLight.position.set(450, 950, 400);
    sunLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 100;
      sunLight.shadow.camera.far = 2400;
      const d = 800;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0006;
    }
    scene.add(sunLight);

    // Cool slate ambient fill (soft shadows in valleys)
    const hemiLight = new THREE.HemisphereLight(0x475569, 0x0f1318, 1.35);
    scene.add(hemiLight);

    // Tactical warm amber accent light near the route
    const tacticalAmberLight = new THREE.PointLight(0xf5b041, 1.8, 1100);
    tacticalAmberLight.position.set(260, 240, -20);
    scene.add(tacticalAmberLight);

    // 7. REAL 3D TOPOGRAPHIC TERRAIN MESH
    const terrainSize = 1400;
    const segments = 130;
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    const vertexColors = new Float32Array(posAttr.count * 3);

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = getTerrainHeight(vx, vz);
      posAttr.setY(i, vy);

      // Vertex color gradients based on elevation
      // Valleys: dark charcoal/slate (#12151b) -> Lowlands: moss/conifer (#1a2522) -> Peaks: pale graphite/frost (#64748b to #cbd5e1)
      const normY = THREE.MathUtils.clamp((vy + 10) / 160, 0, 1);
      let r = 0.07;
      let g = 0.09;
      let b = 0.12;

      if (normY < 0.35) {
        // Valleys & riverbeds
        const t = normY / 0.35;
        r = THREE.MathUtils.lerp(0.06, 0.11, t);
        g = THREE.MathUtils.lerp(0.08, 0.16, t);
        b = THREE.MathUtils.lerp(0.11, 0.18, t);
      } else if (normY < 0.75) {
        // Mountain slopes
        const t = (normY - 0.35) / 0.4;
        r = THREE.MathUtils.lerp(0.11, 0.28, t);
        g = THREE.MathUtils.lerp(0.16, 0.34, t);
        b = THREE.MathUtils.lerp(0.18, 0.42, t);
      } else {
        // High frosty ridges
        const t = (normY - 0.75) / 0.25;
        r = THREE.MathUtils.lerp(0.28, 0.75, t);
        g = THREE.MathUtils.lerp(0.34, 0.82, t);
        b = THREE.MathUtils.lerp(0.42, 0.92, t);
      }

      vertexColors[i * 3] = r;
      vertexColors[i * 3 + 1] = g;
      vertexColors[i * 3 + 2] = b;
    }

    terrainGeo.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3));
    terrainGeo.computeVertexNormals();

    // Custom tactical topographic contour line shader on terrain
    const terrainUniforms = {
      uTime: { value: 0 },
      uGridOpacity: { value: 0.85 },
      uRadarCenter: { value: new THREE.Vector2(260, -10) },
    };

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.12,
      flatShading: false,
    });

    // Inject topographic isolines & tactical radar sweep into terrain shader
    terrainMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = terrainUniforms.uTime;
      shader.uniforms.uGridOpacity = terrainUniforms.uGridOpacity;
      shader.uniforms.uRadarCenter = terrainUniforms.uRadarCenter;

      shader.vertexShader = `
        varying vec3 vWorldPos;
        varying float vElevation;
        ${shader.vertexShader}
      `.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vElevation = vWorldPos.y;
        `
      );

      shader.fragmentShader = `
        uniform float uTime;
        uniform float uGridOpacity;
        uniform vec2 uRadarCenter;
        varying vec3 vWorldPos;
        varying float vElevation;
        ${shader.fragmentShader}
      `.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>

        // 1. Sleek Topographic Height Contour Lines (Isolines)
        float contourMinor = abs(fract(vElevation / 14.0) - 0.5) * 2.0;
        float isLineMinor = 1.0 - smoothstep(0.0, 0.08, contourMinor);

        float contourMajor = abs(fract(vElevation / 56.0) - 0.5) * 2.0;
        float isLineMajor = 1.0 - smoothstep(0.0, 0.05, contourMajor);

        // Subtle glowing white/amber elevation lines
        vec3 isolineColor = mix(vec3(0.5, 0.6, 0.75), vec3(0.96, 0.72, 0.28), isLineMajor);
        float lineStrength = (isLineMinor * 0.18 + isLineMajor * 0.45) * uGridOpacity;
        gl_FragColor.rgb += isolineColor * lineStrength;

        // 2. Tactical Coordinate Grid (every 60 units)
        float gridX = abs(fract(vWorldPos.x / 60.0) - 0.5) * 2.0;
        float gridZ = abs(fract(vWorldPos.z / 60.0) - 0.5) * 2.0;
        float gridLine = max(1.0 - smoothstep(0.0, 0.035, gridX), 1.0 - smoothstep(0.0, 0.035, gridZ));
        gl_FragColor.rgb += vec3(0.3, 0.4, 0.55) * gridLine * 0.14 * uGridOpacity;

        // 3. Sweeping Tactical Radar Wave
        float radarDist = length(vWorldPos.xz - uRadarCenter);
        float radarWave = sin(radarDist * 0.016 - uTime * 2.2);
        float radarPulse = smoothstep(0.85, 1.0, radarWave) * 0.22;
        gl_FragColor.rgb += vec3(0.96, 0.72, 0.28) * radarPulse;
        `
      );
    };

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = !isSoftwareGl;
    scene.add(terrainMesh);

    // 8. FOREST CLUSTERS (Low-Poly Conifer Pines on Slopes)
    const treeCount = 380;
    const treeGeo = new THREE.ConeGeometry(5.5, 18, 5);
    treeGeo.translate(0, 9, 0);
    const treeMat = new THREE.MeshStandardMaterial({
      color: 0x16241a,
      roughness: 0.9,
      metalness: 0.05,
    });
    const instancedForest = new THREE.InstancedMesh(treeGeo, treeMat, treeCount);
    instancedForest.castShadow = !isSoftwareGl;
    instancedForest.receiveShadow = !isSoftwareGl;

    const dummy = new THREE.Object3D();
    let validTrees = 0;
    for (let i = 0; i < treeCount * 2 && validTrees < treeCount; i++) {
      // Scatter mainly around mid elevation valley sides
      const rx = (Math.random() - 0.5) * 900 + 150;
      const rz = (Math.random() - 0.5) * 900;
      const ry = getTerrainHeight(rx, rz);

      // Only place trees where height is hospitable (valleys/mid slopes, not bare peaks)
      if (ry > -5 && ry < 75) {
        const s = 0.75 + Math.random() * 0.5;
        dummy.position.set(rx, ry, rz);
        dummy.scale.set(s, s * (0.9 + Math.random() * 0.3), s);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.rotation.z = (Math.random() - 0.5) * 0.1;
        dummy.updateMatrix();
        instancedForest.setMatrixAt(validTrees, dummy.matrix);
        validTrees++;
      }
    }
    instancedForest.instanceMatrix.needsUpdate = true;
    scene.add(instancedForest);

    // =========================================================================
    // 9. 3D ROUTE CURVE & OBSTACLES (Synchronized with 3D terrain elevation)
    // =========================================================================
    const rawWaypoints = [
      new THREE.Vector3(15, 0, 45),     // P1
      new THREE.Vector3(75, 0, -35),    // P2
      new THREE.Vector3(125, 0, -35),   // P3
      new THREE.Vector3(205, 0, -75),   // P4
      new THREE.Vector3(225, 0, -155),  // P5: Obstacle 1: Домик (Tavern House)
      new THREE.Vector3(255, 0, -215),  // P6
      new THREE.Vector3(345, 0, -255),  // P7: Top ridge pass
      new THREE.Vector3(425, 0, -215),  // P8
      new THREE.Vector3(455, 0, -75),   // P9: Valley descent
      new THREE.Vector3(445, 0, 85),    // P10: Obstacle 2: Камушек (Rock boulder)
      new THREE.Vector3(485, 0, 155),   // P11
      new THREE.Vector3(465, 0, 245),   // P12: Obstacle 3: Дерево (Pine tree)
      new THREE.Vector3(385, 0, 265),   // P13: South bend
      new THREE.Vector3(295, 0, 225),   // P14
      new THREE.Vector3(215, 0, 205),   // P15
      new THREE.Vector3(145, 0, 145),   // P16
      new THREE.Vector3(55, 0, 135),    // P17
      new THREE.Vector3(-5, 0, 95),     // P18
    ];

    // Project raw waypoints onto the exact 3D terrain ground height (+2.5 elevation clearance)
    const routePoints: THREE.Vector3[] = rawWaypoints.map((pt) => {
      const terrainY = getTerrainHeight(pt.x, pt.z);
      return new THREE.Vector3(pt.x, terrainY + 2.5, pt.z);
    });

    const routeCurve = new THREE.CatmullRomCurve3(routePoints, true, 'centripetal', 0.35);

    // Route Group (Shown only during route loading/processing)
    const routeGroup = new THREE.Group();
    routeGroup.visible = isRouteLoading;
    scene.add(routeGroup);

    // Glowing Golden Yellow Route Ribbon
    const trackGeom = new THREE.TubeGeometry(routeCurve, 240, 2.6, 8, true);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0xf5b041,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.5,
      roughness: 0.25,
      metalness: 0.3,
    });
    const trackMesh = new THREE.Mesh(trackGeom, trackMat);
    routeGroup.add(trackMesh);

    // Outer soft golden bloom
    const glowTrackGeom = new THREE.TubeGeometry(routeCurve, 240, 6.5, 8, true);
    const glowTrackMat = new THREE.MeshBasicMaterial({
      color: 0xf5b041,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const glowTrackMesh = new THREE.Mesh(glowTrackGeom, glowTrackMat);
    routeGroup.add(glowTrackMesh);

    // Directional Chevrons along route
    for (let t = 0.04; t < 0.98; t += 0.08) {
      const p = routeCurve.getPointAt(t);
      const tangent = routeCurve.getTangentAt(t).normalize();
      const chevron = new THREE.Mesh(
        new THREE.ConeGeometry(3.5, 8.0, 4),
        new THREE.MeshBasicMaterial({ color: 0xfff4cc })
      );
      chevron.position.copy(p);
      chevron.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      routeGroup.add(chevron);
    }

    // Waypoint Golden Rings
    const waypointT = [0.12, 0.32, 0.42, 0.6, 0.78, 0.92];
    for (const wt of waypointT) {
      const p = routeCurve.getPointAt(wt);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(7.0, 1.4, 8, 20),
        new THREE.MeshBasicMaterial({ color: 0xffeedd })
      );
      ring.position.copy(p);
      ring.rotation.x = Math.PI / 2;
      routeGroup.add(ring);
    }

    // =========================================================================
    // OBSTACLE 1: Домик (Tavern House) at t ≈ 0.22 (Placed flush on 3D terrain)
    // =========================================================================
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 0.85 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3e4249, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.65 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.95 });
    const pineBarkMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.9 });
    const pineNeedlesMat = new THREE.MeshStandardMaterial({ color: 0x1c3822, roughness: 0.8 });

    const houseGroup = new THREE.Group();
    const housePos = routeCurve.getPointAt(0.22);
    const houseGroundY = getTerrainHeight(housePos.x + 14, housePos.z - 6);
    houseGroup.position.set(housePos.x + 14, houseGroundY, housePos.z - 6);

    const houseBase = new THREE.Mesh(new THREE.BoxGeometry(36, 22, 28), woodMat);
    houseBase.position.y = 11;
    houseBase.castShadow = !isSoftwareGl;
    houseBase.receiveShadow = !isSoftwareGl;
    houseGroup.add(houseBase);

    const foundation = new THREE.Mesh(new THREE.BoxGeometry(40, 6, 32), stoneMat);
    foundation.position.y = 3;
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

    routeGroup.add(houseGroup);

    // =========================================================================
    // OBSTACLE 2: Камушек (3D Rock / Boulder) at t ≈ 0.48 (Placed right on track)
    // =========================================================================
    const rockGroup = new THREE.Group();
    const rockPos = routeCurve.getPointAt(0.48);
    const rockGroundY = getTerrainHeight(rockPos.x, rockPos.z);
    rockGroup.position.set(rockPos.x, rockGroundY, rockPos.z);

    const rockGeom = new THREE.DodecahedronGeometry(13, 1);
    const rpos = rockGeom.attributes.position;
    for (let i = 0; i < rpos.count; i++) {
      const vx = rpos.getX(i);
      const vy = rpos.getY(i);
      const vz = rpos.getZ(i);
      rpos.setXYZ(
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

    routeGroup.add(rockGroup);

    // =========================================================================
    // OBSTACLE 3: Дерево (Pine Tree) at t ≈ 0.68
    // =========================================================================
    const pineGroup = new THREE.Group();
    const pinePos = routeCurve.getPointAt(0.68);
    const pineGroundY = getTerrainHeight(pinePos.x + 12, pinePos.z + 6);
    pineGroup.position.set(pinePos.x + 12, pineGroundY, pinePos.z + 6);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 44, 8), pineBarkMat);
    trunk.position.y = 22;
    trunk.rotation.z = 0.07;
    trunk.castShadow = !isSoftwareGl;
    pineGroup.add(trunk);

    const pineTier1 = new THREE.Mesh(new THREE.ConeGeometry(22, 20, 7), pineNeedlesMat);
    pineTier1.position.y = 29;
    pineTier1.castShadow = !isSoftwareGl;
    pineGroup.add(pineTier1);

    const pineTier2 = new THREE.Mesh(new THREE.ConeGeometry(17, 18, 7), pineNeedlesMat);
    pineTier2.position.y = 42;
    pineTier2.castShadow = !isSoftwareGl;
    pineGroup.add(pineTier2);

    const pineTier3 = new THREE.Mesh(new THREE.ConeGeometry(12, 16, 7), pineNeedlesMat);
    pineTier3.position.y = 53;
    pineTier3.castShadow = !isSoftwareGl;
    pineGroup.add(pineTier3);

    routeGroup.add(pineGroup);

    // =========================================================================
    // 10. 3D WARCRAFT OGRE (Runs directly along 3D yellow route line)
    // =========================================================================
    const ogreRoot = new THREE.Group();

    const ogreSkinMat = new THREE.MeshStandardMaterial({ color: 0x486b3b, roughness: 0.75 });
    const ogreIronMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4, metalness: 0.85 });
    const ogreLeatherMat = new THREE.MeshStandardMaterial({ color: 0x3f2214, roughness: 0.8 });
    const ogreTuskMat = new THREE.MeshStandardMaterial({ color: 0xfaf5e4, roughness: 0.3 });
    const starGoldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.9 });

    // Torso & Armor
    const torso = new THREE.Mesh(new THREE.BoxGeometry(16, 18, 12), ogreSkinMat);
    torso.position.y = 18;
    torso.castShadow = !isSoftwareGl;
    ogreRoot.add(torso);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(17, 4, 13), ogreLeatherMat);
    belt.position.y = 11;
    ogreRoot.add(belt);

    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 8), ogreIronMat);
    pauldron.position.set(-9, 24, 0);
    ogreRoot.add(pauldron);

    // Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 27, 2);
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(11, 10, 11), ogreSkinMat);
    headGroup.add(headMesh);

    const leftTusk = new THREE.Mesh(new THREE.ConeGeometry(1.2, 5, 4), ogreTuskMat);
    leftTusk.position.set(-3.5, -2, 5.5);
    leftTusk.rotation.x = -Math.PI / 3;
    headGroup.add(leftTusk);

    const rightTusk = new THREE.Mesh(new THREE.ConeGeometry(1.2, 5, 4), ogreTuskMat);
    rightTusk.position.set(3.5, -2, 5.5);
    rightTusk.rotation.x = -Math.PI / 3;
    headGroup.add(rightTusk);
    ogreRoot.add(headGroup);

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

    // Dazed Collision Stars
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

    // Shadow blob
    const shadowGeo = new THREE.PlaneGeometry(24, 24);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.2;
    ogreRoot.add(contactShadow);

    routeGroup.add(ogreRoot);

    // 11. Raycaster for Live Tactical Coordinate HUD
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(terrainMesh);
      if (intersects.length > 0) {
        const p = intersects[0].point;
        setTelemetry({
          x: Math.round(p.x),
          z: Math.round(p.z),
          alt: Math.round(p.y),
        });
      }
    };
    container.addEventListener('mousemove', handlePointerMove);

    // 12. Main Animation Loop
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

      // Update shader uniforms
      terrainUniforms.uTime.value = now * 0.001;
      terrainUniforms.uGridOpacity.value = showGridRef.current ? 0.85 : 0.2;

      // Auto rotation if toggled
      if (autoRotateRef.current) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.6;
      } else {
        controls.autoRotate = false;
      }
      controls.update();

      // Sync route visibility with loading state
      const isRouteActive = isRouteLoadingRef.current;
      routeGroup.visible = isRouteActive && isRouteVisibleRef.current;

      if (isRouteActive) {
        // Obstacle shake animations
        if (houseShake > 0) {
          houseGroup.position.x = housePos.x + 14 + (Math.random() - 0.5) * houseShake * 3;
          houseShake = Math.max(0, houseShake - delta * 2.5);
        } else {
          houseGroup.position.x = housePos.x + 14;
        }

        if (treeShake > 0) {
          pineGroup.rotation.z = Math.sin(now * 0.035) * treeShake * 0.3;
          treeShake = Math.max(0, treeShake - delta * 2);
        } else {
          pineGroup.rotation.z = 0;
        }

        const runSpeed = 0.04 * speedRef.current;

        if (state === 'RUNNING') {
          starsGroup.visible = false;
          routeProgress += delta * runSpeed;
          if (routeProgress >= 1) {
            routeProgress = 1;
            onProgressRef.current?.(100);
          } else {
            onProgressRef.current?.(Math.round(routeProgress * 100));
          }

          // Collisions
          if (routeProgress >= 0.215 && routeProgress <= 0.228) {
            state = 'CRASH_HOUSE';
            stateTimer = 1.4;
            houseShake = 1.0;
            onCollisionRef.current?.('Домик');
          } else if (routeProgress >= 0.475 && routeProgress <= 0.488) {
            state = 'TRIP_ROCK';
            stateTimer = 1.2;
            onCollisionRef.current?.('Камушек');
          } else if (routeProgress >= 0.675 && routeProgress <= 0.688) {
            state = 'BUMP_TREE';
            stateTimer = 1.4;
            treeShake = 1.0;
            onCollisionRef.current?.('Дерево');
          }

          // Kinematics along the 3D ground route
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
          stateTimer -= delta;
          torso.position.y = 13;
          headGroup.rotation.x = 0.5;
          leftArm.rotation.x = 1.5;
          rightArm.rotation.x = 1.5;
          if (stateTimer <= 0) {
            state = 'RUNNING';
            routeProgress = 0.495;
          }
        } else if (state === 'BUMP_TREE') {
          stateTimer -= delta;
          starsGroup.visible = true;
          starsGroup.rotation.y += delta * 5;
          torso.position.y = 12;
          rightArm.rotation.x = 1.8;
          headGroup.rotation.z = Math.sin(now * 0.01) * 0.3;
          if (stateTimer <= 0) {
            state = 'RUNNING';
            routeProgress = 0.695;
          }
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
      container.removeEventListener('mousemove', handlePointerMove);
      controls.dispose();
      renderer.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      trackGeom.dispose();
      trackMat.dispose();
      glowTrackGeom.dispose();
      glowTrackMat.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* Interactive 3D Tactical Controls Capsule (Top-right of map viewport) */}
      <div className="absolute top-8 right-8 z-30 flex items-center gap-2 pointer-events-auto">
        {/* Reset Camera View */}
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            resetCameraRef.current();
          }}
          className="p-2.5 rounded-xl border border-white/10 bg-[#16181c]/80 hover:bg-white/15 text-zinc-300 hover:text-white backdrop-blur-xl shadow-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 text-xs font-mono font-medium"
          title={isRu ? 'Сброс 3D камеры к базовому виду' : 'Reset 3D camera to default view'}
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#e5c158]" />
          <span>{isRu ? 'Вид' : 'View'}</span>
        </button>

        {/* Zoom In */}
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            zoomByRef.current(-120);
          }}
          className="p-2.5 rounded-xl border border-white/10 bg-[#16181c]/80 hover:bg-white/15 text-zinc-300 hover:text-white backdrop-blur-xl shadow-lg cursor-pointer transition-all active:scale-95"
          title={isRu ? 'Приблизить' : 'Zoom in'}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            zoomByRef.current(120);
          }}
          className="p-2.5 rounded-xl border border-white/10 bg-[#16181c]/80 hover:bg-white/15 text-zinc-300 hover:text-white backdrop-blur-xl shadow-lg cursor-pointer transition-all active:scale-95"
          title={isRu ? 'Отдалить' : 'Zoom out'}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        {/* Auto Orbit Toggle */}
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setAutoRotate((r) => !r);
          }}
          className={`p-2.5 rounded-xl border backdrop-blur-xl shadow-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 text-xs font-mono font-medium ${
            autoRotate
              ? 'border-[#e5c158] bg-[#e5c158]/20 text-[#e5c158]'
              : 'border-white/10 bg-[#16181c]/80 hover:bg-white/15 text-zinc-300'
          }`}
          title={isRu ? 'Включить кинематографичный облет' : 'Toggle cinematic orbit'}
        >
          <Compass className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
          <span>{isRu ? '3D Облёт' : 'Orbit'}</span>
        </button>

        {/* Topographic Isolines & Grid Toggle */}
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setShowWireframeGrid((g) => !g);
          }}
          className={`p-2.5 rounded-xl border backdrop-blur-xl shadow-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 text-xs font-mono font-medium ${
            showWireframeGrid
              ? 'border-[#e5c158]/60 bg-[#e5c158]/15 text-[#e5c158]'
              : 'border-white/10 bg-[#16181c]/80 hover:bg-white/15 text-zinc-400'
          }`}
          title={isRu ? 'Переключить изолинии высот' : 'Toggle contour lines'}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>{isRu ? 'Изолинии' : 'Contours'}</span>
        </button>
      </div>

      {/* Floating Tactical Coordinate Readout (Bottom-Left above stats bar) */}
      <div className="absolute bottom-20 left-8 z-30 pointer-events-none">
        <div
          className="px-3.5 py-1.5 rounded-xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl flex items-center gap-4 text-[11px] font-mono tracking-wider"
          style={{ background: 'rgba(22, 24, 28, 0.85)' }}
        >
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e5c158] animate-pulse" />
            <span className="text-zinc-500">GRID:</span>
            <span className="text-white font-semibold">T-904</span>
          </div>
          <div className="text-zinc-400">
            <span className="text-zinc-500">POS:</span>{' '}
            <span className="text-white font-semibold">{telemetry.x}m, {telemetry.z}m</span>
          </div>
          <div className="text-zinc-400">
            <span className="text-zinc-500">ALT:</span>{' '}
            <span className="text-[#e5c158] font-bold">{telemetry.alt}m</span>
          </div>
          <div className="text-[10px] text-zinc-500 hidden sm:inline-block">
            {isRu ? 'ЛКМ: Вращение • ПКМ: Панорама • Колесико: Зум' : 'LMB: Rotate • RMB: Pan • Scroll: Zoom'}
          </div>
        </div>
      </div>
    </div>
  );
};
