// Main Game Engine (Global)
window.initBRGame = function (mapType) {
    const THREE = window.THREE;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const miniCanvas = document.getElementById('minimap-canvas');
    const miniCtx = miniCanvas.getContext('2d');
    miniCanvas.width = 160; miniCanvas.height = 160;

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(100, 250, 100);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.left = -500;
    mainLight.shadow.camera.right = 500;
    mainLight.shadow.camera.top = 500;
    mainLight.shadow.camera.bottom = -500;
    mainLight.shadow.camera.far = 1000;
    scene.add(mainLight);
    const ambientLight = new THREE.AmbientLight(0x707070); scene.add(ambientLight);

    let playerName = localStorage.getItem('playerName') || 'لاعب', health = 100, kills = 0, pitch = 0, yaw = 0;
    let currentZoneRadius = 600, targetZoneRadius = 600, zoneNextShrinkTimer = 30, isShrinking = false, nextZoneCenter = new THREE.Vector2(0, 0);
    let lastTime = Date.now(), frameCount = 0, yVelocity = 0, isGrounded = true, isDriving = false, carSpeed = 0, currentWeapon = 'rifle';
    let carFuel = 100, carHealth = 100, carYaw = 0, camShake = 0;
    let healingTimer = 0, isHealing = false, lastFireTime = 0, recoilAmount = 0;
    let currentAmmo = 30, isReloading = false; // Ammo System
    const bullets = [], enemies = [], buildings = [], particles = [], tracers = [];
    window.loots = []; const loots = window.loots;
    const sharedRaycaster = new THREE.Raycaster();

    // Object Pooling
    const pool = {
        bullets: [],
        particles: [],
        getBullet: function () {
            let b = this.bullets.find(x => !x.visible);
            if (!b) {
                b = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
                scene.add(b); this.bullets.push(b);
            }
            b.visible = true; return b;
        },
        getParticle: function (color) {
            let p = this.particles.find(x => !x.visible);
            if (!p) {
                p = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: color }));
                scene.add(p); this.particles.push(p);
            }
            p.material.color.set(color); p.visible = true; return p;
        }
    };

    window.createImpact = (scene, ignored, pos, color) => {
        for (let i = 0; i < 6; i++) {
            const p = pool.getParticle(color);
            p.position.copy(pos);
            p.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
            p.userData.life = 1.0;
            particles.push(p);
        }
    };

    // Use global window.WEAPON_CONFIG
    const WEAPON_CONFIG = window.WEAPON_CONFIG;
    if (WEAPON_CONFIG[currentWeapon]) currentAmmo = WEAPON_CONFIG[currentWeapon].ammo;

    // Inject Car UI
    const carUI = document.createElement('div');
    carUI.id = 'car-ui';
    carUI.innerHTML = `
        <div class="car-stat">
            <div class="stat-label"><span>السرعة</span><span id="speed-text">0</span></div>
            <div class="stat-bar"><div id="speed-fill" class="stat-fill" style="width:0%"></div></div>
        </div>
        <div class="car-stat">
            <div class="stat-label"><span>البنزين</span><span id="fuel-text">100%</span></div>
            <div class="stat-bar"><div id="fuel-fill" class="stat-fill" style="width:100%"></div></div>
        </div>
        <div class="car-stat">
            <div class="stat-label"><span>صحة السيارة</span><span id="car-hp-text">100%</span></div>
            <div class="stat-bar"><div id="car-hp-fill" class="stat-fill" style="width:100%"></div></div>
        </div>
    `;
    document.body.appendChild(carUI);

    const zoneWarning = document.createElement('div');
    zoneWarning.id = 'zone-warning';
    zoneWarning.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; pointer-events:none; box-shadow:inset 0 0 100px rgba(255,0,0,0); transition:0.3s; z-index:90;";
    document.body.appendChild(zoneWarning);

    const dmgIndicator = document.createElement('div');
    dmgIndicator.id = 'dmg-indicator';
    dmgIndicator.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:300px; height:300px; pointer-events:none; border:4px solid rgba(255,0,0,0); border-radius:50%; transition:0.2s; z-index:85;";
    document.body.appendChild(dmgIndicator);

    // Map Specific Setup
    const conf = window.MAP_CONFIGS[mapType];
    scene.background = new THREE.Color(conf.skyColor);
    ambientLight.intensity = conf.isNight ? 0.3 : 0.7;
    mainLight.intensity = conf.isNight ? 0.5 : 1.2;

    const floorMatParams = { color: conf.floorColor };
    if (conf.floorTexture) {
        const texLoader = new THREE.TextureLoader();
        const texture = texLoader.load(conf.floorTexture);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(100, 100);
        floorMatParams.map = texture;
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 100, 100), new THREE.MeshLambertMaterial(floorMatParams));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const posAttr = floor.geometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) posAttr.setZ(i, window.getGroundHeight(posAttr.getX(i), posAttr.getY(i), mapType));
    floor.geometry.attributes.position.needsUpdate = true; floor.geometry.computeVertexNormals();

    const buildingsGroup = new THREE.Group(); scene.add(buildingsGroup);
    const buildingSystem = window.initBuildingSystem(THREE, scene, conf.buildingCount, conf);
    const treeSystem = window.initTreeSystem(THREE, scene, conf.treeCount, mapType);

    // Night Atmosphere: Add a few street lights
    if (conf.isNight) {
        for (let i = 0; i < 8; i++) {
            const l = new THREE.PointLight(0x00ffff, 1, 150);
            l.position.set(Math.random() * 1000 - 500, 20, Math.random() * 1000 - 500);
            scene.add(l);
        }
    }

    const grassGroup = new THREE.Group(); scene.add(grassGroup);
    window.spawnInstancedGrass(THREE, 5000, 2000, mapType, grassGroup);

    const zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 500, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide }));
    zoneMesh.position.y = 250; scene.add(zoneMesh);
    // Use a fixed geometry and scale it to avoid heavy disposal/recreation
    const zoneRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.01, 64), new THREE.MeshBasicMaterial({ color: 0x0000ff, side: THREE.DoubleSide }));
    zoneRing.rotation.x = -Math.PI / 2; zoneRing.position.y = 0.3; scene.add(zoneRing);

    // Water Floor
    const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshPhongMaterial({ color: 0x0077be, transparent: true, opacity: 0.6 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -1.5; scene.add(water);

    // Procedural Skybox
    const skyGeo = new THREE.SphereGeometry(1500, 32, 15);
    const skyMat = new THREE.MeshBasicMaterial({ color: conf.skyColor, side: THREE.BackSide, fog: false });
    const sky = new THREE.Mesh(skyGeo, skyMat); scene.add(sky);

    // Spatial Partitioning for Buildings
    const buildingGrid = {}; const GRID_SIZE = 50;
    function getGridKey(x, z) { return `${Math.floor(x / GRID_SIZE)},${Math.floor(z / GRID_SIZE)}`; }

    // Improved Car using global function
    const car = window.createCarMesh(THREE, 0xd35400);
    car.position.set(conf.carPos.x, window.getGroundHeight(conf.carPos.x, conf.carPos.z, mapType), conf.carPos.z);
    scene.add(car);

    // End Game UI
    const endOverlay = document.createElement('div');
    endOverlay.id = 'end-game-overlay';
    endOverlay.className = 'overlay';
    endOverlay.style.display = 'none';
    endOverlay.innerHTML = `
        <h1 id="end-status">انتهت اللعبة</h1>
        <div id="end-stats" style="font-size: 24px; margin: 20px 0; line-height: 1.6;"></div>
        <button class="btn" onclick="window.location.reload()">العب مرة أخرى</button>
        <button class="btn" onclick="window.location.href='index2.html'" style="background:#444; margin-left:10px;">القائمة الرئيسية</button>
    `;
    document.body.appendChild(endOverlay);
    const startTime = Date.now();

    window.createWeaponMesh = function (type, color) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.6), new THREE.MeshPhongMaterial({ color: color })));
        if (type === 'sniper') {
            const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), new THREE.MeshPhongMaterial({ color: 0x111111 })); b.rotation.x = Math.PI / 2; b.position.z = 0.8; g.add(b);
        } else if (type === 'shotgun') {
            const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7), new THREE.MeshPhongMaterial({ color: 0x111111 })); b1.rotation.x = Math.PI / 2; b1.position.set(0.03, 0, 0.5); g.add(b1);
        }
        document.getElementById('weapon-text').innerText = type.toUpperCase();
        g.userData.weaponType = type; return g;
    };

    let gunGroup = window.createWeaponMesh('rifle', 0x111111); scene.add(gunGroup);
    const muzzleLight = new THREE.PointLight(0xffaa00, 0, 10); scene.add(muzzleLight);

    // Overlay Reference (Moved up to avoid TDZ errors)
    const overlay = document.getElementById('start-overlay');
    const startBtn = document.getElementById('start-btn');

    // Chunked Spawning - Spread across frames to maintain 60FPS
    function chunkSpawn(total, perFrame, spawnFn) {
        let count = 0;
        function run() {
            for (let i = 0; i < perFrame && count < total; i++, count++) spawnFn();
            if (count < total) setTimeout(run, 10);
        }
        run();
    }

    // Start spawning after 100ms
    setTimeout(() => {
        chunkSpawn(conf.buildingCount, 5, () => {
            const bx = Math.random() * 1400 - 700, bz = Math.random() * 1400 - 700;
            window.createBuilding(THREE, bx, bz, mapType, buildingsGroup, buildings, buildingSystem);
            const key = getGridKey(bx, bz);
            if (!buildingGrid[key]) buildingGrid[key] = [];
            buildingGrid[key].push(buildings[buildings.length - 1]);
        });
        chunkSpawn(conf.treeCount, 10, () => {
            const tx = Math.random() * 1400 - 700, tz = Math.random() * 1400 - 700;
            const tree = window.createTree(THREE, tx, tz, mapType, treeSystem, buildings);
            const key = getGridKey(tx, tz);
            if (!buildingGrid[key]) buildingGrid[key] = [];
            buildingGrid[key].push(tree);
        });
        setTimeout(() => chunkSpawn(40, 2, () => window.spawnEnemy(THREE, Math.random() * 1200 - 600, Math.random() * 1200 - 600, mapType, scene, enemies, window.createWeaponMesh)), 500);
        setTimeout(() => chunkSpawn(30, 3, () => window.spawnLoot(THREE, Math.random() * 1000 - 500, Math.random() * 1000 - 500, Math.random() > 0.5 ? 'medkit' : 'weapon', mapType, scene, loots, window.createWeaponMesh)), 1000);
    }, 100);

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const keys = {}; window.onkeydown = (e) => {
        if (e.code === 'KeyF' && !keys['KeyF']) toggleDrive();
        keys[e.code] = true;
    };
    window.onkeyup = (e) => keys[e.code] = false;

    // Gamepad State
    let gpAxes = [0, 0, 0, 0], gpButtons = {};
    function updateGamepad() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = gamepads[0];
        if (!gp) return;
        gpAxes = gp.axes;
        gpButtons = gp.buttons.reduce((acc, b, i) => { acc[i] = b.pressed; return acc; }, {});
        if (gpButtons[0]) keys['Space'] = true; else keys['Space'] = false;
        if (gpButtons[3]) {
            if (!keys['_gp_F_pressed']) { toggleDrive(); keys['_gp_F_pressed'] = true; }
        } else { keys['_gp_F_pressed'] = false; }
        if (gpButtons[5] || gpButtons[7]) keys['_gp_Shoot'] = true; else keys['_gp_Shoot'] = false;
    }

    // Mobile Input State
    let touchX = 0, touchY = 0, lookTouchId = null, lastLookX = 0, lastLookY = 0;
    let joystickData = { x: 0, y: 0, active: false };

    function initMobileControls() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile && !window.location.search.includes('mobile')) return;
        const mobileUI = document.createElement('div');
        mobileUI.id = 'mobile-ui';
        mobileUI.style.display = 'block';
        mobileUI.innerHTML = `
            <div class="touch-look-area" id="look-area"></div>
            <div class="joystick-container" id="joystick-container"><div class="joystick-knob" id="joystick-knob"></div></div>
            <div class="mobile-actions">
                <div class="mobile-btn" id="btn-jump">🚀</div>
                <div class="mobile-btn" id="btn-shoot">🔥</div>
                <div class="mobile-btn" id="btn-reload">🔄</div>
                <div class="mobile-btn" id="btn-interact">🖐️</div>
            </div>`;
        document.body.appendChild(mobileUI);
        const knob = document.getElementById('joystick-knob'), container = document.getElementById('joystick-container');
        container.addEventListener('touchstart', (e) => { joystickData.active = true; updateJoystick(e.touches[0]); });
        container.addEventListener('touchmove', (e) => { if (joystickData.active) updateJoystick(e.touches[0]); });
        container.addEventListener('touchend', () => {
            joystickData.active = false; joystickData.x = 0; joystickData.y = 0;
            knob.style.transform = 'translate(-50%, -50%)';
        });
        function updateJoystick(touch) {
            const rect = container.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
            let dx = touch.clientX - centerX, dy = touch.clientY - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy), maxDist = rect.width / 2;
            if (dist > maxDist) { dx *= maxDist / dist; dy *= maxDist / dist; }
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            joystickData.x = dx / maxDist; joystickData.y = dy / maxDist;
        }
        document.getElementById('look-area').addEventListener('touchstart', (e) => {
            lookTouchId = e.changedTouches[0].identifier; lastLookX = e.changedTouches[0].clientX; lastLookY = e.changedTouches[0].clientY;
        });
        document.getElementById('look-area').addEventListener('touchmove', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (t.identifier === lookTouchId) {
                    yaw -= (t.clientX - lastLookX) * 0.005; pitch -= (t.clientY - lastLookY) * 0.005;
                    pitch = Math.max(-0.6, Math.min(1.2, pitch));
                    if (!isDriving) camera.rotation.set(pitch, yaw, 0, 'YXZ');
                    lastLookX = t.clientX; lastLookY = t.clientY;
                }
            }
        });
        document.getElementById('btn-jump').addEventListener('touchstart', () => keys['Space'] = true);
        document.getElementById('btn-jump').addEventListener('touchend', () => keys['Space'] = false);
        document.getElementById('btn-shoot').addEventListener('touchstart', () => keys['_mobile_Shoot'] = true);
        document.getElementById('btn-shoot').addEventListener('touchend', () => keys['_mobile_Shoot'] = false);
        document.getElementById('btn-reload').addEventListener('touchstart', () => { if (!isReloading) { currentAmmo = 0; fireWeapon(); } });
        document.getElementById('btn-interact').addEventListener('touchstart', () => {
            // Check prioritize vehicle then loot
            if (camera.position.distanceTo(car.position) < 10) toggleDrive();
            else keys['KeyE'] = true; setTimeout(() => keys['KeyE'] = false, 100);
        });
    }
    initMobileControls();

    function toggleDrive() {
        if (!isDriving && camera.position.distanceTo(car.position) < 10) {
            if (carFuel <= 0) return; // Cannot drive without fuel
            isDriving = true; gunGroup.visible = false;
            document.getElementById('crosshair').style.display = 'none';
            carUI.style.display = 'flex';
            window.playSound(audioCtx, 100, 0.2, gameVolume);
        }
        else if (isDriving) {
            isDriving = false; gunGroup.visible = true;
            document.getElementById('crosshair').style.display = 'block';
            carUI.style.display = 'none';
            camera.position.set(car.position.x + 4, 1.6, car.position.z);
        }
    }

    let isPaused = false;
    const pauseMenu = document.getElementById('pause-menu');
    const resumeBtn = document.getElementById('resume-btn');
    const exitBtn = document.getElementById('exit-btn');
    const volInput = document.getElementById('vol-slider');
    const sensInput = document.getElementById('sens-slider');

    // Load Saved Settings
    let gameVolume = parseFloat(localStorage.getItem('gameVolume')) || 0.5;
    let gameSens = parseFloat(localStorage.getItem('gameSens')) || 2.0;
    if (volInput) volInput.value = gameVolume;
    if (sensInput) sensInput.value = gameSens;

    if (volInput) volInput.oninput = (e) => { gameVolume = parseFloat(e.target.value); localStorage.setItem('gameVolume', gameVolume); };
    if (sensInput) sensInput.oninput = (e) => { gameSens = parseFloat(e.target.value); localStorage.setItem('gameSens', gameSens); };

    if (resumeBtn) resumeBtn.onclick = () => togglePause(false);
    if (exitBtn) exitBtn.onclick = () => window.location.href = 'index2.html';

    function togglePause(paused) {
        isPaused = paused;
        if (isPaused) {
            document.exitPointerLock();
            pauseMenu.style.display = 'block';
        } else {
            document.body.requestPointerLock();
            pauseMenu.style.display = 'none';
        }
    }

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && (!overlay || overlay.style.display === 'none')) {
            togglePause(!isPaused);
        }
    });

    function applyAimAssist() {
        // Aim Assist Disabled as per user request for manual control
        // Original logic removed to prevent "Auto-Lock"
    }

    function animate() {
        if (isPaused) { requestAnimationFrame(animate); return; }
        requestAnimationFrame(animate);

        let now = Date.now();
        if (now - lastTime >= 1000) {
            if (!isShrinking) { zoneNextShrinkTimer--; if (zoneNextShrinkTimer <= 0) { isShrinking = true; targetZoneRadius *= 0.6; } }
            lastTime = now;
        }
        if (isShrinking) { currentZoneRadius -= 0.12; if (currentZoneRadius <= targetZoneRadius) { currentZoneRadius = targetZoneRadius; isShrinking = false; zoneNextShrinkTimer = 30; } }
        document.getElementById('zone-timer').innerText = isShrinking ? "يتقلص!" : `${Math.floor(zoneNextShrinkTimer / 60).toString().padStart(2, '0')}:${(zoneNextShrinkTimer % 60).toString().padStart(2, '0')}`;
        zoneMesh.scale.set(currentZoneRadius, 1, currentZoneRadius);
        zoneRing.scale.set(currentZoneRadius, currentZoneRadius, 1);

        window.updateEnemies(enemies, camera, currentZoneRadius, nextZoneCenter, mapType, scene, bullets, (ctx, f, d) => window.playSound(ctx, f, d, gameVolume), window.createImpact, particles, audioCtx, THREE);

        const playerDist = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
        if (playerDist > currentZoneRadius) {
            if (frameCount % 60 === 0) health -= 2;
            zoneWarning.style.boxShadow = "inset 0 0 150px rgba(255,0,0,0.5)";
        } else zoneWarning.style.boxShadow = "inset 0 0 100px rgba(255,0,0,0)";

        if (Math.abs(gpAxes[2]) > 0.1 || Math.abs(gpAxes[3]) > 0.1) {
            yaw -= gpAxes[2] * 0.03 * gameSens;
            pitch -= gpAxes[3] * 0.03 * gameSens;
            pitch = Math.max(-0.6, Math.min(1.2, pitch));
        }

        applyAimAssist();
        if (!isDriving) camera.rotation.set(pitch, yaw, 0, 'YXZ');

        if (isDriving) {
            let speedMult = car.position.y < -0.8 ? 0.4 : 1.0;
            if (car.position.y < -0.8) {
                if (frameCount % 60 === 0) window.playSound(audioCtx, 100, 0.1, gameVolume * 0.2);
                if (frameCount % 5 === 0) window.createImpact(scene, null, car.position, 0x00ffff);
            }
            const speedIn = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0) || (gpAxes[1] < -0.2 ? -gpAxes[1] : (gpAxes[1] > 0.2 ? -gpAxes[1] : 0)) || -joystickData.y;
            if (speedIn > 0 && carFuel > 0) carSpeed = Math.min(carSpeed + 0.018 * speedMult * speedIn, 1.2 * speedMult);
            else if (speedIn < 0 && carFuel > 0) carSpeed = Math.max(carSpeed + 0.018 * speedMult * speedIn, -0.6 * speedMult);
            else carSpeed *= 0.97;

            if (Math.abs(carSpeed) > 0.1) carFuel = Math.max(0, carFuel - 0.02);
            if (carFuel <= 0) carSpeed *= 0.95;

            const oldPos = car.position.clone();
            const steerIn = (keys['KeyD'] ? -1 : (keys['KeyA'] ? 1 : 0)) || (gpAxes[0] > 0.2 ? -gpAxes[0] : (gpAxes[0] < -0.2 ? -gpAxes[0] : 0)) || -joystickData.x;
            if (steerIn < 0) carYaw -= 0.04 * Math.min(1.0, Math.abs(carSpeed) * 2) * -steerIn;
            if (steerIn > 0) carYaw += 0.04 * Math.min(1.0, Math.abs(carSpeed) * 2) * steerIn;
            car.translateZ(carSpeed);

            let collision = false;
            const gk = getGridKey(car.position.x, car.position.z);
            [gk, getGridKey(car.position.x + GRID_SIZE, car.position.z), getGridKey(car.position.x - GRID_SIZE, car.position.z)].forEach(key => {
                if (buildingGrid[key]) {
                    for (let b of buildingGrid[key]) {
                        const margin = b.w / 2 + 2;
                        if (Math.abs(car.position.x - b.x) < margin && Math.abs(car.position.z - b.z) < margin) { collision = true; break; }
                    }
                }
            });
            if (collision) {
                car.position.copy(oldPos);
                if (Math.abs(carSpeed) > 0.3) { carHealth -= Math.abs(carSpeed) * 10; window.playSound(audioCtx, 100, 0.2, gameVolume); camShake = Math.abs(carSpeed) * 0.5; carYaw += (Math.random() - 0.5) * 0.2; }
                carSpeed *= -0.4;
            }

            const g0 = window.getGroundHeight(car.position.x, car.position.z, mapType);
            const gAhead = window.getGroundHeight(car.position.x + Math.sin(carYaw) * 3, car.position.z + Math.cos(carYaw) * 3, mapType);
            const gSide = window.getGroundHeight(car.position.x + Math.cos(carYaw) * 3, car.position.z - Math.sin(carYaw) * 3, mapType);
            car.position.y = g0 + 0.1;
            const vAhead = new THREE.Vector3(Math.sin(carYaw) * 3, gAhead - g0, Math.cos(carYaw) * 3).normalize();
            const vSide = new THREE.Vector3(Math.cos(carYaw) * 2, gSide - g0, -Math.sin(carYaw) * 2).normalize();
            let normal = new THREE.Vector3().crossVectors(vSide, vAhead).normalize();
            if (normal.y < 0) normal.multiplyScalar(-1);
            const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), carYaw);
            targetQuat.multiply(yawQuat); car.quaternion.slerp(targetQuat, 0.1);

            const camDistance = 14;
            const targetPos = new THREE.Vector3(car.position.x + camDistance * Math.sin(yaw) * Math.cos(pitch), car.position.y + 5 + camDistance * Math.sin(pitch), car.position.z + camDistance * Math.cos(yaw) * Math.cos(pitch));
            const carCenter = car.position.clone().add(new THREE.Vector3(0, 1.5, 0));
            const rayDir = new THREE.Vector3().subVectors(targetPos, carCenter).normalize();
            sharedRaycaster.set(carCenter, rayDir);
            const intersects = sharedRaycaster.intersectObjects([floor, ...buildingsGroup.children], true);
            if (intersects.length > 0 && intersects[0].distance < camDistance) camera.position.lerp(intersects[0].point.clone().sub(rayDir.multiplyScalar(1.0)), 0.4);
            else camera.position.lerp(targetPos, 0.1);
            camera.lookAt(car.position.x, car.position.y + 1, car.position.z);

            if (conf.isNight) { scene.traverse(node => { if (node.isPointLight && node !== muzzleLight) node.intensity = 0.8 + Math.sin(Date.now() * 0.005) * 0.4; }); }
            if (frameCount % 15 === 0) window.playSound(audioCtx, 60 + Math.abs(carSpeed) * 120, 0.2, gameVolume * 0.4);

            document.getElementById('speed-fill').style.width = (Math.abs(carSpeed) / 1.2 * 100) + "%";
            document.getElementById('speed-text').innerText = Math.floor(Math.abs(carSpeed) * 100);
            document.getElementById('fuel-fill').style.width = carFuel + "%";
            document.getElementById('fuel-text').innerText = Math.floor(carFuel) + "%";
            document.getElementById('car-hp-fill').style.width = carHealth + "%";
            document.getElementById('car-hp-text').innerText = Math.floor(carHealth) + "%";
            if (carHealth <= 0) toggleDrive();
        } else {
            yVelocity -= 0.012; camera.position.y += yVelocity;
            const limit = window.getGroundHeight(camera.position.x, camera.position.z, mapType) + 1.7;
            if (camera.position.y <= limit) { camera.position.y = limit; yVelocity = 0; isGrounded = true; } else isGrounded = false;
            if (keys['Space'] && isGrounded) { yVelocity = 0.25; window.playSound(audioCtx, 200, 0.1, gameVolume); }

            let s = (keys['ShiftLeft'] ? 0.45 : 0.25) * (camera.position.y < 0 ? 0.5 : 1.0);
            if (camera.position.y < 0 && frameCount % 10 === 0) { window.createImpact(scene, null, camera.position, 0x00ffff); window.playSound(audioCtx, 80, 0.1, gameVolume * 0.1); }
            if (isHealing) s = 0.08;
            const oldP = camera.position.clone();
            const sW = (keys['KeyW'] ? 1 : 0) || (gpAxes[1] < -0.2 ? -gpAxes[1] : 0) || (joystickData.y < -0.2 ? -joystickData.y : 0);
            const sS = (keys['KeyS'] ? 1 : 0) || (gpAxes[1] > 0.2 ? gpAxes[1] : 0) || (joystickData.y > 0.2 ? joystickData.y : 0);
            const sA = (keys['KeyA'] ? 1 : 0) || (gpAxes[0] < -0.2 ? -gpAxes[0] : 0) || (joystickData.x < -0.2 ? -joystickData.x : 0);
            const sD = (keys['KeyD'] ? 1 : 0) || (gpAxes[0] > 0.2 ? gpAxes[0] : 0) || (joystickData.x > 0.2 ? joystickData.x : 0);
            if (sW) camera.translateZ(-s * sW); if (sS) camera.translateZ(s * sS); if (sA) camera.translateX(-s * sA); if (sD) camera.translateX(s * sD);

            if (isHealing && keys['ShiftLeft']) { isHealing = false; healingTimer = 0; document.getElementById('crosshair').innerText = ""; }
            const pgk = getGridKey(camera.position.x, camera.position.z);
            [pgk, getGridKey(camera.position.x + GRID_SIZE / 2, camera.position.z), getGridKey(camera.position.x - GRID_SIZE / 2, camera.position.z)].forEach(key => {
                if (buildingGrid[key]) {
                    for (let b of buildingGrid[key]) {
                        if (Math.abs(camera.position.x - b.x) < b.w / 2 + 1 && Math.abs(camera.position.z - b.z) < b.w / 2 + 1) { camera.position.copy(oldP); break; }
                    }
                }
            });
            gunGroup.position.copy(camera.position); gunGroup.quaternion.copy(camera.quaternion); gunGroup.translateX(0.35); gunGroup.translateY(-0.25); gunGroup.translateZ(-0.5);
        }

        // Bullets processing
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i]; if (!b.visible) { bullets.splice(i, 1); continue; }
            b.position.add(b.userData.vel);
            if (b.userData.isEnemy) {
                const dist = isDriving ? b.position.distanceTo(car.position) : b.position.distanceTo(camera.position);
                if ((isDriving && dist < 3) || (!isDriving && dist < 1.5)) {
                    if (isDriving) { carHealth -= 2; camShake = 0.1; } else { health -= 5; camShake = 0.3; }
                    b.visible = false; bullets.splice(i, 1);
                    dmgIndicator.style.borderColor = isDriving ? "rgba(255,100,0,1)" : "rgba(255,0,0,1)";
                    setTimeout(() => { dmgIndicator.style.borderColor = "rgba(255,100,0,0)"; }, 150);
                }
            } else {
                enemies.forEach(en => { if (b.position.distanceTo(en.mesh.position) < 2) { en.health -= b.userData.damage; window.createImpact(scene, null, b.position, 0xff0000); b.visible = false; if (en.health <= 0) kills++; } });
            }
            if (b.position.length() > 2000) { b.visible = false; bullets.splice(i, 1); }
        }

        // Tracers cleanup
        for (let i = tracers.length - 1; i >= 0; i--) { tracers[i].material.opacity -= 0.1; if (tracers[i].material.opacity <= 0) { tracers[i].geometry.dispose(); tracers[i].material.dispose(); scene.remove(tracers[i]); tracers.splice(i, 1); } }

        // Loots logic
        loots.forEach((l, i) => {
            l.mesh.rotation.y += 0.02; l.mesh.position.y = window.getGroundHeight(l.mesh.position.x, l.mesh.position.z, mapType) + 0.8 + Math.sin(Date.now() / 500) * 0.2;
            if (camera.position.distanceTo(l.mesh.position) < 4 && keys['KeyE']) {
                if (l.type === 'medkit') { if (health < 100 && !isHealing) { isHealing = true; healingTimer = 3000; if (l.isDeathBox) scene.remove(l.glow); scene.remove(l.mesh); loots.splice(i, 1); } }
                else { currentWeapon = l.mesh.userData.weaponType || 'rifle'; document.getElementById('weapon-text').innerText = currentWeapon.toUpperCase(); scene.remove(gunGroup); gunGroup = window.createWeaponMesh(currentWeapon, 0x111111); scene.add(gunGroup); if (l.isDeathBox) scene.remove(l.glow); scene.remove(l.mesh); loots.splice(i, 1); }
            }
        });

        // Global Effects
        if (camShake > 0) {
            camera.rotation.z += (Math.random() - 0.5) * camShake;
            camera.rotation.x += (Math.random() - 0.5) * camShake;
            camera.position.x += (Math.random() - 0.5) * camShake;
            camera.position.y += (Math.random() - 0.5) * camShake;
            camShake *= 0.85;
            if (camShake < 0.001) camShake = 0;
        }

        for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; if (!p.visible) { particles.splice(i, 1); continue; } p.position.add(p.userData.vel); p.userData.life -= 0.02; p.scale.setScalar(p.userData.life); if (p.userData.life <= 0) { p.visible = false; particles.splice(i, 1); } }

        muzzleLight.intensity *= 0.5;
        if (recoilAmount > 0) { pitch += recoilAmount; recoilAmount *= 0.8; if (recoilAmount < 0.001) recoilAmount = 0; camera.rotation.set(pitch, yaw, 0, 'YXZ'); }

        if (isHealing) {
            healingTimer -= 16.6;
            document.getElementById('crosshair').innerText = "🧪 " + Math.ceil(healingTimer / 1000) + "s";
            if (healingTimer <= 0) { health = Math.min(100, health + 50); isHealing = false; document.getElementById('crosshair').innerText = ""; }
        }

        // UI Updates
        document.getElementById('health-fill').style.width = health + "%";
        document.getElementById('hp-text').innerText = Math.max(0, Math.floor(health));
        document.getElementById('kills').innerText = kills;
        document.getElementById('weapon-text').innerText = `${currentWeapon.toUpperCase()} [${isReloading ? "RELOADING..." : currentAmmo + "/" + WEAPON_CONFIG[currentWeapon].ammo}]`;

        // Minimap
        if (frameCount % 2 === 0) {
            miniCtx.clearRect(0, 0, 160, 160); const scale = 0.15, cx = 80, cz = 80;
            miniCtx.fillStyle = "rgba(100, 100, 100, 0.8)";
            buildings.forEach(b => { const rx = cx + (b.x - camera.position.x) * scale, rz = cz + (b.z - camera.position.z) * scale, rw = b.w * scale; miniCtx.fillRect(rx - rw / 2, rz - rw / 2, rw, rw); });
            const carX = cx + (car.position.x - camera.position.x) * scale, carZ = cz + (car.position.z - camera.position.z) * scale;
            miniCtx.fillStyle = "#ff9900"; miniCtx.beginPath(); miniCtx.arc(carX, carZ, 3, 0, Math.PI * 2); miniCtx.fill();
            miniCtx.fillStyle = "#ff0000"; enemies.forEach(en => { const ex = cx + (en.mesh.position.x - camera.position.x) * scale, ez = cz + (en.mesh.position.z - camera.position.z) * scale; if (Math.abs(ex - cx) < 80 && Math.abs(ez - cz) < 80) { miniCtx.beginPath(); miniCtx.arc(ex, ez, 2.5, 0, Math.PI * 2); miniCtx.fill(); } });
            miniCtx.strokeStyle = "rgba(0,0,255,0.6)"; miniCtx.lineWidth = 2; miniCtx.beginPath(); miniCtx.arc(cx - camera.position.x * scale, cz - camera.position.z * scale, currentZoneRadius * scale, 0, Math.PI * 2); miniCtx.stroke();
            miniCtx.fillStyle = "rgba(46, 204, 113, 0.2)"; miniCtx.beginPath(); miniCtx.moveTo(cx, cz); miniCtx.arc(cx, cz, 40, -yaw - Math.PI / 2 - 0.4, -yaw - Math.PI / 2 + 0.4); miniCtx.fill();
            miniCtx.fillStyle = "#2ecc71"; miniCtx.beginPath(); miniCtx.arc(cx, cz, 4, 0, Math.PI * 2); miniCtx.fill();
            miniCtx.strokeStyle = "#fff"; miniCtx.lineWidth = 2; miniCtx.beginPath(); miniCtx.moveTo(cx, cz); miniCtx.lineTo(cx + Math.sin(yaw) * 8, cz + Math.cos(yaw) * 8); miniCtx.stroke();
            const toZone = new THREE.Vector2(nextZoneCenter.x - camera.position.x, nextZoneCenter.y - camera.position.z).normalize();
            miniCtx.strokeStyle = "#00ffff"; miniCtx.beginPath(); miniCtx.moveTo(cx + toZone.x * 30, cz + toZone.y * 30); miniCtx.lineTo(cx + toZone.x * 45, cz + toZone.y * 45); miniCtx.stroke();
        }

        frameCount++;
        updateGamepad();
        renderer.render(scene, camera);

        if (health <= 0 && endOverlay.style.display === 'none') {
            localStorage.setItem('lastKills', kills); endOverlay.style.display = 'flex'; document.exitPointerLock();
            const survivalTime = Math.floor((Date.now() - startTime) / 1000);
            document.getElementById('end-status').innerText = "لقد خسرت!";
            document.getElementById('end-stats').innerHTML = `ترتيبك: #${enemies.length + 1}<br>عدد القتلى: ${kills}<br>وقت الصمود: ${Math.floor(survivalTime / 60)}:${(survivalTime % 60).toString().padStart(2, '0')}`;
        }
    }

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement) {
            yaw -= e.movementX * 0.001 * gameSens;
            pitch -= e.movementY * 0.001 * gameSens;
            pitch = Math.max(-0.6, Math.min(1.2, pitch));
            if (!isDriving) camera.rotation.set(pitch, yaw, 0, 'YXZ');
        }
    });

    document.addEventListener('mousedown', () => fireWeapon());

    function fireWeapon() {
        if ((document.pointerLockElement || gpAxes.some(a => Math.abs(a) > 0.1) || gpButtons[7] || joystickData.active || keys['_mobile_Shoot']) && !isDriving) {
            const now = Date.now();
            const config = WEAPON_CONFIG[currentWeapon] || WEAPON_CONFIG.rifle;
            if (now - lastFireTime < config.fireRate) return;
            if (isHealing || isReloading) return;
            if (currentAmmo <= 0) {
                isReloading = true;
                window.playSound(audioCtx, 150, 0.4, gameVolume);
                setTimeout(() => { currentAmmo = config.ammo; isReloading = false; }, config.reloadTime);
                return;
            }
            currentAmmo--;
            lastFireTime = now;
            window.playSound(audioCtx, config.fireSound, 0.1, gameVolume);
            camShake = 0.05; recoilAmount = config.recoil; muzzleLight.intensity = 5;
            muzzleLight.position.copy(camera.position).add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
            if (currentWeapon === 'sniper') {
                const b = pool.getBullet(); b.position.copy(camera.position).add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
                b.userData.vel = new THREE.Vector3(0, 0, -3.0).applyQuaternion(camera.quaternion); b.userData.isEnemy = false; b.userData.damage = config.damage; bullets.push(b);
            } else {
                const raycaster = new THREE.Raycaster(); raycaster.setFromCamera({ x: 0, y: 0 }, camera);
                const targets = enemies.map(e => e.mesh).concat(buildingsGroup.children);
                const intersects = raycaster.intersectObjects(targets, true);
                let endPos = camera.position.clone().add(new THREE.Vector3(0, 0, -200).applyQuaternion(camera.quaternion));
                if (intersects.length > 0) {
                    endPos = intersects[0].point;
                    enemies.forEach(en => { en.mesh.traverse(child => { if (child === intersects[0].object) { en.health -= config.damage; window.createImpact(scene, null, endPos, 0xff0000); if (en.health <= 0) kills++; } }); });
                    if (!intersects[0].object.userData.isEnemy) window.createImpact(scene, null, endPos, 0xaaaaaa);
                }
                const points = [camera.position.clone().add(new THREE.Vector3(0.3, -0.2, -0.5).applyQuaternion(camera.quaternion)), endPos];
                const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                const lineMat = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 });
                const tracer = new THREE.Line(lineGeo, lineMat); scene.add(tracer); tracers.push(tracer);
            }
        }
    }

    setInterval(() => { if (keys['_gp_Shoot'] || keys['_mobile_Shoot']) fireWeapon(); }, 1000 / 60);

    // Smart Interact UI
    const interactBtn = document.createElement('div');
    interactBtn.id = 'interact-btn';
    interactBtn.style.cssText = "position:fixed; bottom:20%; left:50%; transform:translateX(-50%); display:none; background:rgba(0,0,0,0.7); color:#fff; padding:15px 30px; border-radius:30px; border:2px solid #2ecc71; font-family:sans-serif; cursor:pointer; z-index:100; font-size:18px;";
    document.body.appendChild(interactBtn);

    function updateInteractUI() {
        if (isDriving) { interactBtn.style.display = 'none'; return; }

        let target = null;
        if (camera.position.distanceTo(car.position) < 10) {
            target = { type: 'car', msg: 'اضغط [F] أو [Y] لركوب السيارة' };
        } else {
            const nearestLoot = loots.find(l => camera.position.distanceTo(l.mesh.position) < 4);
            if (nearestLoot) {
                // Check weaponType in both userData (for world spawns) and property (for death boxes)
                const wType = nearestLoot.weaponType || nearestLoot.mesh.userData.weaponType;
                const lootName = wType || (nearestLoot.type === 'medkit' ? 'حقيبة طبية' : 'سلاح');
                target = { type: nearestLoot.type, msg: 'اضغط [E] أو [X] لالتقاط ' + lootName.toUpperCase() };
            }
        }

        if (target) {
            interactBtn.innerText = target.msg;
            interactBtn.style.display = 'block';

            if (target.type !== 'car') {
                if (keys['KeyE'] || gpButtons[2]) { // E on KB, X on Gamepad for loot
                    keys['KeyE'] = true;
                    setTimeout(() => keys['KeyE'] = false, 100);
                }
            }
        } else {
            interactBtn.style.display = 'none';
        }
    }

    // Inject into interval for polling
    setInterval(updateInteractUI, 100);

    if (startBtn) {
        startBtn.onclick = () => { overlay.style.display = 'none'; document.body.requestPointerLock(); if (audioCtx.state === 'suspended') audioCtx.resume(); animate(); };
    } else animate();
};

