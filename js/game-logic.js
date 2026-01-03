// Game Maps Logic (Global)
window.spawnInstancedGrass = function (THREE, count, range, currentMap, scene) {
    const geo = new THREE.PlaneGeometry(0.5, 1.5);
    geo.translate(0, 0.75, 0);
    const mat = new THREE.MeshPhongMaterial({ color: 0x27ae60, side: THREE.DoubleSide, alphaTest: 0.5 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * range;
        const z = (Math.random() - 0.5) * range;
        const y = window.getGroundHeight(x, z, currentMap);

        dummy.position.set(x, y, z);
        dummy.rotation.y = Math.random() * Math.PI;
        dummy.scale.setScalar(0.5 + Math.random() * 1.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    scene.add(mesh);
    return mesh;
};

window.createCarMesh = function (THREE, color) {
    const group = new THREE.Group();
    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 6), new THREE.MeshPhongMaterial({ color: color }));
    body.position.y = 0.5; body.castShadow = true; body.receiveShadow = true; group.add(body);
    // Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 3), new THREE.MeshPhongMaterial({ color: 0x222222, transparent: true, opacity: 0.8 }));
    cabin.position.set(0, 1.2, -0.5); group.add(cabin);
    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    const wheelMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
    wheelGeo.rotateZ(Math.PI / 2);
    [[-1.4, 0.4, 1.8], [1.4, 0.4, 1.8], [-1.4, 0.4, -1.8], [1.4, 0.4, -1.8]].forEach(pos => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(...pos); w.castShadow = true; group.add(w);
    });
    // Lights
    const headLight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffee }));
    const l1 = headLight.clone(); l1.position.set(-1, 0.6, 3); group.add(l1);
    const l2 = headLight.clone(); l2.position.set(1, 0.6, 3); group.add(l2);
    return group;
};

window.initBuildingSystem = function (THREE, scene, count, conf) {
    const unitGeo = new THREE.BoxGeometry(1, 1, 1);
    const colors = conf.isNight ? [0x0f0f1a, 0x2c3e50, 0x1a1a2e] : [0x7f8c8d, 0x95a5a6, 0xd35400];
    const systems = colors.map(c => {
        const mesh = new THREE.InstancedMesh(unitGeo, new THREE.MeshPhongMaterial({ color: c }), count);
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
        return { mesh, index: 0 };
    });
    // Windows instance (Night/Day variants)
    const winGeo = new THREE.BoxGeometry(1, 1, 1);
    const winMesh = new THREE.InstancedMesh(winGeo, new THREE.MeshBasicMaterial({ color: conf.isNight ? 0x00ffff : 0xffffaa }), count * 40);
    scene.add(winMesh);

    // Roof instance
    const roofGeo = new THREE.ConeGeometry(0.5, 1, 4); roofGeo.rotateY(Math.PI / 4);
    const roofMesh = new THREE.InstancedMesh(roofGeo, new THREE.MeshPhongMaterial({ color: 0x2c3e50 }), count);
    scene.add(roofMesh);

    return { systems, winMesh, winIndex: 0, roofMesh, roofIndex: 0 };
};

window.createBuilding = function (THREE, x, z, currentMap, buildingsGroup, buildings, system) {
    const conf = window.MAP_CONFIGS[currentMap];
    if (!conf) return;
    const h = 15 + Math.random() * 50, w = 15 + Math.random() * 12, type = Math.floor(Math.random() * 3);
    const colorIdx = type % 3;
    const sys = system.systems[colorIdx];

    const dummy = new THREE.Object3D();
    const groundY = window.getGroundHeight(x, z, currentMap);
    dummy.position.set(x, groundY + h / 2, z);
    dummy.scale.set(w, h, w);
    dummy.updateMatrix();
    sys.mesh.setMatrixAt(sys.index++, dummy.matrix);
    sys.mesh.instanceMatrix.needsUpdate = true;

    // Windows (simplified for instancing)
    if (type < 2 && system.winMesh) {
        for (let yy = 5; yy < h - 5; yy += 8) {
            for (let r = 0; r < 4; r++) {
                if (system.winIndex >= system.winMesh.count) break;
                const winDummy = new THREE.Object3D();
                winDummy.scale.set(2, 2, 0.2);
                if (r === 0) winDummy.position.set(x, groundY + yy, z + w / 2 + 0.1);
                else if (r === 1) { winDummy.position.set(x, groundY + yy, z - w / 2 - 0.1); winDummy.rotation.y = Math.PI; }
                else if (r === 2) { winDummy.position.set(x + w / 2 + 0.1, groundY + yy, z); winDummy.rotation.y = Math.PI / 2; }
                else { winDummy.position.set(x - w / 2 - 0.1, groundY + yy, z); winDummy.rotation.y = -Math.PI / 2; }
                winDummy.updateMatrix();
                system.winMesh.setMatrixAt(system.winIndex++, winDummy.matrix);
            }
        }
        system.winMesh.instanceMatrix.needsUpdate = true;
    }
    if (type === 2 && system.roofMesh) {
        const roofDummy = new THREE.Object3D();
        roofDummy.position.set(x, groundY + h + 4, z);
        roofDummy.scale.set(w * 0.8, 8, w * 0.8);
        roofDummy.updateMatrix();
        system.roofMesh.setMatrixAt(system.roofIndex++, roofDummy.matrix);
        system.roofMesh.instanceMatrix.needsUpdate = true;
    }
    buildings.push({ x, z, w, h });
};

