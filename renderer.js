export async function setupScene(canvasId) {
    // Wait for Three.js to be fully loaded
    await new Promise(resolve => {
        if (window.THREE) {
            resolve();
        } else {
            window.addEventListener('load', resolve);
        }
    });
    
    // Create a renderer
    const canvas = document.getElementById(canvasId);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x111111, 1); // Set background color
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for mobile
    
    // Create a scene
    const scene = new THREE.Scene();
    
    // Create a camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 2;
    
    // Create controls - ensure proper usage
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };
    controls.minDistance = 1; // Limit how close we can zoom
    controls.maxDistance = 10; // Limit how far we can zoom
    controls.rotateSpeed = 0.7; // Adjust rotation sensitivity
    controls.enableDamping = true; // Smoother camera movement
    
    // Create a mesh to display shaders on
    createMesh(scene);
    
    // Create reset camera button
    createResetButton(camera, controls);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Create a GUI with mobile considerations
    const gui = new lil.GUI({ 
        container: document.getElementById('controls'),
        autoPlace: true,
        width: Math.min(300, window.innerWidth * 0.8)
    });
    gui.close(); // Start closed
    
    return { renderer, scene, camera, controls, gui };
}

// Create a mesh to display the shaders on
let shaderMaterial, shaderUniforms, shaderObject, gui;

function createMesh(scene) {
    // Default uniforms
    shaderUniforms = {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    };
    
    // Default shaders
    const vertexShader = `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
            vUv = uv;
            vPosition = position;
            vNormal = normal;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    
    const fragmentShader = `
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
            vec3 color = 0.5 + 0.5 * cos(time + vUv.xyx + vec3(0, 2, 4));
            gl_FragColor = vec4(color, 1.0);
        }
    `;
    
    // Create a material with the shader
    shaderMaterial = new THREE.ShaderMaterial({
        uniforms: shaderUniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.DoubleSide
    });
    
    // Create a geometry - use a simpler geometry for better performance
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    
    // Create a mesh
    shaderObject = new THREE.Mesh(geometry, shaderMaterial);
    scene.add(shaderObject);
    
    // Create a directional light to ensure the mesh is visible
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1);
    scene.add(light);
    
    // Add ambient light for better visibility
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    // Add an animation loop for the time uniform
    const clock = new THREE.Clock();
    
    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();
        if (shaderUniforms.time) {
            shaderUniforms.time.value = elapsedTime;
        }
    }
    
    animate();
}

// Create a reset camera button
function createResetButton(camera, controls) {
    const resetButton = document.createElement('button');
    resetButton.id = 'resetCamera';
    resetButton.textContent = '↺';
    resetButton.title = 'Reset Camera';
    document.body.appendChild(resetButton);
    
    resetButton.addEventListener('click', () => {
        // Reset camera position and rotation
        camera.position.set(0, 0, 2);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
    });
}

// Update the shader material with new code
export function updateShader(fragmentShader, vertexShader, uniformsData) {
    // Clear old GUI controls if they exist
    if (gui) {
        gui.destroy();
    }
    
    // Create a new GUI with mobile considerations
    gui = new lil.GUI({ 
        container: document.getElementById('controls'),
        width: Math.min(300, window.innerWidth * 0.8)
    });
    gui.title('Shader Controls');
    
    // Parse uniforms if they are a string
    let uniforms = uniformsData;
    if (typeof uniformsData === 'string') {
        try {
            uniforms = JSON.parse(uniformsData);
        } catch (e) {
            console.error('Error parsing uniforms:', e);
            uniforms = {};
        }
    }
    
    // Merge with default uniforms
    const newUniforms = {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    };
    
    // Add custom uniforms and create GUI controls
    for (const key in uniforms) {
        const uniform = uniforms[key];
        
        // Skip time and resolution as we handle them separately
        if (key === 'time' || key === 'resolution') continue;
        
        newUniforms[key] = uniform;
        
        // Add GUI controls based on uniform type
        if (typeof uniform.value === 'number') {
            // For numeric values
            gui.add(uniform, 'value', 0, 1, 0.01).name(key);
        } else if (uniform.value instanceof THREE.Color) {
            // For colors
            const colorObj = { color: `#${uniform.value.getHexString()}` };
            gui.addColor(colorObj, 'color').name(key).onChange((value) => {
                uniform.value.set(value);
            });
        } else if (uniform.value instanceof THREE.Vector2) {
            // For Vector2
            const folder = gui.addFolder(key);
            folder.add(uniform.value, 'x', -1, 1, 0.01).name('x');
            folder.add(uniform.value, 'y', -1, 1, 0.01).name('y');
        } else if (uniform.value instanceof THREE.Vector3) {
            // For Vector3
            const folder = gui.addFolder(key);
            folder.add(uniform.value, 'x', -1, 1, 0.01).name('x');
            folder.add(uniform.value, 'y', -1, 1, 0.01).name('y');
            folder.add(uniform.value, 'z', -1, 1, 0.01).name('z');
        }
    }
    
    // Create a new shader material
    const newMaterial = new THREE.ShaderMaterial({
        uniforms: newUniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.DoubleSide
    });
    
    // Update the mesh material
    shaderObject.material = newMaterial;
    shaderMaterial = newMaterial;
    shaderUniforms = newUniforms;
    
    return newMaterial;
}

// Capture a thumbnail of the current shader
export function captureShaderThumbnail(renderer) {
    return new Promise((resolve) => {
        // Render the scene
        const dataURL = renderer.domElement.toDataURL('image/png');
        resolve(dataURL);
    });
}