import { setupScene, updateShader, captureShaderThumbnail } from './renderer.js';
import { ShaderManager } from './shaderManager.js';

const room = new WebsimSocket();
const shaderManager = new ShaderManager(room);

// DOM Elements
const galleryEl = document.getElementById('gallery');
const createNewBtn = document.getElementById('createNew');
const modal = document.getElementById('modal');
const saveShaderBtn = document.getElementById('saveShaderBtn');
const cancelBtn = document.getElementById('cancelBtn');
const shaderNameInput = document.getElementById('shaderName');
const shaderDescriptionInput = document.getElementById('shaderDescription');
const shaderPromptInput = document.getElementById('shaderPrompt');

// Initialize
let currentShader = null;
let renderer, scene, camera, controls;
let isInitialized = false;

// Setup Three.js scene
async function init() {
    try {
        showLoading();
        const { renderer: r, scene: s, camera: c, controls: ctrl } = await setupScene('canvas3d');
        renderer = r;
        scene = s;
        camera = c;
        controls = ctrl;
        isInitialized = true;
        
        // Handle resize for all devices including mobile orientation changes
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', () => {
            // Add short timeout to ensure dimensions are updated after orientation change
            setTimeout(handleResize, 100);
        });
        
        // Load shaders from database
        await loadShaders();
        
        // Event handlers
        createNewBtn.addEventListener('click', openCreateModal);
        saveShaderBtn.addEventListener('click', handleShaderCreate);
        cancelBtn.addEventListener('click', closeModal);
        
        // Animation loop
        animate();
        hideLoading();
    } catch (error) {
        console.error("Error initializing scene:", error);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'loading error';
        errorMessage.textContent = 'Error loading 3D scene. Please try refreshing the page.';
        document.getElementById('renderContainer').appendChild(errorMessage);
        hideLoading();
    }
}

// Load shaders from the database
async function loadShaders() {
    showLoading();
    const shaders = shaderManager.getShaderList();
    updateGallery(shaders);
    hideLoading();
    
    // Apply the first shader if available
    if (shaders.length > 0) {
        applyShader(shaders[0].id);
    }
    
    // Subscribe to shader changes
    shaderManager.subscribeToShaders((shaders) => {
        updateGallery(shaders);
    });
}

// Update the gallery with thumbnails
function updateGallery(shaders) {
    galleryEl.innerHTML = '';
    
    shaders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    for (const shader of shaders) {
        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'shader-thumbnail';
        if (currentShader && currentShader.id === shader.id) {
            thumbnailDiv.classList.add('active');
        }
        
        // Thumbnail image
        const img = document.createElement('img');
        img.src = shader.thumbnail || 'placeholder.png';
        img.alt = shader.name;
        thumbnailDiv.appendChild(img);
        
        // Title
        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = shader.name;
        thumbnailDiv.appendChild(title);
        
        // Click handler with touch handling
        thumbnailDiv.addEventListener('click', (e) => {
            if (!isTouchScrolling) {
                applyShader(shader.id);
            }
        });
        
        galleryEl.appendChild(thumbnailDiv);
    }
}

// Apply a shader to the scene
async function applyShader(shaderId) {
    showLoading();
    try {
        const shader = await shaderManager.getShader(shaderId);
        if (shader) {
            currentShader = shader;
            
            // Update all thumbnails
            document.querySelectorAll('.shader-thumbnail').forEach(thumb => {
                thumb.classList.remove('active');
            });
            
            // Find and activate the current thumbnail
            const activeThumbnail = Array.from(document.querySelectorAll('.shader-thumbnail'))
                .find(thumb => thumb.querySelector('.title').textContent === shader.name);
            
            if (activeThumbnail) {
                activeThumbnail.classList.add('active');
            }
            
            // Apply shader to the scene
            updateShader(shader.fragmentShader, shader.vertexShader, shader.uniforms);
        }
    } catch (error) {
        console.error('Error applying shader:', error);
    }
    hideLoading();
}

// Open modal to create a new shader
function openCreateModal() {
    modal.style.display = 'flex';
    shaderNameInput.value = '';
    shaderDescriptionInput.value = '';
    shaderPromptInput.value = '';
}

// Close the modal
function closeModal() {
    modal.style.display = 'none';
}