window.spawnLoot = function (THREE, x, z, type, currentMap, scene, loots, createWeaponMesh) {
    const group = new THREE.Group();
    let mesh;
    if (type === 'medkit') {
        mesh = new THREE.Group();
        mesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.4), new THREE.MeshPhongMaterial({ color: 0xffffff })));
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.1), new THREE.MeshPhongMaterial({ color: 0x333333 })); handle.position.y = 0.35; mesh.add(handle);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.41), new THREE.MeshBasicMaterial({ color: 0xff0000 })); mesh.add(sign);
    } else {
        const weaponType = ['rifle', 'sniper', 'smg', 'shotgun'][Math.floor(Math.random() * 4)];
        mesh = createWeaponMesh(weaponType, 0x555555); mesh.rotation.x = Math.PI / 2;
        group.userData.weaponType = weaponType;
    }
    // Fixed: Larger sphere for easier interaction
    const glow = new THREE.Mesh(new THREE.SphereGeometry(2.5), new THREE.MeshBasicMaterial({ color: type === 'medkit' ? 0x00ff00 : 0xffff00, transparent: true, opacity: 0.15 }));
    group.add(glow);
    group.add(mesh); group.position.set(x, 0.8, z); scene.add(group); loots.push({ mesh: group, type: type });
};

window.createNameplate = function (THREE, name, health) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Draw Name
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 40px Arial"; ctx.textAlign = "center";
    ctx.strokeStyle = "#000000"; ctx.lineWidth = 4;
    ctx.strokeText(name, 128, 50);
    ctx.fillText(name, 128, 50);

    // Draw Health Bar Background
    ctx.fillStyle = "#444444"; ctx.fillRect(28, 70, 200, 25);
    // Draw Health
    ctx.fillStyle = health > 30 ? "#2ecc71" : "#e74c3c";
    ctx.fillRect(28, 70, 200 * (health / 100), 25);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 1, 1);
    sprite.userData.canvas = canvas;
    sprite.userData.ctx = ctx;
    sprite.userData.texture = texture;
    return sprite;
};

window.updateNameplate = function (THREE, sprite, name, health) {
    const ctx = sprite.userData.ctx;
    const canvas = sprite.userData.canvas;
    ctx.clearRect(0, 0, 256, 128);

    // Draw Name
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 40px Arial"; ctx.textAlign = "center";
    ctx.strokeText(name, 128, 50);
    ctx.fillText(name, 128, 50);

    // Draw Health Bar Background
    ctx.fillStyle = "#444444"; ctx.fillRect(28, 70, 200, 25);
    // Draw Health
    ctx.fillStyle = health > 30 ? "#2ecc71" : "#e74c3c";
    ctx.fillRect(28, 70, 200 * (Math.max(0, health) / 100), 25);

    sprite.userData.texture.needsUpdate = true;
};

window.spawnEnemy = function (THREE, x, z, currentMap, scene, enemies, createWeaponMesh) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.0, 4, 8), new THREE.MeshPhongMaterial({ color: 0x2c3e50 }));
    body.position.y = 1.0; body.castShadow = true; group.add(body);
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.5), new THREE.MeshPhongMaterial({ color: 0x34495e }));
    vest.position.y = 1.2; group.add(vest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), new THREE.MeshPhongMaterial({ color: 0xffdbac }));
    head.position.y = 1.85; group.add(head);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.37, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0x111111 }));
    helmet.position.y = 1.88; group.add(helmet);
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8), eyeMat = new THREE.MeshBasicMaterial({ color: 0x000 });
    const lEye = new THREE.Mesh(eyeGeo, eyeMat); lEye.position.set(-0.12, 1.9, 0.3); group.add(lEye);
    const rEye = new THREE.Mesh(eyeGeo, eyeMat); rEye.position.set(0.12, 1.9, 0.3); group.add(rEye);
    const lArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), new THREE.MeshPhongMaterial({ color: 0x2c3e50 })); lArm.position.set(-0.6, 1.2, 0); group.add(lArm);
    const rArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), new THREE.MeshPhongMaterial({ color: 0x2c3e50 })); rArm.position.set(0.6, 1.2, 0.2); rArm.rotation.x = -Math.PI / 3; group.add(rArm);
    const enemyGun = createWeaponMesh('rifle', 0x333333);
    enemyGun.position.set(0.6, 1.1, 0.5); group.add(enemyGun);

    const nameplate = window.createNameplate(THREE, "BOT " + (enemies.length + 1), 100);
    nameplate.position.y = 2.6; group.add(nameplate);

    group.position.set(x, window.getGroundHeight(x, z, currentMap), z);
    scene.add(group);
    enemies.push({ mesh: group, health: 100, lastHealth: 100, lastShot: 0, shootInterval: 2000 + Math.random() * 2000, nameplate: nameplate, name: "BOT " + (enemies.length + 1) });
};

