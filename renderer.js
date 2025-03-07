export async function setupScene(canvasId) {
    // Create a renderer
    const canvas = document.getElementById(canvasId);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Create a scene
    const scene = new THREE.Scene();
    
    // Create a camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 2;
    
    // Create controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // Create a mesh to display shaders on
    createMesh(scene);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Create GUI for shader parameters
    const gui = new lil.GUI({ container: document.getElementById('controls') });
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
    
    // Create a geometry
    const geometry = new THREE.IcosahedronGeometry(1, 4);
    
    // Create a mesh
    shaderObject = new THREE.Mesh(geometry, shaderMaterial);
    scene.add(shaderObject);
    
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

// Update the shader material with new code
export function updateShader(fragmentShader, vertexShader, uniformsData) {
    // Clear old GUI controls if they exist
    if (gui) {
        gui.destroy();
    }
    
    // Create a new GUI
    gui = new lil.GUI({ container: document.getElementById('controls') });
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
        renderer.render(renderer.scene, renderer.camera);
        
        // Get the data URL from the canvas
        const dataURL = renderer.domElement.toDataURL('image/png');
        resolve(dataURL);
    });
}

