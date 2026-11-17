/*
    bus3d — 순버스 카드의 3D 셔틀버스.
    앱(app/src/map/shuttle-model-layer.ts)과 같은 모델(shuttle-bus.glb)·차체 칠하기 규칙·재질을 쓴다.
    앱 파일은 지도(maplibre)까지 끌어오므로 버스에 필요한 부분만 같은 값으로 옮겼다.
    빌드: node tools/bus3d/build.mjs  →  resources/build/bus3d.js
*/
import {
    ACESFilmicToneMapping,
    AmbientLight,
    Box3,
    BufferAttribute,
    Color,
    DirectionalLight,
    Group,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    Scene,
    SRGBColorSpace,
    Vector3,
    WebGLRenderer,
    type Material,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 앱 tintBusGeometry와 같은 기준: GLB의 붉은 차체만 바꾸고 창문·타이어·흰 장식은 보존
const isBody = (r: number, g: number, b: number) => r > 0.4 && g < 0.2 && b < 0.15;

// 앱 softenBusMaterial과 같은 무광 재질, 아래쪽을 살짝 어둡게
function softenBusMaterial(material: Material) {
    if (!(material instanceof MeshStandardMaterial)) return;
    material.roughness = 0.95;
    material.metalness = 0;
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = `varying float vBusHeight;\n${shader.vertexShader}`.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvBusHeight = position.y;',
        );
        shader.fragmentShader = `varying float vBusHeight;\n${shader.fragmentShader}`.replace(
            '#include <opaque_fragment>',
            'outgoingLight *= mix(0.88, 1.0, smoothstep(0.35, 2.5, vBusHeight));\n#include <opaque_fragment>',
        );
    };
    material.customProgramCacheKey = () => 'shuttle-clay-v1';
}

type Body = { colors: BufferAttribute; indices: number[]; original: Float32Array };

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export type BusHandle = {
    /** 한 바퀴 돌면서 차체 색을 바꿈. color가 null이면 모델 원래 색으로 */
    turn(color: string | null): void;
    dispose(): void;
};