window.updateEnemies = function (enemies, camera, currentZoneRadius, nextZoneCenter, currentMap, scene, bullets, playSound, createImpact, particles, audioCtx, THREE) {
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    for (let i = enemies.length - 1; i >= 0; i--) {
        const en = enemies[i];
        const dist = en.mesh.position.distanceTo(camera.position);

        // AI States: 0=Wander, 1=Chase, 2=Attack
        if (!en.state) en.state = 0;
        if (!en.targetPos) en.targetPos = en.mesh.position.clone();

        if (Math.sqrt(en.mesh.position.x ** 2 + en.mesh.position.z ** 2) > currentZoneRadius) {
            const target = new THREE.Vector3(nextZoneCenter.x, 0, nextZoneCenter.y);
            en.mesh.position.add(new THREE.Vector3().subVectors(target, en.mesh.position).normalize().multiplyScalar(0.2));
            en.mesh.lookAt(target);
        } else if (dist < 60) {
            en.state = dist < 25 ? 2 : 1;
            en.mesh.lookAt(camera.position.x, 0, camera.position.z);

            // Strafing Logic (Side-to-side movement)
            const dir = new THREE.Vector3().subVectors(camera.position, en.mesh.position).normalize();
            const side = new THREE.Vector3(-dir.z, 0, dir.x);
            const strafe = side.multiplyScalar(Math.sin(Date.now() * 0.002 + i) * 0.1);

            if (en.state === 1) en.mesh.position.add(dir.multiplyScalar(0.12)).add(strafe);
            if (en.state === 2) {
                en.mesh.position.add(strafe); // Only strafe while attacking
                if (Date.now() - en.lastShot > en.shootInterval) {
                    en.lastShot = Date.now();
                    playSound(audioCtx, 330, 0.1);
                    // Use pooled bullets if possible, but here we'll keep the logic simple for now or use window.pool
                    const b = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
                    b.position.copy(en.mesh.position).add(new THREE.Vector3(0, 1.5, 0));
                    b.userData.vel = new THREE.Vector3().subVectors(camera.position, b.position).normalize().multiplyScalar(1.5);
                    b.userData.isEnemy = true;
                    scene.add(b); bullets.push(b);
                }
            }
        } else {
            // Wandering
            en.state = 0;
            if (en.mesh.position.distanceTo(en.targetPos) < 2) {
                en.targetPos.set(en.mesh.position.x + (Math.random() - 0.5) * 40, 0, en.mesh.position.z + (Math.random() - 0.5) * 40);
            }
            en.mesh.lookAt(en.targetPos);
            en.mesh.position.add(new THREE.Vector3().subVectors(en.targetPos, en.mesh.position).normalize().multiplyScalar(0.05));
        }

        // Update Nameplate with Frustum Culling
        if (en.health > 0 && en.nameplate) {
            if (en.health !== en.lastHealth) {
                window.updateNameplate(THREE, en.nameplate, en.name, en.health);
                en.lastHealth = en.health;
            }

            // Simple distance + Frustum check
            if (dist > 100) {
                en.nameplate.visible = false;
            } else {
                en.nameplate.visible = frustum.containsPoint(en.mesh.position);
            }
        }

        if (en.health <= 0) {
            // Spawn Loot Box (Death Box)
            const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.8), new THREE.MeshPhongMaterial({ color: 0x5d4037 }));
            box.position.copy(en.mesh.position).add(new THREE.Vector3(0, 0.3, 0));
            box.castShadow = true;
            // Add a small label or glow to show it's lootable
            const glow = new THREE.Mesh(new THREE.SphereGeometry(1.5), new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.1 }));
            glow.position.copy(box.position);
            scene.add(box); scene.add(glow);

            // Register as loot
            window.loots.push({ mesh: box, type: Math.random() > 0.5 ? 'medkit' : 'sniper', isDeathBox: true, glow: glow });

            // Memory Cleanup
            en.mesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
            scene.remove(en.mesh);
            enemies.splice(i, 1);
        } else {
            en.mesh.position.y = window.getGroundHeight(en.mesh.position.x, en.mesh.position.z, currentMap);
        }
    }
};

