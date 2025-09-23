export function startLoop({ renderer, scene, camera, controls }: any) {
    function resize() {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w/h; camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize); resize();

    function tick() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(tick); }
    tick();
}
