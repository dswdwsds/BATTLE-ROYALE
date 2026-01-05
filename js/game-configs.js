// Global Configurations (No Export for CORS Safety)
window.MAP_CONFIGS = {
    city: { floorColor: 0x348C31, floorTexture: window.TEXTURE_DATA.grass, terrainAmp: 5, terrainFreq: 50, buildingCount: 65, grassCount: 1500, treeCount: 40, carPos: { x: 30, z: 30 }, skyColor: 0x87ceeb },
    island: { floorColor: 0x27ae60, floorTexture: window.TEXTURE_DATA.grass, terrainAmp: 18, terrainFreq: 30, buildingCount: 20, grassCount: 6000, treeCount: 150, carPos: { x: 0, z: 50 }, skyColor: 0x87ceeb },
    desert: { floorColor: 0xedc9af, floorTexture: window.TEXTURE_DATA.sand, terrainAmp: 10, terrainFreq: 60, buildingCount: 12, grassCount: 300, treeCount: 20, carPos: { x: -50, z: -50 }, skyColor: 0xffdbac },
    night: { floorColor: 0x1a1a2e, floorTexture: window.TEXTURE_DATA.night, terrainAmp: 7, terrainFreq: 40, buildingCount: 50, grassCount: 1000, treeCount: 60, carPos: { x: 20, z: 20 }, skyColor: 0x0a0a20, isNight: true }
};

window.GLOBAL_CONSTS = {
    gravity: -0.012,
    jumpForce: 0.25,
    playerHeight: 1.6,
    maxCarSpeed: 1.2,
    carAccel: 0.018
};

window.WEAPON_CONFIG = {
    rifle: { fireRate: 150, damage: 25, recoil: 0.02, fireSound: 440, ammo: 30, reloadTime: 2000 },
    sniper: { fireRate: 1200, damage: 100, recoil: 0.1, fireSound: 200, ammo: 5, reloadTime: 3500 },
    smg: { fireRate: 80, damage: 15, recoil: 0.012, fireSound: 600, ammo: 40, reloadTime: 1500 },
    shotgun: { fireRate: 800, damage: 80, recoil: 0.15, fireSound: 150, ammo: 6, reloadTime: 2500 }
};
