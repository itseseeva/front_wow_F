import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Play, Pause, RotateCcw, FastForward, CheckCircle2 } from 'lucide-react';

interface Mini3DDioramaMapProps {
  routeName?: string;
  waypointsCount?: number;
  speedMultiplier?: number;
  onProgress?: (progress: number) => void;
  language?: 'ru' | 'en';
}

export const Mini3DDioramaMap: React.FC<Mini3DDioramaMapProps> = ({
  routeName = 'Маршрут 1',
  waypointsCount = 44,
  speedMultiplier = 1,
  onProgress,
  language = 'ru',
}) => {
  const isRu = language === 'ru';
  const mountRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentSpeed, setCurrentSpeed] = useState<number>(speedMultiplier);
  const [statusText, setStatusText] = useState<string>('Бежит по тропинке');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [hitEvent, setHitEvent] = useState<'tree' | 'rock' | 'house' | null>(null);

  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const currentSpeedRef = useRef<number>(currentSpeed);
  currentSpeedRef.current = currentSpeed;

  const progressRef = useRef<number>(0);
  const collisionCooldownRef = useRef<number>(0);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 180;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1116);
    scene.fog = new THREE.FogExp2(0x0e1116, 0.035);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 11, 15);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 8;
    controls.maxDistance = 24;
    controls.target.set(0, 0.5, 0);

    // 2. Lighting
    const hemiLight = new THREE.HemisphereLight(0xdff0ff, 0x1f2421, 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff3d1, 1.4);
    dirLight.position.set(8, 14, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    const ambientWarm = new THREE.AmbientLight(0xffb703, 0.25);
    scene.add(ambientWarm);

    // 3. Floating Island (Stylized Grassy Hex-Platform)
    const islandGroup = new THREE.Group();
    scene.add(islandGroup);

    // Grass Top (Layered cylinder)
    const grassGeo = new THREE.CylinderGeometry(7.2, 7.5, 0.8, 28);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a4f,
      roughness: 0.7,
      metalness: 0.1,
      flatShading: true,
    });
    const grassMesh = new THREE.Mesh(grassGeo, grassMat);
    grassMesh.position.y = 0;
    grassMesh.receiveShadow = true;
    islandGroup.add(grassMesh);

    // Subtle edge highlight ring
    const edgeGeo = new THREE.TorusGeometry(7.3, 0.08, 6, 28);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x52b788, wireframe: false });
    const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
    edgeMesh.rotation.x = Math.PI / 2;
    edgeMesh.position.y = 0.42;
    islandGroup.add(edgeMesh);

    // Dirt & Rock bottom underbelly
    const dirtGeo = new THREE.ConeGeometry(7.3, 3.2, 18);
    const dirtMat = new THREE.MeshStandardMaterial({
      color: 0x3d2817,
      roughness: 0.9,
      flatShading: true,
    });
    const dirtMesh = new THREE.Mesh(dirtGeo, dirtMat);
    dirtMesh.rotation.x = Math.PI;
    dirtMesh.position.y = -1.6;
    islandGroup.add(dirtMesh);

    // Floating rock crystal hanging underneath
    const crystalGeo = new THREE.OctahedronGeometry(0.8, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xe5c158,
      emissive: 0x946200,
      emissiveIntensity: 0.4,
      metalness: 0.3,
      roughness: 0.3,
    });
    const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
    crystalMesh.position.y = -3.4;
    islandGroup.add(crystalMesh);

    // 4. Closed Loop Route Path (CatmullRomCurve3)
    const routePoints = [
      new THREE.Vector3(0, 0.42, 4.8),
      new THREE.Vector3(4.2, 0.42, 3.2),
      new THREE.Vector3(5.2, 0.42, -0.8),
      new THREE.Vector3(3.5, 0.42, -4.2),
      new THREE.Vector3(-1.0, 0.42, -4.8),
      new THREE.Vector3(-4.6, 0.42, -3.0),
      new THREE.Vector3(-5.2, 0.42, 1.2),
      new THREE.Vector3(-3.2, 0.42, 4.4),
    ];

    const routeCurve = new THREE.CatmullRomCurve3(routePoints, true, 'catmullrom', 0.2);

    // Glowing yellow route line tube
    const tubeGeo = new THREE.TubeGeometry(routeCurve, 80, 0.09, 8, true);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0xf5b041,
      emissive: 0xd97706,
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.1,
    });
    const routeTube = new THREE.Mesh(tubeGeo, tubeMat);
    islandGroup.add(routeTube);

    // Little Waypoint beads on the path
    const beadGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const beadMat = new THREE.MeshStandardMaterial({
      color: 0xffe066,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.8,
    });
    for (let i = 0; i < 16; i++) {
      const tPoint = routeCurve.getPoint(i / 16);
      const bead = new THREE.Mesh(beadGeo, beadMat);
      bead.position.copy(tPoint);
      islandGroup.add(bead);
    }

    // 5. Stylized Obstacles (House, Tree, Boulder)
    // A) The Little Wooden Hut / House at t ~ 0.05
    const houseGroup = new THREE.Group();
    const houseBaseGeo = new THREE.BoxGeometry(1.6, 1.1, 1.4);
    const houseBaseMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const houseBase = new THREE.Mesh(houseBaseGeo, houseBaseMat);
    houseBase.castShadow = true;
    houseBase.position.y = 0.55;
    houseGroup.add(houseBase);

    // Roof
    const roofGeo = new THREE.ConeGeometry(1.4, 0.9, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.5;
    roof.castShadow = true;
    houseGroup.add(roof);

    // Chimney & glowing window
    const winGeo = new THREE.PlaneGeometry(0.35, 0.35);
    const winMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.set(0, 0.6, 0.71);
    houseGroup.add(win);

    houseGroup.position.set(0.6, 0.42, 3.8);
    islandGroup.add(houseGroup);

    // B) The Comical Low-Poly Pine Tree at t ~ 0.35
    const treeGroup = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.4;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7, flatShading: true });
    const cone1 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.0, 7), leafMat);
    cone1.position.y = 1.0;
    cone1.castShadow = true;
    treeGroup.add(cone1);

    const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.9, 7), leafMat);
    cone2.position.y = 1.6;
    cone2.castShadow = true;
    treeGroup.add(cone2);

    const cone3 = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.7, 7), leafMat);
    cone3.position.y = 2.1;
    cone3.castShadow = true;
    treeGroup.add(cone3);

    // Tree positioned right next to curve at ~ (3.8, 0.42, -4.1)
    treeGroup.position.set(3.4, 0.42, -3.8);
    islandGroup.add(treeGroup);

    // C) Rounded Mossy Boulder at t ~ 0.70
    const rockGroup = new THREE.Group();
    const rockGeo = new THREE.DodecahedronGeometry(0.85, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x4b5563,
      roughness: 0.9,
      flatShading: true,
    });
    const rockMesh = new THREE.Mesh(rockGeo, rockMat);
    rockMesh.scale.set(1.1, 0.8, 1.0);
    rockMesh.position.y = 0.6;
    rockMesh.castShadow = true;
    rockGroup.add(rockMesh);

    // Moss on rock
    const mossGeo = new THREE.SphereGeometry(0.4, 6, 6);
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 });
    const moss = new THREE.Mesh(mossGeo, mossMat);
    moss.position.set(0.3, 0.95, 0.2);
    rockGroup.add(moss);

    rockGroup.position.set(-5.1, 0.42, -0.6);
    islandGroup.add(rockGroup);

    // 6. Cute Cartoon Ogre Model
    const ogreGroup = new THREE.Group();
    islandGroup.add(ogreGroup);

    // Ogre Body (Stout Rounded Torso)
    const ogreMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.6,
      metalness: 0.1,
    });
    const torsoGeo = new THREE.SphereGeometry(0.55, 12, 10);
    torsoGeo.scale(1, 1.25, 0.9);
    const torso = new THREE.Mesh(torsoGeo, ogreMat);
    torso.position.y = 0.8;
    torso.castShadow = true;
    ogreGroup.add(torso);

    // Belt / Loincloth
    const beltGeo = new THREE.CylinderGeometry(0.57, 0.57, 0.22, 12);
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    const belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.y = 0.6;
    ogreGroup.add(belt);

    // Ogre Head
    const headGeo = new THREE.SphereGeometry(0.42, 12, 10);
    const head = new THREE.Mesh(headGeo, ogreMat);
    head.position.y = 1.6;
    head.castShadow = true;
    ogreGroup.add(head);

    // Little cute horns / ears
    const hornGeo = new THREE.ConeGeometry(0.12, 0.3, 5);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xfef08a });
    const hornLeft = new THREE.Mesh(hornGeo, hornMat);
    hornLeft.position.set(0.35, 1.85, 0);
    hornLeft.rotation.z = -0.4;
    ogreGroup.add(hornLeft);

    const hornRight = new THREE.Mesh(hornGeo, hornMat);
    hornRight.position.set(-0.35, 1.85, 0);
    hornRight.rotation.z = 0.4;
    ogreGroup.add(hornRight);

    // Underbite Tusks
    const tuskGeo = new THREE.ConeGeometry(0.06, 0.22, 4);
    const tuskMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const tuskL = new THREE.Mesh(tuskGeo, tuskMat);
    tuskL.position.set(0.15, 1.48, 0.38);
    tuskL.rotation.x = -0.3;
    ogreGroup.add(tuskL);

    const tuskR = new THREE.Mesh(tuskGeo, tuskMat);
    tuskR.position.set(-0.15, 1.48, 0.38);
    tuskR.rotation.x = -0.3;
    ogreGroup.add(tuskR);

    // Big Googly Cute Eyes
    const eyeWhiteGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyePupilGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const eyeL = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    eyeL.position.set(0.18, 1.68, 0.36);
    const pupilL = new THREE.Mesh(eyePupilGeo, eyePupilMat);
    pupilL.position.set(0.18, 1.68, 0.46);
    ogreGroup.add(eyeL);
    ogreGroup.add(pupilL);

    const eyeR = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    eyeR.position.set(-0.18, 1.68, 0.36);
    const pupilR = new THREE.Mesh(eyePupilGeo, eyePupilMat);
    pupilR.position.set(-0.18, 1.68, 0.46);
    ogreGroup.add(eyeR);
    ogreGroup.add(pupilR);

    // Left and Right Arms
    const armGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.6, 6);
    const armL = new THREE.Mesh(armGeo, ogreMat);
    armL.position.set(0.65, 0.9, 0);
    ogreGroup.add(armL);

    const armR = new THREE.Mesh(armGeo, ogreMat);
    armR.position.set(-0.65, 0.9, 0);
    ogreGroup.add(armR);

    // Left and Right Legs
    const legGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.55, 6);
    const legL = new THREE.Mesh(legGeo, ogreMat);
    legL.position.set(0.28, 0.28, 0);
    ogreGroup.add(legL);

    const legR = new THREE.Mesh(legGeo, ogreMat);
    legR.position.set(-0.28, 0.28, 0);
    ogreGroup.add(legR);

    // Cartoon Stars Group (visible during bonk collision)
    const starsGroup = new THREE.Group();
    const starGeo = new THREE.OctahedronGeometry(0.12, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let s = 0; s < 3; s++) {
      const star = new THREE.Mesh(starGeo, starMat);
      const angle = (s / 3) * Math.PI * 2;
      star.position.set(Math.cos(angle) * 0.5, 2.1, Math.sin(angle) * 0.5);
      starsGroup.add(star);
    }
    starsGroup.visible = false;
    ogreGroup.add(starsGroup);

    // 7. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Gentle floating island rotation
      islandGroup.rotation.y = Math.sin(time * 0.2) * 0.08;

      if (isPlayingRef.current) {
        // Advance path progress
        const speed = 0.065 * currentSpeedRef.current;
        let t = (progressRef.current + delta * speed) % 1;
        progressRef.current = t;

        const percent = Math.floor(t * 100);
        setProgressPercent(percent);
        if (onProgress) onProgress(percent);

        // Position ogre on 3D curve
        const pos = routeCurve.getPoint(t);
        const tangent = routeCurve.getTangent(t);

        ogreGroup.position.copy(pos);
        ogreGroup.position.y += 0.05;

        // Orient ogre forward along tangent
        const lookTarget = pos.clone().add(tangent);
        ogreGroup.lookAt(lookTarget);

        // Check Obstacle Collisions
        // 1) Tree bump around t ~ 0.35 - 0.40
        if (t >= 0.34 && t <= 0.42) {
          if (collisionCooldownRef.current <= 0) {
            setHitEvent('tree');
            setStatusText(isRu ? 'Ой! Врезался в ель!' : 'Ouch! Hit a pine tree!');
            collisionCooldownRef.current = 1.8;
          }
          // Cartoon Bonk tilt
          ogreGroup.rotation.x = -0.55;
          head.rotation.y = Math.sin(time * 25) * 0.6;
          starsGroup.visible = true;
          starsGroup.rotation.y += delta * 6;
        }
        // 2) Rock stumble around t ~ 0.68 - 0.74
        else if (t >= 0.67 && t <= 0.75) {
          if (collisionCooldownRef.current <= 0) {
            setHitEvent('rock');
            setStatusText(isRu ? 'Споткнулся о камушек!' : 'Tripped over a boulder!');
            collisionCooldownRef.current = 1.8;
          }
          // Cartoon tumble tilt forward
          ogreGroup.rotation.x = 0.7;
          ogreGroup.position.y = pos.y + Math.abs(Math.sin(time * 12)) * 0.3;
          starsGroup.visible = true;
          starsGroup.rotation.y += delta * 6;
        }
        // 3) House wave around t ~ 0.94 - 0.03
        else if (t >= 0.94 || t <= 0.04) {
          starsGroup.visible = false;
          setStatusText(isRu ? 'Пробегает мимо домика' : 'Passing the village hut');
          // Happy jump
          ogreGroup.position.y = pos.y + Math.abs(Math.sin(time * 10)) * 0.4 + 0.05;
          armL.rotation.x = -Math.PI * 0.8;
          armR.rotation.x = -Math.PI * 0.8;
        } else {
          // Normal funny run cycle
          starsGroup.visible = false;
          if (collisionCooldownRef.current > 0) {
            collisionCooldownRef.current -= delta;
            if (collisionCooldownRef.current <= 0) {
              setHitEvent(null);
            }
          }
          setStatusText(isRu ? 'Бежит по маршруту' : 'Running along the route');

          // Cute waddling run stride
          const stride = time * 12 * currentSpeedRef.current;
          legL.rotation.x = Math.sin(stride) * 0.65;
          legR.rotation.x = -Math.sin(stride) * 0.65;
          armL.rotation.x = -Math.sin(stride) * 0.7;
          armR.rotation.x = Math.sin(stride) * 0.7;
          torso.rotation.z = Math.sin(stride) * 0.12;
          ogreGroup.position.y = pos.y + Math.abs(Math.sin(stride * 2)) * 0.14 + 0.05;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isRu]);

  const handleRestart = () => {
    progressRef.current = 0;
    setProgressPercent(0);
    setIsPlaying(true);
    setHitEvent(null);
  };

  const cycleSpeed = () => {
    const nextSpeed = currentSpeed === 1 ? 2 : currentSpeed === 2 ? 4 : 1;
    setCurrentSpeed(nextSpeed);
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-[#0d0f14] shadow-xl group">
      {/* 3D Canvas Container */}
      <div
        ref={mountRef}
        className="w-full h-44 sm:h-48 cursor-grab active:cursor-grabbing relative"
      />

      {/* Top Overlay Badge */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-mono text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-[#e5c158] animate-pulse" />
          <span className="font-bold text-white tracking-wider">{routeName}</span>
          <span className="text-zinc-500">•</span>
          <span className="text-[#f5b041]">{waypointsCount} {isRu ? 'точек' : 'pts'}</span>
        </div>

        {/* Dynamic Funny Status Pill */}
        <div
          className={`px-2 py-0.5 rounded-full backdrop-blur-md text-[10px] font-mono font-semibold transition-all duration-300 border ${
            hitEvent === 'tree'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-bounce'
              : hitEvent === 'rock'
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          }`}
        >
          {statusText}
        </div>
      </div>

      {/* Bottom Floating Control HUD */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between p-1.5 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-xs">
        {/* Play/Pause & Restart */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 rounded bg-white/5 hover:bg-white/15 active:scale-95 text-zinc-200 transition-all cursor-pointer"
            title={isPlaying ? (isRu ? 'Пауза' : 'Pause') : (isRu ? 'Старт' : 'Play')}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-[#e5c158]" /> : <Play className="w-3.5 h-3.5 text-[#2ecc71]" />}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            className="p-1 rounded bg-white/5 hover:bg-white/15 active:scale-95 text-zinc-300 hover:text-white transition-all cursor-pointer"
            title={isRu ? 'Перезапустить круг' : 'Restart loop'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Speed Toggle */}
          <button
            type="button"
            onClick={cycleSpeed}
            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 active:scale-95 text-[10px] font-mono font-bold text-[#e5c158] transition-all cursor-pointer flex items-center gap-0.5"
            title={isRu ? 'Изменить скорость симуляции' : 'Change speed'}
          >
            <FastForward className="w-3 h-3" />
            <span>{currentSpeed}x</span>
          </button>
        </div>

        {/* Progress bar & Percent */}
        <div className="flex items-center gap-2">
          <div className="w-16 sm:w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-[#e5c158] to-[#f59e0b] transition-all duration-150"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-zinc-400 font-bold min-w-[28px] text-right">
            {progressPercent}%
          </span>
        </div>
      </div>
    </div>
  );
};
