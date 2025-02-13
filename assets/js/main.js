import * as THREE from "three";
import { GLTFLoader } from "./node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "./node_modules/three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "./node_modules/three/examples/jsm/renderers/CSS2DRenderer.js";

const socket = window.socket || io("http://127.0.0.1:3001");

// 🎨 Color Palette
const colors = {
  RED: 0xf44336,
  GREEN: 0x00ff00,
  YELLOW: 0xffff00,
  GRAY: 0x8d918d,
  PINK: 0xff00e6,
  ORANGE: 0xffa500,
  BLUE: 0x0000ff,
  TRANSPARENT: 0x000000,
};

// 🎥 Camera Setup
const sizes = { width: window.innerWidth, height: window.innerHeight };
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000);
camera.position.set(623, 5, -507); // 📌 ตำแหน่งเริ่มต้นของกล้อง

// 🌍 Scene & Renderer Setup
const scene = new THREE.Scene();
const canvas = document.querySelector(".webgl");
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 🏷️ Label Renderer
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.pointerEvents = "none";
document.body.appendChild(labelRenderer.domElement);

// 🖱️ Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1;
controls.maxDistance = 3000;

// 🎯 Log Camera Position & Target เมื่อมีการเปลี่ยนแปลง
controls.addEventListener("change", () => {
  console.log(`📸 Camera Position: x=${camera.position.x}, y=${camera.position.y}, z=${camera.position.z}`);
  console.log(`🎯 Camera Target: x=${controls.target.x}, y=${controls.target.y}, z=${controls.target.z}`);
});

// 🌞 Lighting
const lights = [
  new THREE.DirectionalLight(0xffffff, 2.25),
  new THREE.DirectionalLight(0xffffff, 2.25),
];
lights[0].position.set(10, 10, 10);
lights[1].position.set(-10, 10, -20);
lights.forEach((light) => scene.add(light));

// 📡 Socket Listener
let statusData = [];
socket.on("modbusData", (data) => {
  statusData = data;
  updateSphereColors();
});

// 🎯 Raycaster Setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  document.body.style.cursor = raycaster.intersectObjects(spheres_Power).length ? "pointer" : "default";
}

window.addEventListener("mousemove", onMouseMove);
window.addEventListener("click", () => {
  const intersects = raycaster.intersectObjects(spheres_Power);
  if (intersects.length > 0) intersects[0].object.onClick();
});

// 🔄 Resize Event
window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
});

// 🔴 Spheres Data
const spheresData = [
  { position: [0, 0, 0], index_power: 0, index_overload: 1 },
  { position: [-32.8, -0.5, 11.8], index_power: 2, index_overload: 3 },
  { position: [11.3, -0.05, -19.3], index_power: 4, index_overload: 5 },
];

const createSphere = (size, color, position, opacity = 1) => {
  const geometry = new THREE.SphereGeometry(size, 128, 128);
  const material = new THREE.MeshBasicMaterial({ color, transparent: opacity !== 1, opacity });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(...position);
  scene.add(sphere);
  return sphere;
};

const spheres_Power = spheresData.map((data) => createSphere(1, colors.GRAY, data.position));
const spheres_Overload = spheresData.map((data) => createSphere(1.2, colors.GRAY, data.position, 0));

// 📌 Update Sphere Colors
function updateSphereColors() {
  spheresData.forEach((data, index) => {
    spheres_Power[index].material.color.set(statusData[data.index_power] === 1 ? colors.GREEN : colors.RED);
    spheres_Overload[index].material.opacity = statusData[data.index_overload] === 1 ? 1 : 0;
  });
}

// 🏢 Load 3D Model
const loader = new GLTFLoader();
loader.load("../assets/3D Model/map.glb", (gltf) => {
  gltf.scene.scale.set(1, 1, 1);
  gltf.scene.position.set(0, -85, 0);
  scene.add(gltf.scene);
});

// 🎭 Animation Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

animate();
