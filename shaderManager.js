export class ShaderManager {
    constructor(room) {
        this.room = room;
        this.shaders = [];
    }
    
    // Get all shaders from the database
    getShaderList() {
        return this.room.collection('shader').getList() || [];
    }
    
    // Subscribe to shader changes
    subscribeToShaders(callback) {
        return this.room.collection('shader').subscribe(callback);
    }
    
    // Get a specific shader by ID
    async getShader(shaderId) {
        const shaders = this.room.collection('shader').getList();
        return shaders.find(shader => shader.id === shaderId);
    }
    
    // Create a new shader
    async createShader({ name, description, prompt, fragmentShader, vertexShader, uniforms, thumbnail }) {
        try {
            // Upload thumbnail if it's a data URL
            let thumbnailUrl = thumbnail;
            if (thumbnail && thumbnail.startsWith('data:')) {
                const response = await fetch(thumbnail);
                const blob = await response.blob();
                thumbnailUrl = await this.uploadThumbnail(blob);
            }
            
            // Create the shader record
            const shader = await this.room.collection('shader').create({
                name,
                description,
                prompt,
                fragmentShader,
                vertexShader,
                uniforms: JSON.stringify(uniforms),
                thumbnail: thumbnailUrl
            });
            
            return shader;
        } catch (error) {
            console.error('Error creating shader:', error);
            throw error;
        }
    }
    
    // Update an existing shader
    async updateShader(shaderId, updates) {
        try {
            // If we're updating uniforms, stringify them
            if (updates.uniforms) {
                updates.uniforms = JSON.stringify(updates.uniforms);
            }
            
            // Upload thumbnail if it's a data URL
            if (updates.thumbnail && updates.thumbnail.startsWith('data:')) {
                const response = await fetch(updates.thumbnail);
                const blob = await response.blob();
                updates.thumbnail = await this.uploadThumbnail(blob);
            }
            
            await this.room.collection('shader').update(shaderId, updates);
            return true;
        } catch (error) {
            console.error('Error updating shader:', error);
            throw error;
        }
    }
    
    // Delete a shader
    async deleteShader(shaderId) {
        try {
            await this.room.collection('shader').delete(shaderId);
            return true;
        } catch (error) {
            console.error('Error deleting shader:', error);
            throw error;
        }
    }
    
    // Upload a thumbnail image
    async uploadThumbnail(blob) {
        try {
            // Create a file object from the blob
            const file = new File([blob], 'thumbnail.png', { type: 'image/png' });
            
            // Upload to blob storage
            const url = await websim.upload(file);
            return url;
        } catch (error) {
            console.error('Error uploading thumbnail:', error);
            throw error;
        }
    }
}

