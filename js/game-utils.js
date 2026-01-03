// Utility Functions (Global)
window.getGroundHeight = function (x, z, currentMap) {
    if (isNaN(x) || isNaN(z)) return 0;
    const conf = window.MAP_CONFIGS[currentMap];
    if (!conf) return 0;
    // Basic clamping or default to 0 if extremely far out (optional, but keep simple for now)
    if (Math.abs(x) > 10000 || Math.abs(z) > 10000) return 0;
    return Math.sin(x / conf.terrainFreq) * Math.cos(z / conf.terrainFreq) * conf.terrainAmp;
};

window.playSound = function (audioCtx, freq, duration, volume = 0.5) {
    if (!audioCtx || audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime); osc.type = 'square';
    const finalVolume = volume * 0.2; // Scaling down factor
    gain.gain.setValueAtTime(finalVolume, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + duration);
};

window.createImpact = function (scene, particles, pos, color) {
    const THREE = window.THREE;
    for (let i = 0; i < 8; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: color })); p.position.copy(pos);
        p.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2); p.userData.life = 1.0; scene.add(p); particles.push(p);
    }
};