export async function mountBus(container: HTMLElement, modelUrl: string): Promise<BusHandle> {
    const gltf = await new GLTFLoader().loadAsync(modelUrl);
    const model: Group = gltf.scene;

    // 차체 정점만 골라 두고, 원래 색을 보관해 언제든 되돌릴 수 있게 함
    const bodies: Body[] = [];
    model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const colors = object.geometry.getAttribute('color') as BufferAttribute | undefined;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) softenBusMaterial(material);
        if (!colors) return;
        const indices: number[] = [];
        for (let i = 0; i < colors.count; i++) if (isBody(colors.getX(i), colors.getY(i), colors.getZ(i))) indices.push(i);
        bodies.push({ colors, indices, original: Float32Array.from(colors.array as ArrayLike<number>) });
    });

    // 모델을 가운데로 옮기고 크기를 맞춤 (GLB +X가 전방, Y가 위)
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    model.position.sub(box.getCenter(new Vector3()));
    const pivot = new Group();
    pivot.add(model);
    pivot.scale.setScalar(5 / Math.max(size.x, size.y, size.z));

    const scene = new Scene();
    scene.add(pivot);
    scene.add(new AmbientLight(0xffffff, 1.6));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(4, 8, 6);
    scene.add(sun);

    const camera = new PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(5.4, 3.2, 6.4);
    camera.lookAt(0, 0, 0);

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    container.append(renderer.domElement);

    // 처음 각도: 앞쪽 비스듬히
    const baseAngle = -0.5;
    pivot.rotation.y = baseAngle;

    // 비스듬한 시점이라 3D 중심을 바라봐도 화면에서는 한쪽으로 쏠려 보임.
    // 기본 각도에서 버스의 화면상 범위를 계산해, 그 가운데가 캔버스 정중앙에 오도록 시야를 옮김
    const centerOnScreen = (w: number, h: number) => {
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
        // 첫 렌더 전에는 카메라 행렬이 비어 있으므로 먼저 갱신
        camera.updateMatrixWorld(true);
        const spin = pivot.rotation.y;
        pivot.rotation.y = baseAngle;
        pivot.updateMatrixWorld(true);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const point = new Vector3();
        // 축에 맞춘 상자는 비스듬한 버스보다 훨씬 커서 쏠림을 과하게 계산하므로, 실제 꼭짓점을 화면에 투영해 범위를 잼
        model.traverse((object) => {
            if (!(object instanceof Mesh)) return;
            const positions = object.geometry.getAttribute('position');
            for (let i = 0; i < positions.count; i++) {
                point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera);
                minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
                minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
            }
        });
        pivot.rotation.y = spin;
        pivot.updateMatrixWorld(true);
        const offsetX = ((minX + maxX) / 2) * (w / 2);
        const offsetY = -((minY + maxY) / 2) * (h / 2);
        camera.setViewOffset(w, h, offsetX, offsetY, w, h);
    };

    const resize = () => {
        const { clientWidth: w, clientHeight: h } = container;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        centerOnScreen(w, h);
        render();
    };
    const render = () => renderer.render(scene, camera);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    resize();

    let frame = 0;
    // 색 전환: 출발색은 '지금 화면에 보이는 색'을 정점마다 떠 둔 것이라, 바뀌는 도중에 다시 바꿔도 튀지 않음
    const to = new Color();
    let toOriginal = true;
    const starts = bodies.map((body) => Float32Array.from(body.colors.array as ArrayLike<number>));

    const paint = (t: number) => {
        bodies.forEach((body, n) => {
            const o = body.original;
            const a = starts[n];
            for (const i of body.indices) {
                const k = i * 3;
                const br = toOriginal ? o[k] : to.r;
                const bg = toOriginal ? o[k + 1] : to.g;
                const bb = toOriginal ? o[k + 2] : to.b;
                body.colors.setXYZ(i, a[k] + (br - a[k]) * t, a[k + 1] + (bg - a[k + 1]) * t, a[k + 2] + (bb - a[k + 2]) * t);
            }
            body.colors.needsUpdate = true;
        });
    };

    // 한 바퀴 도는 전환 상태. 전환이 없을 때도 아주 살짝 흔들리고 떠 있게 함 (화면에 보일 때만 그림)
    let turnStart = -Infinity;
    const turnDuration = 1600;
    let visible = false;

    // 마우스·손가락으로 끌어 돌리기. 놓으면 원래 각도로 부드럽게 돌아와 다시 자동으로 움직임
    let dragging = false;
    let dragYaw = 0;
    let dragTilt = 0;
    let lastX = 0;
    let lastY = 0;
    let currentSpin = 0;
    let spinFrom = 0;
    let spinTo = 0;

    const tick = (now: number) => {
        frame = 0;
        if (!visible) return;
        const still = reducedMotion();
        const t = Math.min(1, (now - turnStart) / turnDuration);
        currentSpin = still ? 0 : spinFrom + (spinTo - spinFrom) * easeInOut(t);
        // 살랑임: 좌우 ±3도, 위아래 0.05 정도로 아주 느리게 (끄는 동안에는 멈춤)
        const calm = dragging || still;
        const sway = calm ? 0 : Math.sin(now / 1400) * 0.05;
        const bob = calm ? 0 : Math.sin(now / 900) * 0.05;
        if (!dragging) {
            dragYaw *= 0.9;
            dragTilt *= 0.9;
            if (Math.abs(dragYaw) < 0.001) dragYaw = 0;
            if (Math.abs(dragTilt) < 0.001) dragTilt = 0;
        }
        pivot.rotation.y = baseAngle + currentSpin + sway + dragYaw;
        pivot.rotation.x = dragTilt;
        pivot.position.y = bob;
        paint(still ? 1 : Math.min(1, t / 0.45));
        render();
        const settling = dragYaw !== 0 || dragTilt !== 0;
        if (!still || dragging || settling) frame = requestAnimationFrame(tick);
    };
    const start = () => {
        if (!frame) frame = requestAnimationFrame(tick);
    };

    const visibility = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else if (frame) {
            cancelAnimationFrame(frame);
            frame = 0;
        }
    });
    visibility.observe(container);

    const canvas = renderer.domElement;
    canvas.style.touchAction = 'pan-y';
    canvas.style.cursor = 'grab';
    const notify = () => container.dispatchEvent(new CustomEvent('busdrag', { detail: dragging }));

    canvas.addEventListener('pointerdown', (event) => {
        dragging = true;
        // 돌던 중이면 지금 각도에서 이어 받음
        dragYaw += currentSpin % (Math.PI * 2);
        spinFrom = spinTo = currentSpin = 0;
        turnStart = -Infinity;
        lastX = event.clientX;
        lastY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = 'grabbing';
        notify();
        start();
    });
    canvas.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        dragYaw += (event.clientX - lastX) * 0.012;
        dragTilt = Math.max(-0.35, Math.min(0.35, dragTilt + (event.clientY - lastY) * 0.006));
        lastX = event.clientX;
        lastY = event.clientY;
    });
    const release = () => {
        if (!dragging) return;
        dragging = false;
        // 가장 가까운 방향으로 돌아오도록 -π~π 범위로 맞춤
        dragYaw = Math.atan2(Math.sin(dragYaw), Math.cos(dragYaw));
        canvas.style.cursor = 'grab';
        notify();
        start();
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);

    return {
        turn(color) {
            // 지금 보이는 색과 각도에서 그대로 이어 감 (돌거나 색이 바뀌는 도중에 다시 눌러도 끊김 없이)
            bodies.forEach((body, n) => starts[n].set(body.colors.array as ArrayLike<number>));
            toOriginal = color === null;
            // Color.set은 색 관리가 켜진 three.js에서 sRGB 16진수를 선형 값으로 바꿔 줌 (앱 tintBusGeometry와 같음)
            if (color) to.set(color);
            const turnFull = Math.PI * 2;
            const from = currentSpin % turnFull;
            spinFrom = from;
            // 정면에서 멈추도록 다음 한 바퀴 지점까지, 남은 각이 반 바퀴보다 작으면 한 바퀴 더
            spinTo = from + (turnFull - from) + (turnFull - from < Math.PI ? turnFull : 0);
            turnStart = performance.now();
            start();
        },
        dispose() {
            cancelAnimationFrame(frame);
            visibility.disconnect();
            resizeObserver.disconnect();
            renderer.dispose();
            renderer.domElement.remove();
        },
    };
}