// Handle shader creation from user input
async function handleShaderCreate() {
    const name = shaderNameInput.value.trim();
    const description = shaderDescriptionInput.value.trim();
    const prompt = shaderPromptInput.value.trim();
    
    if (!name || !prompt) {
        alert('Please provide both a name and a prompt for your shader.');
        return;
    }
    
    saveShaderBtn.disabled = true;
    saveShaderBtn.textContent = 'Generating...';
    
    try {
        // Generate shader code using AI
        const shaderCode = await generateShaderFromPrompt(prompt);
        
        // Create a temporary shader to capture a thumbnail
        updateShader(shaderCode.fragmentShader, shaderCode.vertexShader, shaderCode.uniforms);
        
        // Capture thumbnail
        const thumbnail = await captureShaderThumbnail(renderer);
        
        // Save the shader to the database
        await shaderManager.createShader({
            name,
            description,
            prompt,
            fragmentShader: shaderCode.fragmentShader,
            vertexShader: shaderCode.vertexShader,
            uniforms: shaderCode.uniforms,
            thumbnail
        });
        
        closeModal();
    } catch (error) {
        console.error('Error creating shader:', error);
        alert('Error creating shader: ' + error.message);
    } finally {
        saveShaderBtn.disabled = false;
        saveShaderBtn.textContent = 'Generate & Save';
    }
}

// Generate shader code using AI
async function generateShaderFromPrompt(prompt) {
    try {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are an expert WebGL and GLSL shader programmer. 
                    Create a beautiful 3D shader based on the user's description.
                    
                    Consider using these advanced techniques in your shader code:
                    - Raymarching for 3D shapes and scenes
                    - Distance functions for complex geometry
                    - Normal calculations for proper lighting
                    - Soft shadows, ambient occlusion, and reflections
                    - Procedural textures and noise functions
                    - Color palettes and gradient techniques
                    - Animation techniques using time uniform
                    
                    Return ONLY valid JSON in the following format:
                    {
                        "fragmentShader": "// Full fragment shader code here",
                        "vertexShader": "// Full vertex shader code here",
                        "uniforms": {
                            // ThreeJS uniform definitions
                        }
                    }
                    
                    Make sure the vertex and fragment shaders are compatible with THREE.js.
                    Include uniforms for time, resolution, and any other parameters that would make the shader interactive.
                    The shader should work properly when using THREE.ShaderMaterial in THREE.js r128.
                    For uniforms with functions, provide string descriptions that can be parsed.
                    
                    Important THREE.js uniform examples:
                    - time: { value: 0.0 } // float for animation
                    - resolution: { value: new THREE.Vector2(800, 600) } // screen resolution
                    - color: { value: new THREE.Color(0xff0000) } // colors
                    - textureSampler: { value: new THREE.TextureLoader().load('url') } // textures
                    
                    Make sure the shader is optimized for mobile by considering computational complexity.`
                },
                {
                    role: "user",
                    content: `Create a 3D shader with the following description: ${prompt}`
                }
            ],
            json: true
        });
        
        const shaderCode = JSON.parse(completion.content);
        
        // Process uniform functions
        for (const key in shaderCode.uniforms) {
            if (typeof shaderCode.uniforms[key].value === 'string' && shaderCode.uniforms[key].value.includes('function')) {
                // This is a function description, evaluate it safely
                try {
                    // Create a function from the string
                    shaderCode.uniforms[key].value = new Function(`return ${shaderCode.uniforms[key].value}`)();
                } catch (e) {
                    console.error(`Error parsing uniform function for ${key}:`, e);
                    // Provide a default value if parsing fails
                    shaderCode.uniforms[key].value = 0.0;
                }
            }
        }
        
        return shaderCode;
    } catch (error) {
        console.error('Error generating shader:', error);
        throw new Error('Failed to generate shader code');
    }
}

let isTouchScrolling = false;
const gallery = document.getElementById('gallery');
gallery.addEventListener('touchstart', () => { isTouchScrolling = true; });
gallery.addEventListener('touchend', () => { 
    // Small delay to differentiate between scroll and tap
    setTimeout(() => { isTouchScrolling = false; }, 100); 
});

function handleResize() {
    if (camera && renderer) {
        // Get actual window dimensions
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        
        // Update resolution uniform if it exists
        if (currentShader && currentShader.uniforms && currentShader.uniforms.resolution) {
            currentShader.uniforms.resolution.value.set(width, height);
        }
    }
}

// Animation loop
function animate() {
    if (!isInitialized) return;
    
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Helper functions
function showLoading() {
    // Check if loading message already exists
    if (!document.querySelector('.loading')) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading';
        loadingDiv.textContent = 'Loading...';
        document.getElementById('renderContainer').appendChild(loadingDiv);
    }
}

function hideLoading() {
    const loadingDiv = document.querySelector('.loading');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// Initialize the application
init();